"""Database engine, session factory, and helpers.

Exposes `engine`, `SessionLocal` (request/worker sessions), `init_db` (create
tables on startup), and `get_db` (FastAPI dependency yielding a scoped session).

The engine adapts to the DATABASE_URL scheme: SQLite needs check_same_thread=False
because FastAPI serves requests from a threadpool; Postgres needs no special args.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from .config import settings
from .models import Base

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _ensure_user_columns():
    """Tiny additive migration: add profile columns to an existing users table.
    create_all() only creates missing tables, not new columns, so we add them by
    hand (works for SQLite and Postgres). Safe to run on every startup."""
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("users")}
    for col in ("name", "institution", "picture"):
        if col not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} VARCHAR"))


def _is_postgres() -> bool:
    return not settings.database_url.startswith("sqlite")


def _ensure_vector_index():
    """An approximate-nearest-neighbour index keeps similarity search fast as the
    chunk table grows. Best-effort: requires pgvector >= 0.5 (Neon has it)."""
    if not _is_postgres():
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw "
                "ON chunks USING hnsw (embedding vector_cosine_ops)"
            ))
    except Exception:
        pass


def init_db():
    # The pgvector extension must exist before create_all() builds the vector column.
    if _is_postgres():
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    _ensure_user_columns()
    _ensure_vector_index()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
