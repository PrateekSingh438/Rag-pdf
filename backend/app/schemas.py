"""Pydantic request/response models — the API's typed contract, kept separate
from the ORM models. Phase 1 covers auth; later phases extend this file."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str | None = None
    institution: str | None = None
    picture: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    name: str | None = None
    institution: str | None = None
    picture: str | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


# ---- Progress / stats ----
class Badge(BaseModel):
    name: str
    emoji: str
    description: str


class WeakTopic(BaseModel):
    topic: str
    avg_pct: int
    attempts: int


class RecentItem(BaseModel):
    kind: str  # "chat" | "quiz"
    title: str
    kb_id: int | None = None
    created_at: datetime


class StatsResponse(BaseModel):
    questions_asked: int
    documents_uploaded: int
    quizzes_taken: int
    highest_score_pct: int
    current_streak: int
    longest_streak: int
    member_since: datetime
    badges: list[Badge]
    weak_topics: list[WeakTopic]
    recent: list[RecentItem]


class QuizAttemptCreate(BaseModel):
    kb_id: int
    topic: str
    score: int
    total: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Knowledge bases ----
class KBCreate(BaseModel):
    name: str


class KBOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---- Documents ----
class DocumentOut(BaseModel):
    id: int
    filename: str
    doc_type: str
    status: str
    error: str | None = None
    num_chunks: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ---- Chat / conversations ----
class ChatRequest(BaseModel):
    question: str
    conversation_id: int | None = None


class ConversationUpdate(BaseModel):
    title: str


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    citations: list = []
    verification: dict | None = None
    created_at: datetime


class ConversationDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    messages: list[MessageOut]


# ---- Practice questions ----
class PracticeRequest(BaseModel):
    topic: str
    n: int = 5


class PracticeResponse(BaseModel):
    questions: str


# ---- Quiz ----
class QuizRequest(BaseModel):
    topic: str
    n: int = 5


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str = ""


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


# ---- Exam analysis ----
class ExamTopic(BaseModel):
    topic: str
    count: int
    example: str = ""


class ExamAnalysisResponse(BaseModel):
    has_exams: bool
    topics: list[ExamTopic]


# ---- Study (cross-document) topic insights ----
class StudyTopic(BaseModel):
    topic: str
    exam_frequency: int
    in_notes: bool
    importance: str  # high | medium | low
    example: str = ""


class StudyInsightsResponse(BaseModel):
    has_docs: bool
    topics: list[StudyTopic]


# ---- Study plan ----
class StudyPlanRequest(BaseModel):
    days: int = 7
    hours_per_day: int = 2


class StudyPlanDay(BaseModel):
    day: int
    focus: str
    topics: list[str] = []
    tasks: list[str] = []


class StudyPlanResponse(BaseModel):
    has_docs: bool
    overview: str = ""
    days: list[StudyPlanDay] = []
