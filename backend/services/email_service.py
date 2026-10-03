"""
Transactional email service for ShiftHub.

Preferred transport: Brevo HTTP API (works on Render / Fly / Vercel
and any host that blocks outbound SMTP).

Fallback transport: Brevo SMTP relay (works locally; blocked on
Render's free tier — kept for local dev convenience).

If neither is configured, emails are printed to the server console.
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import Optional

import httpx

from ..config import get_settings

settings = get_settings()

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_email(to: str, subject: str, html: str, to_name: str = "") -> bool:
    """
    Send a transactional email.

    Tries Brevo HTTP API first (works everywhere), then SMTP (local dev only),
    then falls back to printing to the console.
    """
    # -------- 1. HTTP API (production-safe) --------
    if settings.BREVO_API_KEY:
        ok = _send_via_brevo_api(to, to_name, subject, html)
        if ok:
            return True
        print("⚠️  Brevo HTTP API failed — trying SMTP fallback…")

    # -------- 2. SMTP (local dev / non-blocked hosts) --------
    if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        ok = _send_via_smtp(to, to_name, subject, html)
        if ok:
            return True
        print("⚠️  SMTP also failed — falling back to console output.")

    # -------- 3. Console (dev only) --------
    print(
        f"\n📧 [DEV EMAIL — no transport configured]\n"
        f"To: {to_name or to} <{to}>\n"
        f"Subject: {subject}\n"
        f"---\n{html}\n---\n"
    )
    return True


# ---------------------------------------------------------------------------
# Transport 1 — Brevo HTTP API
# ---------------------------------------------------------------------------

def _send_via_brevo_api(to: str, to_name: str, subject: str, html: str) -> bool:
    payload = {
        "sender": {
            "name": settings.BREVO_SENDER_NAME,
            "email": settings.BREVO_SENDER_EMAIL,
        },
        "to": [
            {"email": to, "name": to_name or to}
        ],
        "subject": subject,
        "htmlContent": html,
    }
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(BREVO_API_URL, json=payload, headers=headers)
        if resp.status_code in (200, 201, 202):
            print(f"✅ Brevo API: email sent to {to} (status {resp.status_code})")
            return True
        print(f"❌ Brevo API error {resp.status_code}: {resp.text[:300]}")
        return False
    except httpx.TimeoutException:
        print("❌ Brevo API timeout (15s)")
        return False
    except Exception as e:
        print(f"❌ Brevo API failed: {type(e).__name__}: {e}")
        return False


# ---------------------------------------------------------------------------
# Transport 2 — Brevo SMTP relay (fallback)
# ---------------------------------------------------------------------------

def _send_via_smtp(to: str, to_name: str, subject: str, html: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
    msg["To"] = formataddr((to_name or to, to))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(
                from_addr=settings.SMTP_FROM_EMAIL,
                to_addrs=[to],
                msg=msg.as_string(),
            )
        print(f"✅ Brevo SMTP: email sent to {to}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Brevo SMTP auth failed: {e}")
        return False
    except (TimeoutError, OSError) as e:
        print(f"❌ Brevo SMTP network error: {type(e).__name__}: {e}")
        print("   → On Render, port 587 is blocked. Use BREVO_API_KEY instead.")
        return False
    except Exception as e:
        print(f"❌ Brevo SMTP failed: {type(e).__name__}: {e}")
        return False


# ---------------------------------------------------------------------------
# HTML Templates
# ---------------------------------------------------------------------------

def verification_email(name: str, link: str) -> str:
    return f"""
    <div style="font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f8fafc;border-radius:14px">
      <h2 style="color:#4f46e5;margin:0 0 12px">Welcome to ShiftHub, {name} 👋</h2>
      <p style="color:#334155;line-height:1.6">Please confirm your email to activate your account.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="{link}" style="background:#4f46e5;color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Verify Email</a>
      </p>
      <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>
        <a href="{link}" style="color:#4f46e5;word-break:break-all">{link}</a>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#94a3b8;font-size:12px;text-align:center">
        ShiftHub — City-Based Part-Time Jobs for Students
      </p>
    </div>"""


def reset_email(name: str, link: str) -> str:
    return f"""
    <div style="font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:auto;padding:32px;background:#f8fafc;border-radius:14px">
      <h2 style="color:#4f46e5;margin:0 0 12px">Reset your password</h2>
      <p style="color:#334155;line-height:1.6">Hi {name}, we received a request to reset your ShiftHub password.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="{link}" style="background:#4f46e5;color:#fff;padding:14px 26px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Reset Password</a>
      </p>
      <p style="color:#64748b;font-size:13px">
        This link expires in <strong>30 minutes</strong>.
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#94a3b8;font-size:12px;text-align:center">
        ShiftHub — City-Based Part-Time Jobs for Students
      </p>
    </div>"""