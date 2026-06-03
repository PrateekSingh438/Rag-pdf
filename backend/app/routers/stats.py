"""Progress stats for the profile + home dashboard, plus recording quiz attempts.

Most numbers are derived from existing tables (messages, documents) so there's no
duplicate bookkeeping; quizzes are recorded in quiz_attempts. Streaks are computed
from the set of calendar days on which the user was active."""
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..models import User, KnowledgeBase, Document, Conversation, Message, QuizAttempt
from ..schemas import (StatsResponse, Badge, WeakTopic, RecentItem,
                       QuizAttemptCreate)

router = APIRouter(prefix="/stats", tags=["stats"])


def _streaks(active_days: set[date]) -> tuple[int, int]:
    """Return (current_streak, longest_streak) from a set of active calendar days."""
    if not active_days:
        return 0, 0
    days = sorted(active_days)
    longest = run = 1
    for prev, cur in zip(days, days[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        longest = max(longest, run)
    # current streak: consecutive days ending today (or yesterday)
    today = date.today()
    current = 0
    if days[-1] in (today, today - timedelta(days=1)):
        cur_day = days[-1]
        s = set(days)
        while cur_day in s:
            current += 1
            cur_day -= timedelta(days=1)
    return current, longest


def _badges(questions: int, docs: int, quizzes: int, best_pct: int, longest: int) -> list[Badge]:
    out = []
    if docs >= 1:
        out.append(Badge(name="First steps", emoji="📤", description="Uploaded your first document"))
    if docs >= 5:
        out.append(Badge(name="Librarian", emoji="📚", description="Uploaded 5+ documents"))
    if questions >= 10:
        out.append(Badge(name="Curious mind", emoji="💡", description="Asked 10+ questions"))
    if quizzes >= 1:
        out.append(Badge(name="Quiz taker", emoji="📋", description="Completed a quiz"))
    if best_pct >= 100:
        out.append(Badge(name="Perfect score", emoji="🏆", description="Scored 100% on a quiz"))
    if longest >= 3:
        out.append(Badge(name="On a roll", emoji="🔥", description="3-day study streak"))
    return out


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    kb_ids = [k.id for k in db.query(KnowledgeBase.id).filter_by(owner_id=user.id).all()]

    questions = 0
    user_msg_dates: list = []
    if kb_ids:
        q = (db.query(Message)
             .join(Conversation, Message.conversation_id == Conversation.id)
             .filter(Conversation.kb_id.in_(kb_ids), Message.role == "user"))
        questions = q.count()
        user_msg_dates = [m.created_at for m in q.all()]

    documents = db.query(Document).filter(Document.kb_id.in_(kb_ids)).count() if kb_ids else 0

    attempts = db.query(QuizAttempt).filter_by(user_id=user.id).all()
    quizzes = len(attempts)
    best_pct = max((round(100 * a.score / a.total) for a in attempts if a.total), default=0)

    active = {d.date() for d in user_msg_dates} | {a.created_at.date() for a in attempts}
    current_streak, longest_streak = _streaks(active)

    # Weak topics: average percentage per topic, lowest first.
    by_topic: dict[str, list[int]] = {}
    for a in attempts:
        if a.total:
            by_topic.setdefault(a.topic or "General", []).append(round(100 * a.score / a.total))
    weak = sorted(
        (WeakTopic(topic=t, avg_pct=round(sum(v) / len(v)), attempts=len(v)) for t, v in by_topic.items()),
        key=lambda w: w.avg_pct,
    )[:5]

    # Recent activity: latest conversations + quiz attempts, merged.
    recent: list[RecentItem] = []
    if kb_ids:
        for c in (db.query(Conversation).filter(Conversation.kb_id.in_(kb_ids))
                  .order_by(Conversation.created_at.desc()).limit(6).all()):
            recent.append(RecentItem(kind="chat", title=c.title, kb_id=c.kb_id, created_at=c.created_at))
    for a in sorted(attempts, key=lambda x: x.created_at, reverse=True)[:6]:
        recent.append(RecentItem(kind="quiz", kb_id=a.kb_id, created_at=a.created_at,
                                 title=f"Quiz: {a.topic} — {a.score}/{a.total}"))
    recent.sort(key=lambda r: r.created_at, reverse=True)
    recent = recent[:8]

    return StatsResponse(
        questions_asked=questions, documents_uploaded=documents, quizzes_taken=quizzes,
        highest_score_pct=best_pct, current_streak=current_streak, longest_streak=longest_streak,
        member_since=user.created_at,
        badges=_badges(questions, documents, quizzes, best_pct, longest_streak),
        weak_topics=weak, recent=recent,
    )


@router.post("/quiz-attempts")
def record_quiz_attempt(body: QuizAttemptCreate, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter_by(id=body.kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    db.add(QuizAttempt(user_id=user.id, kb_id=body.kb_id, topic=body.topic,
                       score=body.score, total=body.total))
    db.commit()
    return {"ok": True}
