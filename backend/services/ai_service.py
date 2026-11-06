"""
AI chat service for ShiftHub.
"""
from typing import List, Optional
import json
import re
import traceback
from datetime import datetime

from ..config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are ShiftHub Assistant, a helpful assistant for a city-based part-time job portal for students. "
    "Answer clearly, concisely, and suggest relevant job categories or tips when applicable. "
    "Keep responses under 120 words unless asked otherwise."
)

def _fallback_reply(message: str, jobs_context: str = "") -> str:
    m = message.lower()
    if any(w in m for w in ["hello", "hi ", "hey", "salam"]):
        return "Hi! 👋 I can help you find part-time jobs, upload your resume, or answer questions about ShiftHub."
    if "resume" in m or "cv" in m:
        return "You can upload your CV from your Dashboard → Profile. It helps employers review your application faster."
    if "apply" in m:
        return "Open any job, click 'Apply Now', and add a short cover note. Your match score is shown automatically."
    if "verify" in m or "email" in m:
        return "Check your inbox for the verification email — click the link inside. If you don't see it, check spam."
    if "job" in m or "work" in m or "part" in m:
        return "Browse the Jobs page — filter by city, category, or shift to see the best matches for you."
    return "I'm here to help with jobs, applications, resumes, and ShiftHub features. What would you like to know?"

# ---------------------------------------------------------------------------
# Providers Initialization
# ---------------------------------------------------------------------------

_gemini_model = None
_gemini_initialised = False
_groq_client = None
_groq_initialised = False

def _load_gemini():
    global _gemini_model, _gemini_initialised
    if _gemini_initialised: return _gemini_model
    _gemini_initialised = True
    if not settings.GEMINI_API_KEY or "your-" in settings.GEMINI_API_KEY.lower():
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        return _gemini_model
    except Exception: return None

def _load_groq():
    global _groq_client, _groq_initialised
    if _groq_initialised: return _groq_client
    _groq_initialised = True
    if not settings.GROQ_API_KEY or "your-" in settings.GROQ_API_KEY.lower():
        return None
    try:
        from groq import Groq
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
        return _groq_client
    except Exception: return None

# ---------------------------------------------------------------------------
# Public API — Chat
# ---------------------------------------------------------------------------

def chat(message: str, history: List[dict] = None, jobs_context: str = "") -> str:
    # 1. Gemini
    model = _load_gemini()
    if model:
        try:
            convo = [{"role": "user", "parts": [SYSTEM_PROMPT]}, {"role": "model", "parts": ["Understood."]}]
            for h in (history or [])[-8:]:
                convo.append({"role": "user" if h.get("role") == "user" else "model", "parts": [h.get("content", "")]})
            if jobs_context: convo.append({"role": "user", "parts": [f"Job listings: {jobs_context}"]})
            convo.append({"role": "user", "parts": [message]})
            resp = model.generate_content(convo)
            if resp.text: return resp.text.strip()
        except Exception: pass

    # 2. Groq
    client = _load_groq()
    if client:
        try:
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for h in (history or [])[-8:]:
                messages.append({"role": "user" if h.get("role") == "user" else "assistant", "content": h.get("content", "")})
            if jobs_context: messages.append({"role": "system", "content": f"Job listings: {jobs_context}"})
            messages.append({"role": "user", "content": message})
            resp = client.chat.completions.create(model=settings.GROQ_MODEL, messages=messages, temperature=0.7, max_tokens=400)
            if resp.choices[0].message.content: return resp.choices[0].message.content.strip()
        except Exception: pass

    return _fallback_reply(message, jobs_context)

# ---------------------------------------------------------------------------
# Public API — Resume Parsing
# ---------------------------------------------------------------------------

