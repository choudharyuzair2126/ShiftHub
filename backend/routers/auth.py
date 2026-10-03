from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserRegister, UserLogin, Token, UserOut, ForgotPassword, ResetPassword
from ..security import hash_password, verify_password, create_token, new_token
from ..config import get_settings
from ..deps import get_current_user
from ..services.email_service import send_email, verification_email, reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _send_verification(user: User) -> None:
    """
    Regenerate the verification token and email the link.
    IMPORTANT: The caller MUST call db.commit() after this function.
    """
    user.verify_token = new_token()
    link = f"{settings.APP_BASE_URL}/#/verify?token={user.verify_token}"
    send_email(
        to=user.email,
        to_name=user.full_name,
        subject="Verify your ShiftHub account",
        html=verification_email(user.full_name, link),
    )


@router.post("/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email.lower()).first():
        raise HTTPException(400, "Email already registered")

    # Create user WITHOUT a verification token — the token will be set below.
    u = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role if data.role in ("student", "employer") else "student",
        city=data.city or "",
        verify_token="",       # ← empty for now
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    # Generate the token, store it in memory, then COMMIT so the DB matches
    # what's inside the email.
    _send_verification(u)
    db.commit()                # ← THE FIX: persist the new token
    db.refresh(u)

    return Token(access_token=create_token(u.id), user=UserOut.model_validate(u))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == data.email.lower()).first()
    if not u or not verify_password(data.password, u.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=create_token(u.id), user=UserOut.model_validate(u))


@router.get("/verify")
def verify(token: str, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.verify_token == token).first()
    if not u:
        raise HTTPException(400, "Invalid or expired verification link")
    u.is_verified = True
    u.verify_token = ""          # invalidate after use
    db.commit()
    return {"ok": True, "message": "Email verified successfully"}


@router.post("/resend-verification")
def resend_verification(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Resend the verification email. Requires the user to be logged in."""
    if user.is_verified:
        return {"ok": True, "message": "Email already verified"}
    _send_verification(user)
    db.commit()                  # already correct here
    return {"ok": True, "message": "Verification email sent"}


@router.post("/forgot-password")
def forgot(data: ForgotPassword, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == data.email.lower()).first()
    if u:
        u.reset_token = new_token()
        u.reset_expires = datetime.utcnow() + timedelta(minutes=30)
        db.commit()
        link = f"{settings.APP_BASE_URL}/#/reset?token={u.reset_token}"
        send_email(
            to=u.email,
            to_name=u.full_name,
            subject="Reset your ShiftHub password",
            html=reset_email(u.full_name, link),
        )
    return {"ok": True, "message": "If the email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset(data: ResetPassword, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.reset_token == data.token).first()
    if not u or not u.reset_expires or u.reset_expires < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired reset token")
    u.password_hash = hash_password(data.new_password)
    u.reset_token = ""
    u.reset_expires = None
    db.commit()
    return {"ok": True, "message": "Password reset successful"}