# StudyMate — AI Study Companion

StudyMate is a full-stack **Retrieval-Augmented Generation (RAG)** web app for students. You create a knowledge base per course, upload your **notes and previous-year question papers** (PDFs or photos), and then ask questions. Every answer is grounded in **only your uploaded material**, cites the **exact source file and page**, links concepts to **related past exam questions**, and refuses to guess when the answer isn't in your documents.

The retrieval pipeline is written as plain, readable Python (**no LangChain / LlamaIndex**), so every step — chunking, hybrid search, reranking, prompt building, generation — is fully explainable and measurable.

**Live demo:** https://studymatewc.vercel.app · **API docs:** https://32Prateek321-studymate-api.hf.space/docs · **Retrieval benchmark:** https://studymatewc.vercel.app/benchmark

> The backend runs on a free tier that sleeps when idle, so the first request after a nap can take ~30–60s to wake (the app shows a "waking up" banner). Give it a moment.

---

## Features

- **Grounded, cited chat** — answers come only from your documents, with clickable `[S1]` citations to the exact source page, and a strict *"I couldn't find this in your uploaded documents"* response instead of hallucinating.
- **Hybrid retrieval + reranking** — dense embeddings (`bge-small`) fused with **BM25** keyword search via **Reciprocal Rank Fusion**, then a **cross-encoder reranker** reorders the top candidates. Measured to lift MRR 0.88 → 0.97 (see the benchmark page).
- **OCR for scans and photos** — image-only PDFs and uploaded photos (JPG/PNG/WEBP) are run through OCR (PyMuPDF render + RapidOCR) so handwritten/scanned exam papers become searchable.
- **Streaming chat** — answers stream token-by-token over Server-Sent Events, with a **Stop** button, **multi-turn memory** (follow-ups like "explain that again" resolve), Markdown + LaTeX (KaTeX) rendering, and copy buttons.
- **Study tools** — generate practice questions, take scored multiple-choice **quizzes**, get a day-by-day **study plan**, see **key topics** ranked by how heavily they're tested, and **exam insights** mining your past papers for high-yield topics.
- **Progress tracking** — streaks, badges, quiz history, and weakest topics on your profile/dashboard.
- **Model picker** — switch between Llama 3.1 8B (fast) and Llama 3.3 70B (higher quality) per chat, via Groq.
- **Auth** — email/password (JWT) and Google OAuth sign-in.
- **Production hardening** — per-IP rate limiting (slowapi), upload size + OCR-page caps, cold-start model warmup, and graceful recovery of interrupted ingestions.
- **Self-measured quality** — a public `/benchmark` page reports recall@k, hit-rate@k, and MRR from an offline ablation, explained in plain language.
- **Polish** — dark mode, mobile-friendly workspace, OG link previews, toasts, and a live visitor/usage counter.

---

## Tech stack

| Layer | Tools |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, react-markdown + remark-gfm/remark-math + rehype-katex |
| **Backend** | FastAPI, SQLAlchemy, Pydantic, slowapi (rate limiting), python-jose (JWT), passlib/bcrypt |
| **Retrieval / ML** | `sentence-transformers` — `BAAI/bge-small-en-v1.5` embeddings + `cross-encoder/ms-marco-MiniLM-L-6-v2` reranker · `rank-bm25` · pypdf + PyMuPDF + RapidOCR (OCR) |
| **LLM** | Groq — Llama 3.1 8B / Llama 3.3 70B |
| **Data** | PostgreSQL + **pgvector** (vectors, metadata, and raw file bytes all in Postgres) |
| **Infra** | Docker · backend on Hugging Face Spaces · frontend on Vercel · database on Neon |

---

## Architecture

