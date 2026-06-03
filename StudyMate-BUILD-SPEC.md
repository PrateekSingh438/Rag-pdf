# StudyMate — Complete Build Specification

An AI study companion. A student signs up, creates a knowledge base per course,
uploads their **notes + previous year question papers (PDFs)**, and then asks
questions. The system answers using **only their uploaded material**, cites the
exact source, links concepts to **past exam questions**, and can generate
**practice questions**. It is a full product (auth, users, document management,
chat history) built on a deliberately simple, fully-explainable RAG core.

This file is the build spec. Open the repo in Claude Code, point it at this file,
and build **phase by phase, verifying each phase before moving on**.

---

## 0. Instructions for Claude Code (READ FIRST)

1. **Build in phase order (Phase 1 → Phase 9). Do NOT scaffold everything at
   once.** After each phase, run its "Acceptance check", show me the result, and
   wait before continuing.
2. **Implement 100% of the code yourself.** The user will not hand-write code.
3. **But keep it explainable.** This project must be defensible in an interview:
   - Add a short docstring at the top of every backend module explaining what it
     does and why.
   - Keep the RAG logic **explicit and readable in this repo**. Do **NOT** use
     LangChain or LlamaIndex. Write the retrieval, reranking, prompt building,
     and generation as plain code.
   - Use libraries only for primitives: embeddings (`sentence-transformers`),
     vector search (`chromadb`), PDF text (`pypdf`), the LLM call (`groq`).
4. **At the end (Phase 9), generate `STUDY_GUIDE.md`** — see §13. This explains
   every concept and lists likely interview questions with answers.
5. Keep it simple. No microservices, no message queues, no Kubernetes. One
   FastAPI backend, one Next.js frontend, one Postgres DB, one Chroma store.
6. All secrets live in `.env` (git-ignored). Never hardcode keys.
7. Reference code below is the intended implementation — follow it closely. Where
   a section says "standard CRUD, follow the pattern", implement it consistently
   with the code that is given.

---

## 1. Tech stack

**Backend (Python 3.11+)**
- `fastapi`, `uvicorn[standard]` — API + SSE streaming
- `sqlalchemy`, `psycopg2-binary` — ORM + PostgreSQL
- `python-jose[cryptography]`, `passlib[bcrypt]`, `python-multipart` — JWT auth + file uploads
- `pydantic-settings`, `python-dotenv` — config
- `sentence-transformers` — embeddings (`BAAI/bge-small-en-v1.5`) + reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
- `chromadb` — embedded vector store (one collection per knowledge base)
- `pypdf` — PDF text extraction
- `groq` — LLM inference (free tier, fast). Provider-agnostic via env.

**Frontend**
- `Next.js` (App Router) + `TypeScript` + `Tailwind CSS`
- `recharts` — evaluation dashboard charts
- Streaming chat via fetch + Server-Sent Events (SSE)

**Infra**
- `Docker` + `docker-compose` for local; AWS (EC2 + RDS, or single EC2) for deploy.

`requirements.txt`:
```
fastapi
uvicorn[standard]
sqlalchemy
psycopg2-binary
pydantic
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
python-multipart
python-dotenv
sentence-transformers
chromadb
pypdf
groq
numpy
```

`backend/.env.example`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studymate
SECRET_KEY=replace-with-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=10080
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=llama-3.3-70b-versatile        # check Groq docs for the current model id
EMBED_MODEL=BAAI/bge-small-en-v1.5
RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
CHROMA_DIR=./chroma_data
UPLOAD_DIR=./uploads
```

---

## 2. Repository structure

```
studymate/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, mounts routers, init DB
│   │   ├── config.py               # settings from .env
│   │   ├── database.py             # engine, session, init_db
│   │   ├── models.py               # SQLAlchemy ORM models
│   │   ├── schemas.py              # Pydantic request/response models
│   │   ├── auth.py                 # JWT + password hashing + current_user dep
│   │   ├── routers/
│   │   │   ├── auth.py             # /auth/register, /auth/login, /auth/me
│   │   │   ├── knowledge_bases.py  # CRUD for knowledge bases
│   │   │   ├── documents.py        # upload, list, delete (background ingest)
│   │   │   ├── chat.py             # streaming chat + conversations + history
│   │   │   └── practice.py         # generate practice questions
│   │   ├── rag/
│   │   │   ├── loader.py           # PDF -> per-page text
│   │   │   ├── chunker.py          # text -> chunks with metadata
│   │   │   ├── store.py            # Chroma + embeddings (per-KB collections)
│   │   │   ├── reranker.py         # cross-encoder reranking
│   │   │   ├── retriever.py        # vector search + rerank
│   │   │   ├── generator.py        # grounded prompt + citations
│   │   │   ├── llm.py              # Groq client (stream + non-stream)
│   │   │   ├── exam_linker.py      # link concepts to past exam questions
│   │   │   └── practice.py         # practice question generation
│   │   ├── services/
│   │   │   └── ingest_service.py   # orchestrates ingestion + DB status
│   │   └── eval/
│   │       ├── dataset.json        # labeled Q/A + gold doc/chunk ids
│   │       ├── run_eval.py         # recall@k, MRR, faithfulness, ablation
│   │       └── results.json        # generated
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                       # Next.js app
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx      # list knowledge bases
│   │   ├── kb/[id]/page.tsx        # documents + chat for one KB
│   │   └── evals/page.tsx          # evaluation dashboard
│   ├── components/                 # ChatPanel, MessageBubble, CitationDrawer, etc.
│   ├── lib/api.ts                  # API client incl. streaming
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 3. Database schema (`app/models.py`)

