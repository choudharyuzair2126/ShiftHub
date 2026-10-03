from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=False)
    role = Column(String(20), default="student")
    city = Column(String(80), default="")
    phone = Column(String(30), default="")
    bio = Column(Text, default="")
    skills = Column(JSON, default=list)
    availability = Column(String(80), default="")
    resume_path = Column(String(500), default="")
    company_name = Column(String(120), default="")
    is_verified = Column(Boolean, default=False)
    verify_token = Column(String(64), default="")
    reset_token = Column(String(64), default="")
    reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    jobs = relationship("Job", back_populates="employer", cascade="all,delete")
    applications = relationship("Application", back_populates="student", cascade="all,delete")

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    employer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(60), default="General")
    city = Column(String(80), nullable=False)
    address = Column(String(200), default="")
    pay = Column(String(60), default="")
    job_type = Column(String(40), default="Part-time")
    required_skills = Column(JSON, default=list)
    shift = Column(String(60), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employer = relationship("User", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all,delete")

class Application(Base):
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cover_note = Column(Text, default="")
    status = Column(String(30), default="pending")
    match_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    student = relationship("User", back_populates="applications")