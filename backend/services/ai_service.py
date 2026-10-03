"""
AI chat service for ShiftHub.

Provider chain (in order):
    1. Google Gemini   — primary
    2. Groq (Llama 3.3 70B) — fallback
    3. Local canned reply  — last-resort

Any provider failure (missing key, rate limit, timeout, bad response)
automatically falls through to the next provider.
"""
from typing import List, Optional
import traceback

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


# ---------------------------------------------------------------------------
# Last-resort canned reply (no external API needed)
# ---------------------------------------------------------------------------

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
# Provider 1 — Google Gemini
# ---------------------------------------------------------------------------

_gemini_model = None
_gemini_initialised = False


def _load_gemini():
    """Lazily initialise the Gemini model. Returns None if unavailable."""
    global _gemini_model, _gemini_initialised
    if _gemini_initialised:
        return _gemini_model
    _gemini_initialised = True
    if not settings.GEMINI_API_KEY:
        print("ℹ️  Gemini not configured (GEMINI_API_KEY empty).")
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
        print(f"✅ Gemini initialised ({settings.GEMINI_MODEL})")
        return _gemini_model
    except Exception as e:
        print(f"⚠️  Gemini init failed: {type(e).__name__}: {e}")
        _gemini_model = None
        return None


def _ask_gemini(message: str, history: List[dict], jobs_context: str) -> Optional[str]:
    """Try Gemini. Returns response text or None on any failure."""
    model = _load_gemini()
    if model is None:
        return None
    try:
        convo = [
            {"role": "user", "parts": [SYSTEM_PROMPT]},
            {"role": "model", "parts": ["Understood."]},
        ]
        for h in (history or [])[-8:]:
            role = "user" if h.get("role") == "user" else "model"
            convo.append({"role": role, "parts": [h.get("content", "")]})
        if jobs_context:
            convo.append({"role": "user", "parts": [f"Current job listings: {jobs_context}"]})
        convo.append({"role": "user", "parts": [message]})

        resp = model.generate_content(convo)
        text = (getattr(resp, "text", "") or "").strip()
        if text:
            return text
        print("⚠️  Gemini returned empty response — falling back to Groq.")
        return None
    except Exception as e:
        print(f"⚠️  Gemini request failed: {type(e).__name__}: {e}")
        traceback.print_exc(limit=1)
        return None


# ---------------------------------------------------------------------------
# Provider 2 — Groq (Llama 3.3)
# ---------------------------------------------------------------------------

_groq_client = None
_groq_initialised = False


def _load_groq():
    """Lazily initialise the Groq client. Returns None if unavailable."""
    global _groq_client, _groq_initialised
    if _groq_initialised:
        return _groq_client
    _groq_initialised = True
    if not settings.GROQ_API_KEY:
        print("ℹ️  Groq not configured (GROQ_API_KEY empty).")
        return None
    try:
        from groq import Groq
        _groq_client = Groq(api_key=settings.GROQ_API_KEY)
        print(f"✅ Groq initialised ({settings.GROQ_MODEL})")
        return _groq_client
    except Exception as e:
        print(f"⚠️  Groq init failed: {type(e).__name__}: {e}")
        _groq_client = None
        return None


def _ask_groq(message: str, history: List[dict], jobs_context: str) -> Optional[str]:
    """Try Groq. Returns response text or None on any failure."""
    client = _load_groq()
    if client is None:
        return None
    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for h in (history or [])[-8:]:
            role = "user" if h.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": h.get("content", "")})
        if jobs_context:
            messages.append({
                "role": "system",
                "content": f"Current job listings you can reference: {jobs_context}",
            })
        messages.append({"role": "user", "content": message})

        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=400,
        )
        text = (resp.choices[0].message.content or "").strip()
        if text:
            return text
        print("⚠️  Groq returned empty response.")
        return None
    except Exception as e:
        print(f"⚠️  Groq request failed: {type(e).__name__}: {e}")
        traceback.print_exc(limit=1)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chat(message: str, history: List[dict] = None, jobs_context: str = "") -> str:
    """
    Send a chat message through the provider chain:
    Gemini → Groq → local canned reply.
    """
    # 1. Gemini
    reply = _ask_gemini(message, history or [], jobs_context)
    if reply:
        print("🤖 Responded via Gemini")
        return reply

    # 2. Groq
    reply = _ask_groq(message, history or [], jobs_context)
    if reply:
        print("🤖 Responded via Groq")
        return reply

    # 3. Canned reply
    print("🤖 All providers failed — using local fallback")
    return _fallback_reply(message, jobs_context)