```python
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
    hashed_password = Column(String, nullable=False)
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
```

`app/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/studymate"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    embed_model: str = "BAAI/bge-small-en-v1.5"
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    chroma_dir: str = "./chroma_data"
    upload_dir: str = "./uploads"
    class Config:
        env_file = ".env"

settings = Settings()
```

`app/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings
from .models import Base

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Phase 1 — Project setup, database, authentication

**Goal:** a running FastAPI server with Postgres, JWT register/login, and a
protected `/auth/me` route.

**Reference code — `app/auth.py`:**
```python
"""JWT authentication: hash/verify passwords, mint tokens, resolve current user."""
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(p: str) -> str: return pwd.hash(p)
def verify_password(p: str, h: str) -> bool: return pwd.verify(p, h)

def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expire},
                      settings.secret_key, algorithm=settings.algorithm)

def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    err = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise err
    user = db.get(User, uid)
    if not user:
        raise err
    return user
```

**`app/routers/auth.py`:** implement `POST /auth/register` (email+password →
create user, return token), `POST /auth/login` (OAuth2 form → verify → token),
`GET /auth/me` (returns current user). Use `schemas.py` Pydantic models for
request/response.

**`app/main.py`:** create FastAPI app, enable CORS for the frontend origin, call
`init_db()` on startup, mount all routers.

**Acceptance check:** register a user via curl, log in to get a token, call
`/auth/me` with the token and get the user back; calling it without a token
returns 401.

---

## Phase 2 — Knowledge bases + document upload + ingestion

**Goal:** authenticated users create knowledge bases, upload PDFs into them, and
the PDFs are chunked + embedded + stored. Document status flips to `ready`.

**`app/rag/loader.py`:**
```python
"""Extract text from a PDF, one entry per page (page numbers power citations)."""
from pypdf import PdfReader

def extract_pages(path: str):
    reader = PdfReader(path)
    return [{"page": i + 1, "text": (pg.extract_text() or "")}
            for i, pg in enumerate(reader.pages)]
```

**`app/rag/chunker.py`:**
```python
"""Split page text into overlapping word-windows. Overlap preserves context that
would otherwise be cut at a chunk boundary. chunk_size/overlap are tunable — this
is what you ablate in evaluation."""
import re

