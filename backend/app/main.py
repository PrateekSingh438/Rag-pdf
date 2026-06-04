"""FastAPI application entrypoint. Creates the app, enables CORS for the Next.js
frontend, initializes the database on startup, and mounts the feature routers.
Later phases register additional routers here (documents, chat, practice, eval)."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db
from .routers import auth as auth_router
from .routers import knowledge_bases as kb_router
from .routers import documents as documents_router
from .routers import chat as chat_router
from .routers import practice as practice_router
from .routers import eval as eval_router
from .routers import quiz as quiz_router
from .routers import insights as insights_router
from .routers import stats as stats_router
from .routers import models as models_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="StudyMate API", version="0.1.0", lifespan=lifespan)

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
app.include_router(eval_router.router)
app.include_router(quiz_router.router)
app.include_router(insights_router.router)
app.include_router(stats_router.router)
app.include_router(models_router.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
