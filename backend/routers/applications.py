from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Application, Job, User
from ..schemas import ApplicationCreate, ApplicationOut
from ..deps import require_role
from ..services.matching_service import match_score

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _enrich(a: Application) -> ApplicationOut:
    """Attach job + employer + student info to an Application response."""
    out = ApplicationOut.model_validate(a)

    # ---- Job details (for the student's dashboard) ----
    job = a.job
    if job:
        out.job_title = job.title
        out.job_city = job.city
        out.job_pay = job.pay
        if job.employer:
            out.employer_name = job.employer.full_name
            out.company_name = job.employer.company_name

    # ---- Student details (for the employer's dashboard) ----
    student = a.student
    if student:
        out.student_name = student.full_name
        out.student_email = student.email
        out.student_city = student.city
        out.student_phone = student.phone
        out.student_bio = student.bio
        out.student_skills = list(student.skills or [])
        out.student_availability = student.availability
        out.student_resume_path = student.resume_path

    # ---- Debug: log what we returned ----
    print(
        f"📄 enrich app_id={a.id} student_id={a.student_id} "
        f"student_name={out.student_name!r} resume={bool(out.student_resume_path)}"
    )

    return out


def _base_query(db: Session):
    """
    Base query that eager-loads Job, Employer, and Student.
    joinedload prevents lazy-loading surprises.
    """
    return db.query(Application).options(
        joinedload(Application.job).joinedload(Job.employer),
        joinedload(Application.student),
    )


@router.post("/job/{job_id}", response_model=ApplicationOut)
def apply(
    job_id: int,
    data: ApplicationCreate,
    user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
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

    # Reload with eager loading so the response includes everything
    a = _base_query(db).filter(Application.id == a.id).first()
    return _enrich(a)


@router.get("/mine", response_model=List[ApplicationOut])
def my_apps(
    user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    rows = (
        _base_query(db)
        .filter(Application.student_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )
    return [_enrich(a) for a in rows]


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
        _base_query(db)
        .filter(Application.job_id == job_id)
        .order_by(Application.match_score.desc(), Application.created_at.desc())
        .all()
    )
    return [_enrich(a) for a in rows]


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