def _clean(t: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", t).strip()

def chunk_document(pages, source_file, doc_type, chunk_size=512, overlap=64):
    chunks, idx = [], 0
    step = max(1, chunk_size - overlap)
    for p in pages:
        text = _clean(p["text"])
        if not text:
            continue
        words = text.split()
        i = 0
        while i < len(words):
            piece = " ".join(words[i:i + chunk_size])
            chunks.append({
                "text": piece,
                "metadata": {"source_file": source_file, "doc_type": doc_type,
                             "page": p["page"], "chunk_index": idx},
            })
            idx += 1
            i += step
    return chunks
```

**`app/rag/store.py`:**
```python
"""Vector storage. Each knowledge base gets its own Chroma collection so users'
data stays isolated. Embeddings are normalized so cosine similarity = dot product."""
import chromadb
from sentence_transformers import SentenceTransformer
from ..config import settings

_embedder = SentenceTransformer(settings.embed_model)
_client = chromadb.PersistentClient(path=settings.chroma_dir)

def _col(kb_id: int):
    return _client.get_or_create_collection(f"kb_{kb_id}",
                                            metadata={"hnsw:space": "cosine"})

def embed(texts):
    return _embedder.encode(texts, normalize_embeddings=True).tolist()

def add_chunks(kb_id: int, doc_id: int, chunks):
    col = _col(kb_id)
    ids = [f"{doc_id}_{c['metadata']['chunk_index']}" for c in chunks]
    docs = [c["text"] for c in chunks]
    metas = [{**c["metadata"], "doc_id": doc_id} for c in chunks]
    col.add(ids=ids, embeddings=embed(docs), documents=docs, metadatas=metas)

def vector_search(kb_id: int, query: str, top_n=10, doc_type=None):
    col = _col(kb_id)
    where = {"doc_type": doc_type} if doc_type else None
    res = col.query(query_embeddings=embed([query]), n_results=top_n,
                    where=where, include=["documents", "metadatas", "distances"])
    if not res["ids"][0]:
        return []
    return [{"id": res["ids"][0][i], "text": res["documents"][0][i],
             "metadata": res["metadatas"][0][i], "score": 1 - res["distances"][0][i]}
            for i in range(len(res["ids"][0]))]

def delete_document(kb_id: int, doc_id: int):
    _col(kb_id).delete(where={"doc_id": doc_id})
```

**`app/services/ingest_service.py`:**
```python
"""Run after a file is saved. Chunk + embed + store, then update DB status.
Called as a FastAPI BackgroundTask so the upload request returns immediately."""
from ..rag.loader import extract_pages
from ..rag.chunker import chunk_document
from ..rag.store import add_chunks
from ..database import SessionLocal
from ..models import Document

def ingest_document(doc_id: int, path: str, kb_id: int, source_file: str, doc_type: str):
    db = SessionLocal()
    try:
        pages = extract_pages(path)
        chunks = chunk_document(pages, source_file, doc_type)
        add_chunks(kb_id, doc_id, chunks)
        doc = db.get(Document, doc_id)
        doc.num_chunks, doc.status = len(chunks), "ready"
        db.commit()
    except Exception:
        doc = db.get(Document, doc_id)
        if doc:
            doc.status = "failed"; db.commit()
        raise
    finally:
        db.close()
```

**`app/routers/knowledge_bases.py`:** standard CRUD, follow the pattern — all
routes depend on `get_current_user` and filter by `owner_id` so a user can only
see their own. Endpoints: `POST /kb`, `GET /kb`, `GET /kb/{id}`, `DELETE /kb/{id}`.

**`app/routers/documents.py`:** `POST /kb/{kb_id}/documents` accepts a file
upload + a `doc_type` form field ("notes"/"exam"), verifies KB ownership, saves
the file to `UPLOAD_DIR`, creates a `Document` row (`status="processing"`), and
schedules `ingest_document` via `BackgroundTasks`. Also `GET /kb/{kb_id}/documents`
(list with status) and `DELETE .../documents/{doc_id}` (remove row + file +
`store.delete_document`).

**Acceptance check:** create a KB, upload a small PDF, poll the documents list and
watch status go `processing → ready` with `num_chunks > 0`.

---

## Phase 3 — Retrieval + reranking

**Goal:** given a question, return the best chunks. Vector search casts a wide
net; the cross-encoder reranker reorders the candidates more accurately.

**`app/rag/reranker.py`:**
```python
"""Cross-encoder reranking. A bi-encoder (the embedder) is fast but compares the
query and chunk separately; a cross-encoder reads them together and scores
relevance far more accurately. We rerank the top_n candidates down to top_k."""
from sentence_transformers import CrossEncoder
from ..config import settings

_reranker = CrossEncoder(settings.rerank_model)

def rerank(query: str, hits, top_k=5):
    if not hits:
        return []
    scores = _reranker.predict([[query, h["text"]] for h in hits])
    for h, s in zip(hits, scores):
        h["rerank_score"] = float(s)
    return sorted(hits, key=lambda h: h["rerank_score"], reverse=True)[:top_k]
```

**`app/rag/retriever.py`:**
```python
"""Retrieval pipeline: vector search (top_n) -> optional rerank -> top_k.
use_reranker is a flag so the eval harness can measure its impact."""
from .store import vector_search
from .reranker import rerank

def retrieve(kb_id, query, top_n=10, top_k=5, use_reranker=True, doc_type=None):
    hits = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    return rerank(query, hits, top_k=top_k) if use_reranker else hits[:top_k]
```

**Acceptance check:** add a temporary debug route or script that calls
`retrieve(kb_id, "some question")` and prints chunk text + scores. Toggling
`use_reranker` visibly changes the ordering.

---

## Phase 4 — Grounded generation + citations

**Goal:** answer using only retrieved chunks, with inline citations and an
"I don't know" path.

**`app/rag/llm.py`:**
```python
"""Groq LLM client. chat() for one-shot calls (eval, practice questions),
chat_stream() yields tokens for the streaming chat endpoint."""
from groq import Groq
from ..config import settings

_client = Groq(api_key=settings.groq_api_key)

def chat(messages, temperature=0.2, max_tokens=1024) -> str:
    r = _client.chat.completions.create(model=settings.groq_model, messages=messages,
                                        temperature=temperature, max_tokens=max_tokens)
    return r.choices[0].message.content

def chat_stream(messages, temperature=0.2, max_tokens=1024):
    stream = _client.chat.completions.create(model=settings.groq_model,
                                             messages=messages, temperature=temperature,
                                             max_tokens=max_tokens, stream=True)
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
```

**`app/rag/generator.py`:**
```python
"""Builds the grounded prompt. The system prompt forbids outside knowledge and
forces citations + an explicit 'not found' answer — this is what kills
hallucination. Sources are labeled [S1], [S2]... and echoed back as citations."""
SYSTEM_PROMPT = (
    "You are StudyMate, a study assistant. Answer the student's question using "
    "ONLY the provided sources.\n"
    "Rules:\n"
    "- Use only information in the sources below. Do not use outside knowledge.\n"
    "- Cite sources inline using their tags, e.g. [S1], [S2].\n"
    "- If the sources do not contain the answer, reply exactly: "
    "\"I couldn't find this in your uploaded documents.\"\n"
    "- Be clear and concise, like good revision notes."
)

def _context(hits) -> str:
    out = []
    for i, h in enumerate(hits, 1):
        m = h["metadata"]
        out.append(f"[S{i}] (from {m['source_file']}, page {m.get('page', '?')})\n{h['text']}")
    return "\n\n".join(out)

def build_messages(question, hits):
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Sources:\n\n{_context(hits)}\n\nQuestion: {question}"},
    ]