```
Browser ── Next.js (Vercel) ──HTTP / SSE──▶ FastAPI (Hugging Face Spaces, Docker)
                                               │
   routers: auth · knowledge_bases · documents · chat · practice · quiz · insights · stats · models
                                               │
   RAG core (plain Python, no LangChain):
     loader (pypdf + PyMuPDF/RapidOCR OCR) ─▶ chunker (overlapping word windows)
     retriever ─▶ hybrid search (dense bge-small + BM25, fused with RRF)
               ─▶ cross-encoder reranker ─▶ generator (grounded prompt + [S1] citations)
               ─▶ llm (Groq, streamed tokens)
                                               │
                         PostgreSQL + pgvector (Neon)
   users · knowledge_bases · documents · conversations · messages · quiz_attempts
   chunks (embeddings + metadata) · document_files (raw uploaded bytes)
```

**Why everything lives in Postgres:** vectors (`chunks` via pgvector) and uploaded files (`document_files`) are stored in the same persistent database as the metadata. Earlier these lived on the container's ephemeral disk and were wiped on every rebuild, which left "ready" documents pointing at nothing. Consolidating into Postgres removes that data-sync failure mode and keeps retrieval consistent across restarts.

---

## Repository structure

```
backend/
  app/
    main.py · config.py · database.py · models.py · schemas.py · auth.py · ratelimit.py
    routers/   auth · knowledge_bases · documents · chat · practice · quiz · insights · stats · models
    rag/       loader · chunker · store (pgvector) · retriever · hybrid · reranker
               generator · llm · exam_linker · exam_analysis · topic_analysis
               practice · quiz · study_plan
    services/  ingest_service
    eval/      corpus.py · dataset.json · run_eval.py    # offline benchmark harness
  tests/       make_sample_pdfs.py · fixtures/
  Dockerfile · requirements.txt · .env.example
frontend/
  app/         page (landing) · login · register · dashboard · kb/[id] · profile · benchmark
  components/  NavBar · AuthForm · DocumentsPanel · ChatPanel · MessageBubble · MarkdownMessage
               CitationDrawer · PracticeDialog · QuizDialog · StudyPlanDialog
               ExamInsightsDialog · StudyInsightsDialog · Toast · ServerWaking · icons · ui
  lib/         api.ts (REST + SSE client) · auth.tsx · theme.tsx
  Dockerfile
docker-compose.yml
```

---

## Quick start

### Option A — Docker (Postgres + backend + frontend, one command)

```bash
cp .env.example .env          # set GROQ_API_KEY and a long random SECRET_KEY
docker compose up --build
# Frontend → http://localhost:3000   Backend → http://localhost:8000/docs
```

The bundled database uses the `pgvector/pgvector:pg16` image, so the vector extension is ready out of the box. The first request downloads the embedding/reranker models into a cached volume (slow once, then fast).

### Option B — Local dev (run the services yourself)

