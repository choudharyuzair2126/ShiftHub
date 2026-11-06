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


JOB_DRAFT_PROMPT = """
Create a clear, concise job posting draft from the employer's details.
Return only a valid JSON object with these keys:
{
  "title": "Job title",
  "description": "A concise description with responsibilities and qualifications",
  "category": "One of General, Cafe, Restaurant, Retail, Tutoring, Delivery, Office, Events",
  "city": "City",
  "address": "Address or empty string",
  "pay": "Pay as provided",
  "job_type": "One of Part-time, Full-time, Internship, Gig",
  "required_skills": ["skill"],
  "shift": "Shift or empty string"
}
Use the provided title, pay, city, job type, category, address, and shift as authoritative.
Do not invent an exact location, benefits, employer policies, or requirements not reasonably
implied by the role. Leave unavailable optional details empty. Keep the description suitable
for an employer to review and edit before publishing.
"""


def generate_job_draft(
    title: str,
    pay: str = "",
    city: str = "",
    category: str = "General",
    job_type: str = "Part-time",
    shift: str = "",
    address: str = "",
) -> dict:
    job_details = {
        "title": title.strip(),
        "pay": pay.strip(),
        "city": city.strip(),
        "category": category,
        "job_type": job_type,
        "shift": shift.strip(),
        "address": address.strip(),
    }
    prompt = f"{JOB_DRAFT_PROMPT}\n\nEmployer details:\n{json.dumps(job_details)}"
    model = _load_gemini()
    if model:
        try:
            response = model.generate_content(prompt)
            data = _clean_json_response((getattr(response, "text", "") or "").strip())
            if data.get("description"):
                return _normalize_job_draft(data, job_details)
        except Exception as e:
            print(f"⚠️ Gemini job draft generation failed: {e}")

    client = _load_groq()
    if client:
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": JOB_DRAFT_PROMPT},
                    {"role": "user", "content": json.dumps(job_details)},
                ],
                temperature=0.3,
                max_tokens=900,
                response_format={"type": "json_object"},
            )
            text = (response.choices[0].message.content or "").strip()
            data = _clean_json_response(text)
            if data.get("description"):
                return _normalize_job_draft(data, job_details)
        except Exception as e:
            print(f"⚠️ Groq job draft generation failed: {e}")

    raise RuntimeError("AI job draft generation is unavailable. Check the AI provider configuration and try again.")