def citations_from_hits(hits):
    cites = []
    for i, h in enumerate(hits, 1):
        m = h["metadata"]
        cites.append({"tag": f"S{i}", "source_file": m["source_file"],
                      "page": m.get("page"), "doc_type": m.get("doc_type"),
                      "snippet": h["text"][:300]})
    return cites
```

**Acceptance check:** a script that retrieves for an in-domain question and prints
the grounded answer + citations; an off-domain question returns the "couldn't
find this" message.

---

## Phase 5 — Streaming chat API + conversation history

**Goal:** a `/chat/{kb_id}` endpoint that streams tokens (SSE), then sends a final
event with citations + exam links, and persists the conversation + messages.

**`app/rag/exam_linker.py`:**
```python
"""Domain feature: surface past exam questions related to the concept by
retrieving specifically from documents tagged doc_type='exam'."""
from .retriever import retrieve

def find_related_exam_questions(kb_id, query, top_k=3):
    hits = retrieve(kb_id, query, top_n=10, top_k=top_k, use_reranker=True, doc_type="exam")
    return [{"source_file": h["metadata"]["source_file"], "page": h["metadata"].get("page"),
             "snippet": h["text"][:300]} for h in hits]
```

**`app/routers/chat.py`:**
```python
"""Streaming chat. Retrieve -> build prompt -> stream tokens -> persist -> send
final metadata (citations + exam links). DB writes happen in a fresh session
inside the generator because the request-scoped session closes when streaming
starts."""
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..auth import get_current_user
from ..models import User, KnowledgeBase, Conversation, Message
from ..rag.retriever import retrieve
from ..rag.generator import build_messages, citations_from_hits
from ..rag.llm import chat_stream
from ..rag.exam_linker import find_related_exam_questions

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/{kb_id}")
def chat(kb_id: int, payload: dict, db: Session = Depends(get_db),
         user: User = Depends(get_current_user)):
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    question = payload["question"]
    conversation_id = payload.get("conversation_id")

    hits = retrieve(kb_id, question, top_n=10, top_k=5, use_reranker=True)
    citations = citations_from_hits(hits)
    exam_links = find_related_exam_questions(kb_id, question)
    messages = build_messages(question, hits)

    def stream():
        full = ""
        for tok in chat_stream(messages):
            full += tok
            yield f"data: {json.dumps({'type': 'token', 'content': tok})}\n\n"
        # persist with a fresh session
        s = SessionLocal()
        try:
            conv = s.get(Conversation, conversation_id) if conversation_id else None
            if not conv:
                conv = Conversation(kb_id=kb_id, title=question[:60])
                s.add(conv); s.flush()
            s.add(Message(conversation_id=conv.id, role="user", content=question))
            s.add(Message(conversation_id=conv.id, role="assistant",
                          content=full, citations=json.dumps(citations)))
            s.commit()
            cid = conv.id
        finally:
            s.close()
        yield ("data: " + json.dumps({"type": "done", "conversation_id": cid,
               "citations": citations, "exam_links": exam_links}) + "\n\n")

    return StreamingResponse(stream(), media_type="text/event-stream")
