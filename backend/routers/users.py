from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Application, Job
from ..schemas import UserOut, UserUpdate
from ..deps import get_current_user
from ..config import get_settings
from ..services.cloudinary_service import upload_resume as cloudinary_upload_resume
from ..services.matching_service import match_score
from ..services.resume_service import extract_text_from_file
from ..services.ai_service import parse_resume_text

router = APIRouter(prefix="/api/users", tags=["users"])
settings = get_settings()

@router.get("/me", response_model=UserOut)
def me(u: User = Depends(get_current_user)): 
    return u

@router.patch("/me", response_model=UserOut)
def update(data: UserUpdate, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    
    if u.role == "student":
        apps = db.query(Application).filter(Application.student_id == u.id).all()
        for app in apps:
            job = db.get(Job, app.job_id)
            if job:
                app.match_score = match_score(u, job)
                db.add(app)

    db.commit()
    db.refresh(u)
    return u

@router.post("/me/resume", response_model=UserOut)
async def upload_resume_endpoint(
    file: UploadFile = File(...),
    u: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.lower().endswith((".pdf", ".doc", ".docx")):
        raise HTTPException(400, "Only PDF / DOC / DOCX allowed")

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")

    try:
        file.file.seek(0)
        url = cloudinary_upload_resume(file.file, u.id)
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    if not url:
        raise HTTPException(500, "Upload failed — no URL returned")

    u.resume_path = url

    if u.role == "student":
        resume_text = extract_text_from_file(file_bytes, file.filename)
        if resume_text:
            extracted_data = parse_resume_text(resume_text)
            if extracted_data:
                print(f"✅ AI Extracted: {extracted_data}")
                if extracted_data.get("full_name"): u.full_name = extracted_data["full_name"]
                if extracted_data.get("phone"): u.phone = extracted_data["phone"]
                if extracted_data.get("city"): u.city = extracted_data["city"]
                if extracted_data.get("education"): u.education = extracted_data["education"]
                if extracted_data.get("experience"): u.experience = extracted_data["experience"]
                if extracted_data.get("bio"): u.bio = extracted_data["bio"]
                if extracted_data.get("skills"): u.skills = extracted_data["skills"]

                apps = db.query(Application).filter(Application.student_id == u.id).all()
                for app in apps:
                    job = db.get(Job, app.job_id)
                    if job:
                        app.match_score = match_score(u, job)
                        db.add(app)

    db.commit()
    db.refresh(u)
    return u