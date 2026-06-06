"""Quiz endpoint. Verifies KB ownership, then returns structured multiple-choice
questions grounded in that KB's notes for the interactive quiz UI."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, KnowledgeBase
from ..schemas import QuizRequest, QuizResponse
from ..rag.quiz import generate_quiz
from ..ratelimit import limiter

router = APIRouter(prefix="/kb/{kb_id}/quiz", tags=["quiz"])


@router.post("", response_model=QuizResponse)
@limiter.limit("20/minute")
def make_quiz(request: Request, kb_id: int, body: QuizRequest,
              db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    n = max(1, min(body.n, 15))
    return QuizResponse(questions=generate_quiz(kb_id, body.topic, n=n))
