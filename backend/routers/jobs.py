from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, User, Application # <-- Import Application
from ..schemas import JobCreate, JobDraftRequest, JobDraftResponse, JobOut
from ..deps import get_current_user, require_role
from ..services.matching_service import rank_jobs, match_score
from ..services.ai_service import generate_job_draft, evaluate_match

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
    if user.role != "student":
        return []

    # 1. Find all jobs the user has ALREADY applied to
    applied_apps = db.query(Application.job_id).filter(Application.student_id == user.id).all()
    applied_job_ids = [app[0] for app in applied_apps]

    # 2. Fetch active jobs, EXCLUDING the ones already applied to
    jobs = db.query(Job).filter(
        Job.is_active == True,
        Job.id.notin_(applied_job_ids) # <--- THE FIX
    ).all()
    
    if not jobs:
        return []
    
    # 3. Fast rule-based pre-filtering
    ranked = rank_jobs(user, jobs)
    
    # 4. Take the Top 12 jobs to ensure we don't miss tech jobs hidden by local menial jobs
    top_candidates = ranked[:12]
    
    final_results = []
    
    # 5. AI Evaluation for genuine scoring
    for item in top_candidates:
        job = item["job"]
        base_score = item["score"]
        
        # Ask AI to evaluate
        ai_result = evaluate_match(user, job)
        
        final_score = base_score
        reason = "Matches your skills, education, and location."
        
        # If AI responds successfully, use its score and reason
        if ai_result and "score" in ai_result:
            final_score = float(ai_result["score"])
            reason = ai_result.get("reason", reason)
            
        # 6. Only keep jobs that hit the 50% threshold
        if final_score >= 50.0:
            job_data = _enrich(job).model_dump()
            job_data["match_reason"] = reason 
            final_results.append({"job": job_data, "score": final_score})

    # Sort by the final AI score descending
    final_results.sort(key=lambda x: x["score"], reverse=True)

    return final_results

@router.get("/employer/mine", response_model=List[JobOut])
def my_jobs(user: User = Depends(require_role("employer")), db: Session = Depends(get_db)):
    return [_enrich(j) for j in db.query(Job).filter(Job.employer_id == user.id).order_by(Job.created_at.desc()).all()]

@router.post("/draft", response_model=JobDraftResponse)
def create_job_draft(data: JobDraftRequest, user: User = Depends(require_role("employer"))):
    try:
        return generate_job_draft(
            title=data.title,
            pay=data.pay or "",
            city=data.city or user.city or "",
            category=data.category or "General",
            job_type=data.job_type or "Part-time",
            shift=data.shift or "",
            address=data.address or "",
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))

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