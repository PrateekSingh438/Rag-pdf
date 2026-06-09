"""Database engine, session factory, and helpers.

Exposes `engine`, `SessionLocal` (request/worker sessions), `init_db` (create
tables on startup), and `get_db` (FastAPI dependency yielding a scoped session).

The engine adapts to the DATABASE_URL scheme: SQLite needs check_same_thread=False
because FastAPI serves requests from a threadpool; Postgres needs no special args.
"""
import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from .config import settings
from .models import Base

logger = logging.getLogger(__name__)

connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _ensure_columns(table: str, columns: tuple[str, ...]):
    """Tiny additive migration: add missing VARCHAR columns to an existing table.
    create_all() only creates missing tables, not new columns, so we add them by
    hand (works for SQLite and Postgres). Safe to run on every startup."""
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    for col in columns:
        if col not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} VARCHAR"))


def is_postgres() -> bool:
    return not settings.database_url.startswith("sqlite")


def _ensure_vector_index():
    """An approximate-nearest-neighbour index keeps similarity search fast as the
    chunk table grows. Best-effort: requires pgvector >= 0.5 (Neon has it)."""
    if not is_postgres():
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw "
                "ON chunks USING hnsw (embedding vector_cosine_ops)"
            ))
    except Exception:
        logger.warning("Could not create HNSW vector index", exc_info=True)


def _ensure_text_index():
    """GIN index over to_tsvector(text) so the hybrid retriever's keyword leg is an
    indexed full-text query instead of an in-memory scan of every chunk."""
    if not is_postgres():
        return
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS chunks_text_fts "
                "ON chunks USING gin (to_tsvector('english', text))"
            ))
    except Exception:
        logger.warning("Could not create full-text search index", exc_info=True)


def init_db():
    # The pgvector extension must exist before create_all() builds the vector column.
    if is_postgres():
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    _ensure_columns("users", ("name", "institution", "picture"))
    _ensure_columns("documents", ("error",))
    _ensure_vector_index()
    _ensure_text_index()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
