from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job
from ..schemas import ChatRequest
from ..services import ai_service          # ← was: gemini_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat")
def chat(data: ChatRequest, db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.is_active == True).limit(15).all()
    ctx = " | ".join([f"{j.title} in {j.city} ({j.category})" for j in jobs])
    reply = ai_service.chat(data.message, data.history, ctx)
    return {"reply": reply}