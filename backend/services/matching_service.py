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
    
    # 1. Skills Match (Max 60 points) - Most important factor
    s_skills = _tokenize(student.skills)
    j_skills = _tokenize(job.required_skills)
    if j_skills:
        overlap = len(s_skills & j_skills) / len(j_skills)
        score += overlap * 60
    else:
        score += 20 # Base if job has no specific skills listed

    # 2. City Match (Max 15 points) - Less important than skills
    if student.city and job.city:
        if student.city.lower() == job.city.lower():
            score += 15
        elif student.city.lower() in job.city.lower():
            score += 10
            
    # 3. Experience (Max 15 points)
    if student.experience:
        exp_lower = student.experience.lower().strip()
        # Don't give points just for saying "Fresher"
        if exp_lower and exp_lower not in ["fresher", "none", "0", "no experience"]:
            score += 15
        
    # 4. Education Match (Max 10 points)
    if student.education:
        edu_tokens = _tokenize([student.education])
        job_text = f"{job.title} {job.category} {job.description}".lower()
        if any(token in job_text for token in edu_tokens):
            score += 10
        else:
            score += 5 
            
    # 5. Base Student Score
    if student.role == "student":
        score += 5
        
    return round(min(score, 100), 1)

def rank_jobs(student: User, jobs: List[Job]) -> List[dict]:
    out = [{"job": j, "score": match_score(student, j)} for j in jobs]
    out.sort(key=lambda x: x["score"], reverse=True)
    return out