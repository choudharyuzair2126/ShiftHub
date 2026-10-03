"""
Transactional email service for ShiftHub — powered by Brevo SMTP relay.

Uses Python's standard-library `smtplib` + `email.mime` — no extra SDK.
Docs: https://developers.brevo.com/docs/smtp-relay
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from ..config import get_settings

settings = get_settings()


def send_email(to: str, subject: str, html: str, to_name: str = "") -> bool:
    """
    Send a transactional email through Brevo's SMTP relay.

    Returns True on success, False on failure.
    In dev (SMTP_HOST empty), prints the email to the server console instead.
    """
    # -------- DEV FALLBACK: no SMTP configured --------
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(
            f"\n📧 [DEV EMAIL — SMTP not configured]\n"
            f"To: {to_name or to} <{to}>\n"
            f"Subject: {subject}\n"
            f"---\n{html}\n---\n"
        )
        return True

    # -------- Build the message --------
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
    msg["To"] = formataddr((to_name or to, to))
    msg.attach(MIMEText(html, "html", "utf-8"))

    # -------- Send via Brevo SMTP --------
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)          # Upgrade to TLS
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
        print("   → Check SMTP_USER and SMTP_PASSWORD in .env (regenerate the key if needed).")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ Brevo SMTP error: {type(e).__name__}: {e}")
        return False
    except Exception as e:
        print(f"❌ Email send failed: {type(e).__name__}: {e}")
        return False


# ---------------------------------------------------------------------------
# HTML Templates
# ---------------------------------------------------------------------------

def verification_email(name: str, link: str) -> str:
    """HTML body for the email-verification message."""
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
    """HTML body for the password-reset message."""
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