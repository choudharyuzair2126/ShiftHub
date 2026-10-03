from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserOut, UserUpdate
from ..deps import get_current_user
from ..config import get_settings
from ..services.cloudinary_service import upload_resume as cloudinary_upload_resume

router = APIRouter(prefix="/api/users", tags=["users"])
settings = get_settings()

@router.get("/me", response_model=UserOut)
def me(u: User = Depends(get_current_user)): return u

@router.patch("/me", response_model=UserOut)
def update(data: UserUpdate, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    return u

@router.post("/me/resume", response_model=UserOut)
async def upload_resume_endpoint(
    file: UploadFile = File(...),
    u: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith((".pdf", ".doc", ".docx")):
        raise HTTPException(400, "Only PDF / DOC / DOCX allowed")

    # Size check
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")

    try:
        url = cloudinary_upload_resume(file.file, u.id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    if not url:
        raise HTTPException(500, "Upload failed — no URL returned")

    u.resume_path = url
    db.commit(); db.refresh(u)
    return u