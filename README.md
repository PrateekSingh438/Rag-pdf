# StudyMate — AI Study Companion

StudyMate is a full-stack RAG application. A student signs up, creates a knowledge
base per course, uploads their **notes and previous-year question papers (PDFs)**,
and then asks questions. The system answers using **only their uploaded material**,
**cites the exact source** (file + page), links concepts to **related past exam
questions**, and can generate **grounded practice questions and quizzes** — all on
top of a deliberately simple, fully-explainable RAG core (no LangChain / LlamaIndex).

> Built phase-by-phase from a spec. The retrieval, reranking, prompt building, and
> generation are written as plain, readable code so the whole pipeline is
> defensible. See **[STUDY_GUIDE.md](STUDY_GUIDE.md)** for concept explainers and
> interview Q&A.

---

## Features

- **JWT auth** — register / login / protected routes.
- **Multi-knowledge-base document management** — one Chroma collection per KB for
  hard data isolation; upload notes & exam PDFs with live `processing -> ready`
  status (background ingestion).
- **Streaming grounded chat (SSE)** — token-by-token answers with inline `[S1]`
  citations, an explicit "I couldn't find this" path, persisted conversation
  history, and **multi-turn memory** so follow-ups ("explain that again") work.
- **Markdown + LaTeX answers** — formatted, math-aware rendering via KaTeX.
- **Concept -> past-exam linking** — surfaces related questions from your uploaded
  exam papers.
- **Practice questions** and **interactive quizzes** — grounded in your notes, with
  scored multiple-choice and explanations.
- **Exam insights** — mines your past papers for the highest-yield (most tested)
  topics.
- **Evaluation dashboard** — recall@k, hit-rate@k, MRR, and LLM-judge faithfulness
  across a chunk-size x reranker ablation, charted with recharts.

---

## Architecture

```
                Next.js (App Router, TS, Tailwind)            -- http/SSE --+
  Browser --------------------------------------------------------------------+
                                                                            |
              FastAPI (JWT, routers)                                        |
                 |                                                          v
                 +-- auth / knowledge_bases / documents / chat / practice / quiz / insights / eval
                 |
   RAG core -----+-- loader (pypdf) -> chunker -> store (Chroma + bge-small embeddings)
   (plain code)  |            retriever -> reranker (cross-encoder)
                 |            generator (grounded prompt + citations) -> llm (Groq, stream)
                 |
   Postgres <----+  users . knowledge_bases . documents . conversations . messages
   Chroma  <------  one collection per knowledge base  (kb_{id})
```

**Stack:** FastAPI · SQLAlchemy · PostgreSQL · ChromaDB · `sentence-transformers`
(`BAAI/bge-small-en-v1.5` embeddings, `cross-encoder/ms-marco-MiniLM-L-6-v2`
reranker) · `pypdf` · Groq LLM · Next.js + TypeScript + Tailwind + recharts +
react-markdown/KaTeX.

---

## Repository structure

```
backend/
  app/
    main.py · config.py · database.py · models.py · schemas.py · auth.py
    routers/   auth · knowledge_bases · documents · chat · practice · quiz · insights · eval
    rag/       loader · chunker · store · reranker · retriever · generator · llm
               · exam_linker · practice · quiz · exam_analysis
    services/  ingest_service
    eval/      corpus.py · dataset.json · run_eval.py · results.json
  tests/       make_sample_pdfs.py · debug_retrieve.py · debug_generate.py · fixtures/
  Dockerfile · requirements.txt · .env.example
frontend/
  app/         login · register · dashboard · kb/[id] · evals
  components/  NavBar · AuthForm · DocumentsPanel · ChatPanel · MessageBubble
               · MarkdownMessage · CitationDrawer · PracticeDialog · QuizDialog
               · ExamInsightsDialog · ui
  lib/         api.ts (incl. SSE streaming) · auth.tsx
  Dockerfile
docker-compose.yml
```

---

## Quick start

### Option A — Docker (everything: Postgres + backend + frontend)

```bash
cp .env.example .env          # set GROQ_API_KEY and a long SECRET_KEY
docker compose up --build
# Frontend -> http://localhost:3000   Backend -> http://localhost:8000/docs
```
> First request downloads the embedding/reranker models into a cached volume.