```

Also add (standard CRUD, follow the pattern): `GET /chat/conversations?kb_id=`
(list a KB's conversations), `GET /chat/conversations/{id}` (messages, parse
`citations` JSON), `DELETE /chat/conversations/{id}`.

**Acceptance check:** `curl -N` the chat route and observe streamed `token`
events followed by a `done` event with citations + exam_links; the conversation
and messages appear in the DB.

---

## Phase 6 — Practice question generation

**`app/rag/practice.py`:**
```python
"""Domain feature: generate practice questions grounded in the student's notes."""
from .retriever import retrieve
from .llm import chat

_PROMPT = (
    "Using ONLY the study material below, write {n} practice questions on the "
    "topic, mixing easy/medium/hard. For each, give the question and a short "
    "answer. Use only the material; do not invent facts.\n\n"
    "Material:\n{material}\n\nTopic: {topic}"
)

def generate_practice_questions(kb_id, topic, n=5):
    hits = retrieve(kb_id, topic, top_n=12, top_k=6, use_reranker=True, doc_type="notes")
    if not hits:
        return "I couldn't find this topic in your uploaded notes."
    material = "\n\n".join(h["text"] for h in hits)
    return chat([{"role": "user", "content": _PROMPT.format(n=n, material=material, topic=topic)}],
                temperature=0.4, max_tokens=1200)
