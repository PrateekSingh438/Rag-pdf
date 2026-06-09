"""FastAPI application entrypoint. Creates the app, enables CORS for the Next.js
frontend, initializes the database on startup, and mounts the feature routers.

On startup it also (a) flips any documents left mid-ingestion by a previous
process back to "failed" so they can be retried, and (b) warms the embedding and
reranker models in a background thread so the first real request isn't slow."""
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy import func
from .config import settings
from .database import init_db, is_postgres, SessionLocal
from .models import Document, Chunk

logger = logging.getLogger(__name__)

# JWTs signed with a known default key are forgeable by anyone who reads the
# repo. Refuse to start against a real (Postgres) database without a real key;
# SQLite is treated as throwaway local dev and only warned about.
_PLACEHOLDER_KEYS = {"", "change-me", "replace-with-a-long-random-string"}


def _check_secret_key() -> None:
    if settings.secret_key not in _PLACEHOLDER_KEYS:
        return
    if is_postgres():
        raise RuntimeError(
            "SECRET_KEY is unset or a placeholder. Set a long random SECRET_KEY "
            "in backend/.env (e.g. `openssl rand -hex 32`) before starting.")
    logger.warning("SECRET_KEY is a placeholder — fine for local SQLite dev only.")
from .ratelimit import limiter
from .routers import auth as auth_router
from .routers import knowledge_bases as kb_router
from .routers import documents as documents_router
from .routers import chat as chat_router
from .routers import practice as practice_router
from .routers import quiz as quiz_router
from .routers import insights as insights_router
from .routers import stats as stats_router
from .routers import models as models_router


def _recover_stuck_documents() -> None:
    """Background ingestion runs in-process, so a restart leaves any in-flight
    document stuck on "processing" forever. Flip those to "failed" so the UI
    offers a Retry instead of an endless spinner."""
    db = SessionLocal()
    try:
        stuck = db.query(Document).filter_by(status="processing").all()
        for d in stuck:
            d.status = "failed"
            d.error = "Processing was interrupted by a server restart — retry."
        if stuck:
            db.commit()
            logger.info("Recovered %d document(s) stuck in 'processing'", len(stuck))
    except Exception:
        logger.exception("Failed to recover stuck documents")
    finally:
        db.close()


def _reconcile_documents() -> None:
    """A document marked "ready" but with no vectors in the DB is an orphan — e.g.
    one ingested before vectors moved into Postgres, whose old on-disk store is
    gone. Flip those to "failed" so the UI prompts a re-upload instead of silently
    answering "not found"."""
    db = SessionLocal()
    try:
        for doc in db.query(Document).filter_by(status="ready").all():
            if not db.query(func.count(Chunk.id)).filter_by(doc_id=doc.id).scalar():
                doc.status, doc.num_chunks = "failed", 0
                doc.error = "Search data for this document was lost — retry to rebuild it."
        db.commit()
    except Exception:
        logger.exception("Document/vector reconciliation failed")
    finally:
        db.close()


def _warm_models() -> None:
    """Exercise the embedder + reranker once so the first chat doesn't pay the
    cold-start cost. Best-effort; failures here must never block the app."""
    try:
        from .rag.store import embed
        from .rag.reranker import rerank
        embed(["warmup"])
        rerank("warmup", [{"text": "warmup"}], top_k=1)
    except Exception:
        logger.warning("Model warmup failed (first request will be slow)", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _check_secret_key()
    init_db()
    _recover_stuck_documents()
    _reconcile_documents()
    threading.Thread(target=_warm_models, daemon=True).start()
    yield


app = FastAPI(title="StudyMate API", version="0.1.0", lifespan=lifespan)

# Per-IP rate limiting (see ratelimit.py). Only routes decorated with
# @limiter.limit(...) are throttled; /health and everything else are exempt.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Also allow Vercel preview/production deployments without listing each one.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(kb_router.router)
app.include_router(documents_router.router)
app.include_router(chat_router.router)
app.include_router(practice_router.router)
app.include_router(quiz_router.router)
app.include_router(insights_router.router)
app.include_router(stats_router.router)
app.include_router(models_router.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