### Option B — Local dev (no Docker)

**Backend** (Python 3.11+). Locally we default to **SQLite** so you need no Postgres:
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # (Windows; use source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
cp .env.example .env          # set GROQ_API_KEY; set DATABASE_URL=sqlite:///./studymate.db for local
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node 18+):
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                    # http://localhost:3000
```

**Sample data:** `python -m tests.make_sample_pdfs` writes `tests/fixtures/DS_notes.pdf`
and `DS_exam.pdf` you can upload to try the flow.

---

## Environment variables (`backend/.env`)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql://...` (prod) or `sqlite:///./studymate.db` (local) |
| `SECRET_KEY` | JWT signing secret (use a long random string) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token lifetime (default 10080 = 7 days) |
| `GROQ_API_KEY` | Groq key (free tier at console.groq.com) |
| `GROQ_MODEL` | e.g. `llama-3.3-70b-versatile` |
| `EMBED_MODEL` / `RERANK_MODEL` | sentence-transformer model ids |
| `CHROMA_DIR` / `UPLOAD_DIR` | local storage paths |

---

## How it works (the RAG pipeline)

1. **Ingest** — `loader` extracts text per page; `chunker` splits pages into
   overlapping word windows (512 / 64); `store` embeds them with `bge-small`
   (normalized -> cosine = dot product) into the KB's Chroma collection. Runs as a
   background task so uploads return instantly.
2. **Retrieve + rerank** — embed the question, HNSW nearest-neighbor search for the
   top-10 candidates (`retriever`/`store`), then a **cross-encoder** rescores them
   and keeps the top-5 (`reranker`). Short follow-ups fold in the previous question
   so multi-turn references resolve.
3. **Generate** — `generator` builds a grounded prompt (use only sources, cite
   `[S1]...`, say "not found" otherwise) plus recent conversation turns; `llm`
   streams tokens from Groq over SSE.
4. **Cite & link** — citations are returned with the answer and rendered as
   clickable chips; a second exam-only retrieval surfaces related past questions.

Full walkthrough and concept explainers: **[STUDY_GUIDE.md](STUDY_GUIDE.md)**.

---

## Evaluation

```bash
cd backend
python -m app.eval.run_eval        # writes app/eval/results.json
```
Runs a `{chunk_size: 256, 512} x {reranker: on, off}` ablation over a labeled
dataset (`app/eval/dataset.json`) and computes recall@k, hit-rate@k, MRR, and
LLM-as-judge faithfulness. View it at **`/evals`** in the UI.

**Measured result (k = 3):** the cross-encoder reranker lifts **MRR 0.880 -> 0.972**
in every configuration and **recall@3 0.889 -> 0.917** at `chunk_size=256` (at 512,
recall@3 is already saturated at 1.0, so the gain shows in MRR). Faithfulness stays
~1.0 — the grounding prompt keeps answers on-source. *(Re-run to reproduce; numbers
are read live from `results.json`.)*

---

## Screenshots

> Add screenshots of: the KB workspace (documents + streaming chat), the citation
> drawer, the quiz/exam-insights dialogs, and the evaluation dashboard. Place images
> in `docs/` and link them here.

---

## Deploying to AWS (simplest path)

1. Launch one EC2 instance (t3.small; or t3.micro for light use). Install Docker +
   docker compose.
2. Either run all three containers with `docker compose up -d`, **or** use **RDS
   Postgres** for the DB and run only backend+frontend on EC2 (point `DATABASE_URL`
   at the RDS endpoint).
3. Keep Chroma + uploads on an attached **EBS volume** mounted into the backend
   container so data survives restarts.
4. Open ports 80/443, put **Nginx** in front as a reverse proxy, point your domain
   at the instance, and add HTTPS with **Let's Encrypt**.
5. Set all secrets via the instance's `.env` (never commit them).

---

## Future work

- **Hybrid search** (BM25 + vectors with rank fusion) for rare exact terms.
- **Server-grade vector DB** (Qdrant / pgvector) for concurrency and sharding.
- **Caching** of embeddings and frequent answers.
- **PDF-page highlight** in the citation drawer; OCR for scanned PDFs.
- **Task queue** (Celery/RQ) for ingestion; per-user rate limiting.
- **HttpOnly cookie** auth instead of localStorage.

---