The app needs **PostgreSQL with the `pgvector` extension** (plain SQLite won't work, because vectors are stored in Postgres). The easiest way to get one is the compose DB service:

```bash
docker compose up -d db        # Postgres 16 + pgvector on localhost:5432
```

**Backend** (Python 3.11+):
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate     # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # set GROQ_API_KEY; DATABASE_URL defaults to the local Postgres above
uvicorn app.main:app --reload --port 8000
```

**Frontend** (Node 18+):
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev                     # http://localhost:3000
```

**Sample data:** `python -m tests.make_sample_pdfs` writes `tests/fixtures/DS_notes.pdf` and `DS_exam.pdf` to upload, or click **"Load demo"** in the app to seed a ready-made knowledge base.

---

## Environment variables (`backend/.env`)

| Key | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` (must have pgvector) |
| `SECRET_KEY` | JWT signing secret (long random string) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (default 10080 = 7 days) |
| `GROQ_API_KEY` | Groq API key (free tier at console.groq.com) |
| `GROQ_MODEL` | Default model, e.g. `llama-3.1-8b-instant` |
| `EMBED_MODEL` / `RERANK_MODEL` | sentence-transformer model ids |
| `UPLOAD_DIR` | Temp path for in-flight file processing |
| `MAX_UPLOAD_MB` / `MAX_OCR_PAGES` | Upload size cap and OCR page ceiling |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google OAuth (optional; sign-in works without it) |
| `FRONTEND_URL` | Where OAuth redirects back to |
| `CORS_ORIGINS` | Comma-separated allowed origins |

---

## How it works (the RAG pipeline)

1. **Ingest** — on upload the file's bytes are saved to Postgres (`document_files`) and a `Document` row is created with status `processing`; ingestion runs as a background task so the request returns instantly. `loader` extracts text per page with pypdf; any page with no text layer (a scan) is rendered with PyMuPDF and OCR'd with RapidOCR; raw image uploads are OCR'd directly. `chunker` splits pages into overlapping word windows, and `store` embeds them with `bge-small` (normalized, so cosine = dot product) into the `chunks` table.
2. **Retrieve** — `hybrid_search` embeds the question and runs a pgvector cosine search for dense candidates, runs BM25 over the KB's chunks for keyword candidates, and fuses the two rankings with **Reciprocal Rank Fusion**. Short follow-ups fold in the previous question so multi-turn references resolve.
3. **Rerank** — a **cross-encoder** reads each candidate together with the question and rescores them, keeping the top few. This is the step that most improves ranking quality.
4. **Generate** — `generator` builds a grounded prompt (use only the sources, cite `[S1]…`, otherwise say "not found") plus recent conversation turns; `llm` streams tokens from Groq over SSE.
5. **Cite & link** — citations are returned with the answer and rendered as clickable chips that open a highlighted PDF page; a second exam-only retrieval surfaces related past questions.

---

## Evaluation

```bash
cd backend
python -m app.eval.run_eval        # writes app/eval/results.json
```

Runs a `{chunk_size: 256, 512} × {reranker: on, off}` ablation over a labeled dataset (`app/eval/dataset.json`) and computes **recall@k**, **hit-rate@k**, **MRR**, and (with a Groq key) LLM-as-judge **faithfulness**.

**Measured result (k = 3, 18 questions / 9 docs):** the cross-encoder reranker lifts **MRR 0.88 → 0.97** in every configuration, and **recall@3 0.89 → 0.92** at 256-word chunks (at 512 it's already saturated at 1.0). It's a small, fixed test set — read it as directional evidence that the pipeline works. The live, plain-language version is at [`/benchmark`](https://studymatewc.vercel.app/benchmark).

---

## Deployment

| Component | Host | Notes |
|---|---|---|
| Frontend | **Vercel** | Auto-deploys on push to `main` (root directory `frontend/`) |
| Backend | **Hugging Face Spaces** (Docker) | Free CPU Space; models load on startup |
| Database | **Neon** | Serverless Postgres with pgvector enabled |

The Space's local disk is ephemeral, but because vectors and uploaded file bytes now live in Neon Postgres, **data survives rebuilds**. (The only thing that resets is the transient on-disk copy used during ingestion, which is restored from the DB on demand.)

---

## Known limitations

- **Free-tier cold start** — the backend sleeps when idle; the first request can take ~30–60s.
- **Small eval set** — the benchmark is 18 labeled questions; it demonstrates the method, not a large-scale result.
- **File blobs in Postgres** — convenient and durable for a demo; at real scale uploaded files belong in object storage (S3/R2).
- **Per-IP rate limiting** — protects the free LLM quota from casual abuse, but a determined client can rotate IPs; production would add per-user quotas.
- **Token in localStorage** — simple, but an HttpOnly cookie would be more XSS-resistant.

## Future work

- Object storage for uploaded files; per-user usage quotas.
- A pytest suite + CI, and request-level latency/cost instrumentation.
- Structure-aware (semantic) chunking and re-upload de-duplication.
- An async task queue (Celery/RQ) for ingestion at higher concurrency.
- HttpOnly-cookie auth with refresh tokens.