def _normalize_job_draft(data: dict, provided: dict) -> dict:
    allowed_categories = {"General", "Cafe", "Restaurant", "Retail", "Tutoring", "Delivery", "Office", "Events"}
    allowed_job_types = {"Part-time", "Full-time", "Internship", "Gig"}
    category = data.get("category")
    job_type = data.get("job_type")
    skills = data.get("required_skills")
    return {
        **provided,
        "title": provided["title"],
        "description": str(data["description"]).strip(),
        "category": category if category in allowed_categories else provided["category"],
        "city": provided["city"],
        "address": provided["address"],
        "pay": provided["pay"],
        "job_type": job_type if job_type in allowed_job_types else provided["job_type"],
        "required_skills": [str(skill).strip() for skill in skills if str(skill).strip()]
        if isinstance(skills, list) else [],
        "shift": provided["shift"],
    }


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
  "experience": "Total work experience, or an empty string if it cannot be determined",
  "skills": ["skill1", "skill2"],
  "bio": "A short summary."
}
Do not count education, internships, projects, or other non-employment dates as work experience.
"""


_MONTH_NAMES = {
    name.lower(): number
    for number, names in enumerate(
        (
            ("jan", "january"), ("feb", "february"), ("mar", "march"),
            ("apr", "april"), ("may",), ("jun", "june"), ("jul", "july"),
            ("aug", "august"), ("sep", "sept", "september"),
            ("oct", "october"), ("nov", "november"), ("dec", "december"),
        ),
        start=1,
    )
    for name in names
}


def _date_token(prefix: str) -> str:
    return (
        rf"(?:(?P<{prefix}_month_name>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|"
        rf"Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|"
        rf"Nov(?:ember)?|Dec(?:ember)?)\s+|(?P<{prefix}_numeric_month>0?[1-9]|1[0-2])\s*[/.-]\s*)?"
        rf"(?P<{prefix}_year>19\d{{2}}|20\d{{2}})"
    )


_DATE_RANGE = re.compile(
    rf"{_date_token('start')}\s*(?:[-–—]\s*|\bto\b\s*)"
    rf"(?P<end>{_date_token('end')}|present|current|now)",
    re.IGNORECASE,
)
_WORK_SECTION = re.compile(
    r"^\s*(?:(?:professional|relevant|employment|work)\s+)?"
    r"(?:work\s+)?(?:experiences?|history|employment history)\s*:?\s*$",
    re.IGNORECASE,
)
_OTHER_SECTION = re.compile(
    r"^\s*(?:education|academic|skills|projects|certifications?|"
    r"volunteer(?:ing)?|awards|references|languages|interests)\s*:?\s*$",
    re.IGNORECASE,
)
_EDUCATION_SECTION = re.compile(
    r"^\s*(?:education|academic(?:\s+background)?)\s*:?\s*$",
    re.IGNORECASE,
)


def _experience_section(resume_text: str) -> str:
    lines = resume_text.splitlines()
    sections = []
    active = False
    current = []
    found_heading = False

    for line in lines:
        if _WORK_SECTION.match(line):
            found_heading = True
            if active and current:
                sections.append("\n".join(current))
            current = []
            active = True
        elif _OTHER_SECTION.match(line):
            if active and current:
                sections.append("\n".join(current))
            current = []
            active = False
        elif active:
            current.append(line)

    if active and current:
        sections.append("\n".join(current))
    if found_heading:
        return "\n".join(sections)

    # Some resumes omit section headings. In that case, use date ranges outside
    # clearly labeled education blocks rather than letting graduation dates count.
    return _resume_without_education(resume_text)


def _resume_without_education(resume_text: str) -> str:
    lines = []
    in_education = False
    for line in resume_text.splitlines():
        if _EDUCATION_SECTION.match(line):
            in_education = True
            continue
        if in_education and (_WORK_SECTION.match(line) or _OTHER_SECTION.match(line)):
            in_education = False
        if not in_education:
            lines.append(line)
    return "\n".join(lines)


def _date_to_month(match: re.Match, prefix: str) -> int:
    year = int(match.group(f"{prefix}_year"))
    month_name = match.group(f"{prefix}_month_name")
    numeric_month = match.group(f"{prefix}_numeric_month")
    month = _MONTH_NAMES.get(month_name.lower()[:3], 1) if month_name else int(numeric_month or 1)
    return year * 12 + month - 1


def _normalize_spaced_digits(text: str) -> str:
    text = re.sub(r"(?<=\d)\s+(?=\d)", "", text)
    return re.sub(
        r"(?<![a-z])p\s*r\s*e\s*s\s*e\s*n\s*t(?![a-z])",
        "present",
        text,
        flags=re.IGNORECASE,
    )


def _date_range_end_month(match: re.Match) -> int:
    end = match.group("end")
    if end.lower() in {"present", "current", "now"}:
        now = datetime.now()
        return now.year * 12 + now.month - 1
    end_month = _date_to_month(match, "end")
    if match.group("end_month_name") or match.group("end_numeric_month"):
        return end_month + 1
    return int(match.group("end_year")) * 12


def _format_experience(months: int) -> str:
    years, remaining_months = divmod(months, 12)
    parts = []
    if years:
        parts.append(f"{years} year{'s' if years != 1 else ''}")
    if remaining_months:
        parts.append(f"{remaining_months} month{'s' if remaining_months != 1 else ''}")
    return " ".join(parts) or "Less than 1 month"


def _calculate_total_experience(resume_text: str) -> str:
    experience_text = _normalize_spaced_digits(_experience_section(resume_text))
    full_text = _normalize_spaced_digits(resume_text)
    now = datetime.now()
    current_month = now.year * 12 + now.month
    intervals = []

    for source, include_year_only in ((experience_text, True), (full_text, False)):
        for match in _DATE_RANGE.finditer(source):
            has_month = any(
                match.group(f"{prefix}_{part}")
                for prefix in ("start", "end")
                for part in ("month_name", "numeric_month")
            )
            if not include_year_only and not has_month:
                continue
            start = _date_to_month(match, "start")
            end = _date_range_end_month(match)
            interval = (start, end)
            if start < end <= current_month and start >= 1950 * 12 and interval not in intervals:
                intervals.append(interval)

    if intervals:
        intervals.sort()
        total_months = 0
        merged_start, merged_end = intervals[0]
        for start, end in intervals[1:]:
            if start <= merged_end:
                merged_end = max(merged_end, end)
            else:
                total_months += merged_end - merged_start
                merged_start, merged_end = start, end
        total_months += merged_end - merged_start
        return _format_experience(total_months)

    # If dates are unavailable, preserve an explicit stated duration without
    # treating graduation years or dates from unrelated sections as experience.
    explicit = re.findall(
        r"(?<!\d)(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)"
        r"(?:\s*(?:and)?\s*(\d+)\s*months?)?\s*(?:of\s+)?"
        r"(?:(?:professional|relevant|industry|work)\s+)?experience",
        _resume_without_education(resume_text),
        re.IGNORECASE,
    )
    if explicit:
        years, months = max(
            ((float(years), int(months or 0)) for years, months in explicit),
            key=lambda duration: duration[0] * 12 + duration[1],
        )
        return _format_experience(int(round(years * 12)) + months)
    return "Fresher"


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

    parsed_data["experience"] = _calculate_total_experience(resume_context)
    print(f"📊 Experience calculated: {parsed_data['experience']}")

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