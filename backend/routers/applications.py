from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Application, Job, User
from ..schemas import ApplicationCreate, ApplicationOut
from ..deps import require_role
from ..services.matching_service import match_score

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _enrich(a: Application) -> ApplicationOut:
    """Attach job + employer info to an Application for the frontend."""
    out = ApplicationOut.model_validate(a)
    job = a.job
    if job:
        out.job_title = job.title
        out.job_city = job.city
        out.job_pay = job.pay
        if job.employer:
            out.employer_name = job.employer.full_name
            out.company_name = job.employer.company_name
    return out


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
    return _enrich(a)


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
    rows = db.query(Application).filter(Application.job_id == job_id).all()
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