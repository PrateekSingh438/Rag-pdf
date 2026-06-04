"""SQLAlchemy ORM models. One user -> many knowledge bases -> many documents
and conversations. Conversations hold messages. Citations are stored as JSON."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)  # random/unusable for OAuth users
    name = Column(String, nullable=True)              # display name (profile / Google)
    institution = Column(String, nullable=True)       # user-editable profile field
    picture = Column(String, nullable=True)           # avatar URL (from Google)
    created_at = Column(DateTime, default=datetime.utcnow)
    knowledge_bases = relationship("KnowledgeBase", back_populates="owner",
                                   cascade="all, delete-orphan")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)            # e.g. "Data Structures"
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="knowledge_bases")
    documents = relationship("Document", back_populates="kb",
                             cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="kb",
                                 cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    filename = Column(String, nullable=False)
    doc_type = Column(String, default="notes")       # "notes" | "exam"
    status = Column(String, default="processing")    # processing | ready | failed
    num_chunks = Column(Integer, default=0)
    kb_id = Column(Integer, ForeignKey("knowledge_bases.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    kb = relationship("KnowledgeBase", back_populates="documents")


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True)
    title = Column(String, default="New chat")
    kb_id = Column(Integer, ForeignKey("knowledge_bases.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    kb = relationship("KnowledgeBase", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation",
                            cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String)                            # "user" | "assistant"
    content = Column(Text)
    citations = Column(Text, default="[]")           # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation = relationship("Conversation", back_populates="messages")


class QuizAttempt(Base):
    """One completed quiz, recorded for progress stats (scores, streaks, weak topics)."""
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    kb_id = Column(Integer, ForeignKey("knowledge_bases.id"))
    topic = Column(String)
    score = Column(Integer)
    total = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class SiteStat(Base):
    """Single-row, site-wide counters (e.g. total visits) shown as social proof on
    the landing page and the profile's community card."""
    __tablename__ = "site_stats"
    id = Column(Integer, primary_key=True)
    visits = Column(Integer, default=0)
