from typing import List
from ..models import Job, User

def _tokenize(items: List[str]) -> set:
    out = set()
    for i in items or []:
        for t in str(i).lower().replace(",", " ").split():
            if t: out.add(t.strip())
    return out

def match_score(student: User, job: Job) -> float:
    score = 0.0
    s_skills = _tokenize(student.skills)
    j_skills = _tokenize(job.required_skills)
    if j_skills:
        overlap = len(s_skills & j_skills) / len(j_skills)
        score += overlap * 55
    else:
        score += 30
    if student.city and job.city and student.city.lower() == job.city.lower():
        score += 30
    elif student.city and job.city and student.city.lower() in job.city.lower():
        score += 15
    if student.availability and job.shift:
        if student.availability.lower() in job.shift.lower() or job.shift.lower() in student.availability.lower():
            score += 15
    if student.role == "student":
        score += 5
    return round(min(score, 100), 1)

def rank_jobs(student: User, jobs: List[Job]) -> List[dict]:
    out = [{"job": j, "score": match_score(student, j)} for j in jobs]
    out.sort(key=lambda x: x["score"], reverse=True)
    return out