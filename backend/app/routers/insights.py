"""Insight endpoints for a KB: exam-frequency analysis (exam papers only) and the
richer cross-document study insights (notes + exams -> ranked high-yield topics).
Both verify KB ownership."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, KnowledgeBase
from ..schemas import (ExamAnalysisResponse, StudyInsightsResponse,
                       StudyPlanRequest, StudyPlanResponse)
from ..rag.exam_analysis import analyze_exams
from ..rag.topic_analysis import analyze_study_topics
from ..rag.study_plan import generate_study_plan

router = APIRouter(prefix="/kb/{kb_id}", tags=["insights"])


def _own(kb_id: int, user: User, db: Session):
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")


@router.get("/exam-analysis", response_model=ExamAnalysisResponse)
def exam_analysis(kb_id: int, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    _own(kb_id, user, db)
    topics = analyze_exams(kb_id)
    if topics is None:
        return ExamAnalysisResponse(has_exams=False, topics=[])
    return ExamAnalysisResponse(has_exams=True, topics=topics)


@router.get("/study-insights", response_model=StudyInsightsResponse)
def study_insights(kb_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    _own(kb_id, user, db)
    topics = analyze_study_topics(kb_id)
    if topics is None:
        return StudyInsightsResponse(has_docs=False, topics=[])
    return StudyInsightsResponse(has_docs=True, topics=topics)


@router.post("/study-plan", response_model=StudyPlanResponse)
def study_plan(kb_id: int, body: StudyPlanRequest, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    _own(kb_id, user, db)
    days = max(1, min(body.days, 30))
    hours = max(1, min(body.hours_per_day, 12))
    plan = generate_study_plan(kb_id, days=days, hours_per_day=hours)
    if plan is None:
        return StudyPlanResponse(has_docs=False)
    return StudyPlanResponse(has_docs=True, overview=plan["overview"], days=plan["days"])
