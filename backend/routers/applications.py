from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Job, User
from ..schemas import ApplicationCreate, ApplicationOut
from ..deps import require_role
from ..services.matching_service import match_score

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _enrich(a: Application, db: Session) -> ApplicationOut:
    """Attach job + employer + student info by querying the DB directly."""
    out = ApplicationOut.model_validate(a)

    job = db.get(Job, a.job_id)
    if job:
        out.job_title = job.title
        out.job_city = job.city
        out.job_pay = job.pay
        employer = db.get(User, job.employer_id)
        if employer:
            out.employer_name = employer.full_name
            out.company_name = employer.company_name

    student = db.get(User, a.student_id)
    if student:
        out.student_name = student.full_name
        out.student_email = student.email
        out.student_city = student.city
        out.student_phone = student.phone
        out.student_bio = student.bio
        out.student_skills = list(student.skills or [])
        out.student_availability = student.availability
        out.student_resume_path = student.resume_path

    print(
        f"📄 enrich app_id={a.id} "
        f"student_id={a.student_id} "
        f"found_student={student is not None} "
        f"name={out.student_name!r} "
        f"resume={bool(out.student_resume_path)}"
    )
    return out


@router.post("/job/{job_id}", response_model=ApplicationOut)
def apply(
    job_id: int,
    data: ApplicationCreate,
    user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    # ---- Verification gate ----
    if not user.is_verified:
        raise HTTPException(403, "Please verify your email before applying to jobs")

    j = db.get(Job, job_id)
    if not j or not j.is_active:
        raise HTTPException(404, "Job not available")

    exists = (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.student_id == user.id)
        .first()
    )
    if exists:
        raise HTTPException(400, "Already applied")

    a = Application(
        job_id=job_id,
        student_id=user.id,
        cover_note=data.cover_note or "",
        match_score=match_score(user, j),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _enrich(a, db)


@router.get("/mine", response_model=List[ApplicationOut])
def my_apps(
    user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Application)
        .filter(Application.student_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [_enrich(a, db) for a in rows]


@router.get("/job/{job_id}", response_model=List[ApplicationOut])
def job_apps(
    job_id: int,
    user: User = Depends(require_role("employer")),
    db: Session = Depends(get_db),
):
    j = db.get(Job, job_id)
    if not j or j.employer_id != user.id:
        raise HTTPException(404, "Not found")
    rows = (
        db.query(Application)
        .filter(Application.job_id == job_id)
        .order_by(Application.match_score.desc(), Application.created_at.desc())
        .all()
    )
    return [_enrich(a, db) for a in rows]


@router.patch("/{app_id}/status")
def update_status(
    app_id: int,
    status: str,
    user: User = Depends(require_role("employer")),
    db: Session = Depends(get_db),
):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(404, "Not found")
    j = db.get(Job, a.job_id)
    if not j or j.employer_id != user.id:
        raise HTTPException(403, "Not allowed")
    if status not in ("pending", "shortlisted", "rejected", "hired"):
        raise HTTPException(400, "Invalid status")
    a.status = status
    db.commit()
    return {"ok": True}