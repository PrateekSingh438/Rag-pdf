# Deploying StudyMate for **free** (demo)

This guide deploys the whole app at zero cost for a low-traffic interview demo:

| Piece | Host | Free? | Why |
|---|---|---|---|
| Frontend (Next.js) | **Vercel** | ✅ free | built for Next.js |
| Backend (FastAPI + ML) | **Hugging Face Spaces** (Docker) | ✅ free | free CPU Space = **16 GB RAM**, enough for PyTorch + the 2 transformer models + OCR |
| Database (Postgres) | **Neon** | ✅ free | serverless Postgres, generous free tier |
| LLM | **Groq** | ✅ free tier | already used |

### Why not Vercel/Render/Fly for the backend?
The backend loads PyTorch + `bge-small` (embeddings) + a cross-encoder reranker +
RapidOCR — **~2 GB RAM**. Vercel functions, Render's free 512 MB, and Fly's 256 MB
all OOM. Hugging Face's free Space gives 16 GB RAM, so it's the one free host that
fits.

### Known trade-offs of the free tier (fine for a demo)
- **Cold start:** a free Space sleeps after ~48 h idle; the first request after
  sleep reloads the models (~1–2 min). Open it a few minutes before your demo.
- **Ephemeral disk:** uploaded PDFs + the Chroma vector store live in `/tmp` and
  reset when the Space restarts/rebuilds. **Users, KBs, chats persist** (they're in
  Neon Postgres). Just re-upload a couple of PDFs right before demoing.

---

## 0. Prerequisites
- Code in a **GitHub repo** (frontend) and the ability to push to a **Hugging Face**
  repo (backend). Accounts: GitHub, Vercel, Hugging Face, Neon, Groq, Google Cloud.

---

## 1. Database — Neon Postgres (free)
1. Create a project at https://neon.tech → it gives a connection string like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.
2. Save it — it's your `DATABASE_URL`. (Tables are auto-created on backend startup.)

---

## 2. Backend — Hugging Face Space (Docker, free)
1. Create a new Space → **SDK: Docker** → **Blank** → CPU basic (free).
2. Push the contents of **`backend/`** to the Space repo so its root has
   `Dockerfile`, `requirements.txt`, and `app/`:
   ```bash
   # from the project root
   git clone https://huggingface.co/spaces/<you>/studymate-api hf-space
   cp -r backend/* backend/.dockerignore hf-space/
   cp deploy/huggingface-space-README.md hf-space/README.md   # has the Space config
   cd hf-space && git add . && git commit -m "StudyMate backend" && git push
   ```
   (Do **not** copy `backend/.env`, `.venv`, `chroma_data`, `uploads` — the
   `.dockerignore` already excludes them.)
3. In the Space → **Settings → Variables and secrets**, add (see the table in
   `deploy/huggingface-space-README.md`): `DATABASE_URL`, `SECRET_KEY`,
   `GROQ_API_KEY`, `GROQ_MODEL`, `FRONTEND_URL`, `CORS_ORIGINS`,
   `CHROMA_DIR=/tmp/chroma_data`, `UPLOAD_DIR=/tmp/uploads`, `HF_HOME=/tmp/hf`
   (and the `GOOGLE_*` vars from step 4).
4. The Space builds and serves at `https://<you>-studymate-api.hf.space`. Check
   `…/health` returns `{"status":"ok"}` and `…/docs` loads. That URL is your
   **API base**.

> The first build is slow (installs torch, downloads models on first request).

---

## 3. Frontend — Vercel (free)
1. Import the GitHub repo at https://vercel.com → set **Root Directory** to
   `frontend`.
2. Add an Environment Variable: `NEXT_PUBLIC_API_URL = https://<you>-studymate-api.hf.space`
   (your HF Space URL, no trailing slash).
3. Deploy. You get `https://your-app.vercel.app`.
4. Go back to the **HF Space** and set `FRONTEND_URL` and `CORS_ORIGINS` to that
   Vercel URL, then restart the Space. (The backend also auto-allows any
   `*.vercel.app` origin, so preview deployments work too.)

---

## 4. Google login (OAuth)
1. https://console.cloud.google.com → APIs & Services → **OAuth consent screen**
   (External; add yourself as a test user) → **Credentials → Create OAuth client ID
   → Web application**.
2. **Authorized redirect URIs** — add both:
   - `http://localhost:8000/auth/google/callback` (local dev)
   - `https://<you>-studymate-api.hf.space/auth/google/callback` (production)
3. Copy the **Client ID** and **Client secret**. Set on the HF Space:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI = https://<you>-studymate-api.hf.space/auth/google/callback`
4. Restart the Space. The "Continue with Google" button now works. (Without these,
   the button returns 503 and email/password login still works.)

**Flow:** frontend → `GET /auth/google/login` (backend) → Google consent →
`/auth/google/callback` (backend mints a StudyMate JWT) → redirect to
`FRONTEND_URL/login?token=…` → frontend stores the token.

---

## 5. Verify end-to-end
Open the Vercel URL → register or "Continue with Google" → create a KB → upload a
**scanned** exam PDF (OCR runs) → ask a question (watch it stream with citations) →
try Study tools (Key topics / Quiz / Exam insights) → toggle dark mode → check the
Profile page.

---

## Local development (recap)
- Backend: `cd backend && uvicorn app.main:app --reload` (SQLite, no Postgres needed).
- Frontend: `cd frontend && npm run dev`.
- Or the whole stack with Postgres: `docker compose up --build` (see `docker-compose.yml`).

## Cost-saving notes / alternatives
- To avoid cold starts or get persistent disk, a **$5–12/mo VPS** (DigitalOcean,
  Hetzner) or **AWS EC2 t3.small** running `docker compose up -d` hosts everything
  on one box with persistent volumes — see the AWS section in `README.md`.
- To shrink the backend enough for tiny/free serverless, you'd swap the local
  embedding + reranker models for a hosted embeddings API — but that adds keys/cost
  and removes the "RAG from scratch" story, so it's not recommended for the demo.
