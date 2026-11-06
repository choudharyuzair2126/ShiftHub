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
    if not settings.GEMINI_API_KEY or "your-" in settings.GEMINI_API_KEY.lower(): return None
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
    if not settings.GROQ_API_KEY or "your-" in settings.GROQ_API_KEY.lower(): return None
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
You are an expert AI resume parser. Extract the following information from the resume text.
Return ONLY a valid JSON object with these exact keys.

1. "education": Highest degree, field of study, and university.
2. "phone": Phone number.
3. "city": City name.
4. "skills": MAX 15 specific technical skills (e.g., "Flutter", "Python").
5. "bio": 1-2 sentence summary.

JSON Schema:
{
  "full_name": "First and Last Name",
  "phone": "Phone number",
  "city": "City name",
  "education": "Degree, University",
  "skills": ["skill1", "skill2"],
  "bio": "A short summary."
}
"""

def parse_resume_text(resume_text: str) -> dict:
    resume_context = resume_text[:10000]
    parsed_data = {}

    # 1. Try Gemini
    model = _load_gemini()
    if model:
        try:
            prompt = f"{RESUME_EXTRACTION_PROMPT}\n\nResume Text:\n{resume_context}"
            response = model.generate_content(prompt)
            data = _clean_json_response((getattr(response, "text", "") or "").strip())
            if data: parsed_data = data
        except Exception as e:
            print(f"⚠️ Gemini parsing failed: {e}")

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
            if data: parsed_data = data
        except Exception as e:
            print(f"⚠️ Groq parsing failed: {e}")

    # 3. PYTHON DUAL-CALCULATION METHOD (Punctuation-Proof)
    explicit_years = 0
    # Look for digits, then ANY non-alphabetic characters (like +, ), spaces, backslashes), then "year"
    # This specifically catches "4+ years", "\(4+\) years", and "4 - 5 years"
    year_matches = re.findall(r'(\d+)[^a-zA-Z0-9]{0,5}(?:years?|yrs?)', resume_context, re.IGNORECASE)
    if year_matches:
        explicit_years = max([int(y) for y in year_matches])
        
    # Find all date years (e.g., 2020, 2023). 
    # Removed \b boundaries to catch "01/2020"
    all_years = re.findall(r'(19\d{2}|20[0-2]\d)', resume_context)
    valid_years = [int(y) for y in all_years if 1995 <= int(y) <= datetime.now().year]
    
    calculated_years = 0
    if valid_years:
        calculated_years = datetime.now().year - min(valid_years)

    # Use the maximum of both
    final_years = max(calculated_years, explicit_years)

    if final_years > 0:
        parsed_data["experience"] = f"{final_years} years"
        print(f"📊 Experience calculated: {final_years} years (Date math: {calculated_years}, Text match: {explicit_years})")
    else:
        parsed_data["experience"] = "Fresher"
        print("📊 No years found in text.")

    # Clean skills
    if "skills" in parsed_data and isinstance(parsed_data["skills"], list):
        parsed_data["skills"] = parsed_data["skills"][:15]

    return parsed_data

def _clean_json_response(text: str) -> dict:
    try:
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if match: text = match.group(1)
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1 and end > start: text = text[start:end+1]
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"❌ Failed to parse AI JSON: {e}")
        return {}