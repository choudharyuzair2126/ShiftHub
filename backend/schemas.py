from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: str = "student"
    city: Optional[str] = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    city: str
    phone: str
    bio: str
    skills: List[str] = []
    availability: str
    company_name: str
    is_verified: bool
    resume_path: Optional[str] = ""
    created_at: datetime
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    availability: Optional[str] = None
    company_name: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class JobCreate(BaseModel):
    title: str
    description: str
    category: Optional[str] = "General"
    city: str
    address: Optional[str] = ""
    pay: Optional[str] = ""
    job_type: Optional[str] = "Part-time"
    required_skills: Optional[List[str]] = []
    shift: Optional[str] = ""


class JobOut(BaseModel):
    id: int
    title: str
    description: str
    category: str
    city: str
    address: str
    pay: str
    job_type: str
    required_skills: List[str] = []
    shift: str
    is_active: bool
    created_at: datetime
    employer_id: int
    employer_name: Optional[str] = None
    company_name: Optional[str] = None
    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    cover_note: Optional[str] = ""


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    student_id: int
    cover_note: str
    status: str
    match_score: float
    created_at: datetime

    # ---- job enrichment (shown on student's dashboard) ----
    job_title: Optional[str] = None
    job_city: Optional[str] = None
    job_pay: Optional[str] = None
    employer_name: Optional[str] = None
    company_name: Optional[str] = None

    # ---- student enrichment (shown on employer's dashboard) ----
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    student_city: Optional[str] = None
    student_phone: Optional[str] = None
    student_bio: Optional[str] = None
    student_skills: Optional[List[str]] = None
    student_availability: Optional[str] = None
    student_resume_path: Optional[str] = None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []


class ForgotPassword(BaseModel):
    email: EmailStr


class ResetPassword(BaseModel):
    token: str
    new_password: str = Field(min_length=6)