```

**`app/routers/practice.py`:** `POST /kb/{kb_id}/practice` body `{topic, n}` →
verify ownership → return generated questions.

**Acceptance check:** request practice questions for a topic in the notes and get
a sensible numbered list grounded in the material.

---

## Phase 7 — Frontend (Next.js)

Scaffold with `create-next-app` (TypeScript + Tailwind). Build clean, modern,
mobile-responsive pages. Follow good frontend design practices (clear hierarchy,
consistent spacing, accessible components). Store the JWT in memory/context (and
optionally a cookie); redirect to `/login` when unauthenticated.

**The one tricky part — streaming SSE consumption — `lib/api.ts`:**
```typescript
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function streamChat(
  kbId: number, question: string, token: string, conversationId: number | null,
  onToken: (t: string) => void,
  onDone: (m: { conversation_id: number; citations: any[]; exam_links: any[] }) => void,
) {
  const res = await fetch(`${API}/chat/${kbId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, conversation_id: conversationId }),
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      const data = JSON.parse(part.slice(6));
      if (data.type === "token") onToken(data.content);
      else if (data.type === "done") onDone(data);
    }
  }
}
```

**Pages & components to build:**
- `login/` and `register/` — auth forms hitting `/auth/login` and `/auth/register`.
- `dashboard/` — list knowledge bases; "create KB" button; click a KB → its page.
- `kb/[id]/` — the main workspace, split layout:
  - **Documents panel:** drag-and-drop upload with a `doc_type` toggle
    (notes/exam), list of documents with status badges (processing/ready/failed),
    delete buttons.
  - **Chat panel:** message list with streaming assistant bubbles; citations
    render as clickable chips `[S1]`; below each answer an **"Appeared in your
    exams"** section listing `exam_links`; a sidebar of past conversations.
  - **CitationDrawer:** clicking a chip opens a drawer showing the cited snippet,
    source file, page, and doc type. (Stretch: render the PDF page and highlight
    the snippet.)
  - **Practice button:** opens a small dialog to enter a topic + count, calls
    `/practice`, shows the generated questions.
- `evals/` — the dashboard from Phase 8.

**Acceptance check:** full flow in the browser — register, create a KB, upload a
notes PDF and an exam PDF, ask a question, watch it stream, click a citation, see
the exam-link section, and generate practice questions.

---

## Phase 8 — Evaluation harness + dashboard

**Goal:** prove the system works with numbers, and show the reranker's impact.

**`app/eval/dataset.json`** — ~30–50 entries:
```json
[
  {"question": "What is a binary search tree?",
   "ideal_answer": "A BST is a binary tree where left < node < right ...",
   "gold_doc": "DS_notes.pdf"}
]
```
(`gold_doc` = the file that should be retrieved. Auto-draft a starter set from the
chunks, then mark `needs_human_review: true` so the user curates it.)

**`app/eval/run_eval.py`** computes, per configuration:
- **Retrieval:** `recall@k`, `hit_rate@k`, `MRR` — did a chunk from `gold_doc`
  appear in the retrieved top-k? (computed directly, no LLM)
- **Faithfulness:** LLM-as-judge using `llm.chat` — given the answer and the
  retrieved context, is every claim supported? 0–1 score.
- Runs an **ablation**: `{chunk_size: [256, 512]} × {use_reranker: [true, false]}`
  and writes all results to `results.json`.

Add `GET /eval` to return `results.json`. The `evals/` page renders metric cards
and `recharts` bar charts comparing configurations (this is the demo centerpiece).

**Acceptance check:** `python -m app.eval.run_eval` writes `results.json`; the
ablation clearly shows reranking improving recall@k.

---

## Phase 9 — Deployment + docs

**`backend/Dockerfile`:** python:3.11-slim, install requirements, copy app,
`uvicorn app.main:app --host 0.0.0.0 --port 8000`.
**`frontend/Dockerfile`:** node base, build Next.js, `next start`.
**`docker-compose.yml`:** services `db` (postgres:16), `backend`, `frontend`;
volumes for Postgres data, Chroma data, and uploads; pass env from `.env`.

**Local run:** `docker compose up --build`, then ingest works through the UI.

**AWS deploy (simplest path):**
1. Launch one EC2 instance (t3.small is enough; ~$15/mo, or t3.micro on free tier
   for light use). Install Docker + docker compose.
2. Either run all three containers via `docker compose up -d` on the instance, OR
   use **RDS Postgres** for the DB and run only backend+frontend on EC2 (set
   `DATABASE_URL` to the RDS endpoint).
3. Persist Chroma + uploads on an attached EBS volume (mount into the backend
   container) so data survives restarts.
4. Open ports 80/443; put Nginx (or a simple reverse proxy) in front, point your
   domain at the instance, add HTTPS with Let's Encrypt.
5. Set all secrets via the instance's `.env` (never commit them).

Document this in `README.md` with architecture, setup, run commands, screenshots
(chat + citation drawer + evals dashboard), a "How it works" section, and a
"Future work" list (hybrid search, Qdrant/pgvector, caching, PDF highlight).

**Acceptance check:** the app is reachable at a public URL; register → upload →
ask → cite works end-to-end in the cloud.

---

## 13. Generate `STUDY_GUIDE.md` (do this in Phase 9)

Create `STUDY_GUIDE.md` so the user can defend the project. It must cover:
- **Concept explainers (plain language):** embeddings & cosine similarity;
  chunking and the size/overlap trade-off; vector store & nearest-neighbor
  search; bi-encoder vs cross-encoder reranking; the grounding prompt and how it
  prevents hallucination; recall@k / MRR / faithfulness.
- **Data flow walkthrough:** trace one question from the browser through retrieve
  → rerank → prompt → stream → persist → citations, naming the file responsible
  at each step.
- **Why-this-design notes:** why per-KB Chroma collections; why background
  ingestion; why JWT; why reranking; why store citations as JSON.
- **Likely interview questions with crisp answers**, e.g.: "Why hybrid... wait,
  why only vector search?" "What happens if retrieval returns nothing?" "How do
  you stop hallucination?" "How did you measure quality and what improved it?"
  "How would you scale this?" "Why a cross-encoder reranker over just embeddings?"

---

## 14. Resume bullets (fill in your measured numbers)

- Built **StudyMate**, a full-stack AI study assistant (FastAPI + Next.js +
  PostgreSQL) with JWT auth, multi-knowledge-base document management, and
  streaming chat, deployed on AWS.
- Implemented a **RAG pipeline from scratch** — chunking, sentence-transformer
  embeddings, Chroma vector search, and **cross-encoder reranking** — producing
  grounded, **cited** answers with an explicit "not found" path to suppress
  hallucination.
- Added domain features (concept→past-exam-question linking, grounded practice-
  question generation) and an **evaluation harness** (recall@k, MRR, faithfulness)
  whose ablation showed reranking improved recall@5 from `__` to `__`.
