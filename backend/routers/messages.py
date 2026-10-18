from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Message, Application, Job, User, Notification
from ..schemas import MessageCreate, MessageOut
from ..deps import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _verify_access(app_id: int, user: User, db: Session) -> tuple[Application, Job]:
    app = db.get(Application, app_id)
    if not app:
        raise HTTPException(404, "Application not found")
    job = db.get(Job, app.job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if user.id != app.student_id and user.id != job.employer_id:
        raise HTTPException(403, "Not authorized to view this chat")
    return app, job


@router.get("/application/{app_id}", response_model=List[MessageOut])
def get_messages(app_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _verify_access(app_id, user, db)
    rows = db.query(Message).filter(Message.application_id == app_id).order_by(Message.created_at.asc()).all()
    
    out = []
    for m in rows:
        msg = MessageOut.model_validate(m)
        sender = db.get(User, m.sender_id)
        msg.sender_name = sender.full_name if sender else "Unknown"
        out.append(msg)
    return out


@router.post("/application/{app_id}", response_model=MessageOut)
def send_message(app_id: int, data: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    app, job = _verify_access(app_id, user, db)
    
    m = Message(
        application_id=app_id,
        sender_id=user.id,
        content=data.content.strip()
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    recipient_id = app.student_id if user.id == job.employer_id else job.employer_id
    notif = Notification(
        user_id=recipient_id,
        application_id=app_id,
        type="message", # <--- ADDED
        title="New Message",
        content=f"{user.full_name} sent you a message about '{job.title}'.",
    )
    db.add(notif)
    db.commit()
    
    out = MessageOut.model_validate(m)
    out.sender_name = user.full_name
    return out


@router.post("/application/{app_id}/read")
def mark_read(app_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _verify_access(app_id, user, db)
    db.query(Message).filter(
        Message.application_id == app_id,
        Message.sender_id != user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}