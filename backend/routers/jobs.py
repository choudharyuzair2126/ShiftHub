from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, User
from ..schemas import JobCreate, JobOut
from ..deps import get_current_user, require_role
from ..services.matching_service import rank_jobs, match_score

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

def _enrich(j: Job) -> JobOut:
    out = JobOut.model_validate(j)
    out.employer_name = j.employer.full_name if j.employer else None
    out.company_name = j.employer.company_name if j.employer else None
    return out

@router.get("", response_model=List[JobOut])
def list_jobs(
    city: Optional[str] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Job).filter(Job.is_active == True)
    if city: query = query.filter(Job.city.ilike(f"%{city}%"))
    if category: query = query.filter(Job.category == category)
    if q: query = query.filter(Job.title.ilike(f"%{q}%"))
    return [_enrich(j) for j in query.order_by(Job.created_at.desc()).all()]

@router.get("/recommended")
def recommended(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.is_active == True).all()
    ranked = rank_jobs(user, jobs)
    return [{"job": _enrich(r["job"]).model_dump(), "score": r["score"]} for r in ranked[:20]]

@router.get("/employer/mine", response_model=List[JobOut])
def my_jobs(user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    return [_enrich(j) for j in db.query(Job).filter(Job.employer_id == user.id).order_by(Job.created_at.desc()).all()]

@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j: raise HTTPException(404, "Job not found")
    return _enrich(j)

@router.get("/{job_id}/match")
def job_match(job_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j: raise HTTPException(404, "Job not found")
    return {"score": match_score(user, j)}

@router.post("", response_model=JobOut)
def create_job(data: JobCreate, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    j = Job(employer_id=user.id, **data.model_dump())
    db.add(j); db.commit(); db.refresh(j)
    return _enrich(j)

@router.delete("/{job_id}")
def delete_job(job_id: int, user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j or j.employer_id != user.id: raise HTTPException(404, "Not found")
    db.delete(j); db.commit()
    return {"ok": True}