RESUME_EXTRACTION_PROMPT = """
You are an expert AI resume parser. Extract the following information from the resume text provided.
Return ONLY a valid JSON object with these exact keys.

CRITICAL INSTRUCTIONS:
1. "education": Find the EDUCATION section. Extract the HIGHEST degree, field of study, and university. Format: "BS Computer Science, PMAS Arid Agriculture University".
2. "earliest_work_year": Find the starting year of the EARLIEST work experience. ONLY look at jobs/internships. DO NOT include education years (e.g., if they graduated in 2020 but started working in 2022, return 2022). Return ONLY a 4-digit year (e.g., 2020). If no work experience, return 0.
3. "phone": Extract the phone number.
4. "city": Extract the city (e.g., "Lahore").
5. "skills": Extract a MAXIMUM of 15 specific TECHNICAL skills (e.g., "Flutter", "Python", "Firebase", "Java"). Do NOT include soft skills, sentences, or achievements.
6. "bio": Write a VERY short 1-2 sentence summary (maximum 25 words).

JSON Schema:
{
  "full_name": "First and Last Name",
  "phone": "Phone number",
  "city": "City name",
  "education": "Degree, University",
  "earliest_work_year": 2020,
  "skills": ["skill1", "skill2", "skill3"],
  "bio": "A short 1-2 sentence professional summary."
}
"""

def _resume_context(resume_text: str) -> str:
    if len(resume_text) <= 10000:
        return resume_text
    return f"{resume_text[:5000]}\n\n[Resume text omitted]\n\n{resume_text[-5000:]}"

def parse_resume_text(resume_text: str) -> dict:
    resume_context = _resume_context(resume_text)
    parsed_data = {}
    
    # 1. Try Gemini
    model = _load_gemini()
    if model:
        try:
            prompt = f"{RESUME_EXTRACTION_PROMPT}\n\nResume Text:\n{resume_context}"
            response = model.generate_content(prompt)
            data = _clean_json_response((getattr(response, "text", "") or "").strip())
            if data:
                parsed_data = data
        except Exception as e:
            print(f"⚠️ Gemini resume parsing failed: {e}")

    # 2. Try Groq
    client = _load_groq()
    if client and not parsed_data:
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": RESUME_EXTRACTION_PROMPT},
                    {"role": "user", "content": f"Resume Text:\n{resume_context}"},
                ],
                temperature=0.1,
                max_tokens=2048, 
                response_format={"type": "json_object"} 
            )
            text = (response.choices[0].message.content or "").strip()
            data = _clean_json_response(text)
            if data:
                parsed_data = data
        except Exception as e:
            print(f"⚠️ Groq resume parsing failed: {e}")

    # 3. PYTHON MATH (100% Accurate, handles ANY layout)
    current_year = datetime.now().year
    earliest_year = parsed_data.get("earliest_work_year")
    
    # If the AI successfully found an earliest work year
    if earliest_year and isinstance(earliest_year, (int, float)) and 1990 < earliest_year <= current_year:
        calculated_exp = f"{current_year - int(earliest_year)} years"
        parsed_data["experience"] = calculated_exp
        print(f"📊 Python calculated exact experience: {calculated_exp} (Earliest work year: {earliest_year})")
    else:
        # Fallback: If AI failed to find a year, we manually scan the text for any year
        years = [int(y) for y in re.findall(r'\b(19\d{2}|20\d{2})\b', resume_context)]
        if years:
            # Just take the earliest year found in the whole document as a last resort
            earliest_found = min(years)
            if 1990 < earliest_found <= current_year:
                calculated_exp = f"{current_year - earliest_found} years"
                parsed_data["experience"] = calculated_exp
                print(f"📊 Fallback Python calculated experience: {calculated_exp} (Earliest year found: {earliest_found})")
            else:
                parsed_data["experience"] = "Fresher"
        else:
            parsed_data["experience"] = "Fresher"
            print("📊 No years found anywhere in the text.")

    # Remove the temporary earliest_work_year field so it doesn't clutter the DB
    parsed_data.pop("earliest_work_year", None)

    # Clean up the skills array
    if "skills" in parsed_data and isinstance(parsed_data["skills"], list):
        parsed_data["skills"] = parsed_data["skills"][:15]

    return parsed_data

def _clean_json_response(text: str) -> dict:
    try:
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if match:
            text = match.group(1)
            
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            text = text[start:end+1]
            
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"❌ Failed to parse AI JSON response: {e}\nRaw: {text}")
        return {}