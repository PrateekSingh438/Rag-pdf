"""Practice question generation endpoint. Verifies KB ownership, then generates
questions grounded in that KB's notes via the RAG practice module."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, KnowledgeBase
from ..schemas import PracticeRequest, PracticeResponse
from ..rag.practice import generate_practice_questions

router = APIRouter(prefix="/kb/{kb_id}/practice", tags=["practice"])


@router.post("", response_model=PracticeResponse)
def make_practice(kb_id: int, body: PracticeRequest, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    n = max(1, min(body.n, 20))  # keep the request bounded
    questions = generate_practice_questions(kb_id, body.topic, n=n)
    return PracticeResponse(questions=questions)
