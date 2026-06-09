---
title: StudyMate API
emoji: 📚
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 8000
pinned: false
---

# StudyMate API (backend)

FastAPI backend for StudyMate, deployed as a Hugging Face Docker Space.

This Space runs the RAG backend (PyTorch + sentence-transformers embeddings +
cross-encoder reranker + RapidOCR). The free CPU Space (16 GB RAM) is enough to
host it for a low-traffic demo.

> **How to use this file:** the contents of the project's `backend/` folder
> (`Dockerfile`, `requirements.txt`, `app/`) become the Space repo. Replace the
> Space's auto-generated `README.md` with THIS file (keep the YAML front matter —
> `sdk: docker` and `app_port: 8000` are what make it work).

## Required Space secrets / variables (Settings → Variables and secrets)

| Name | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require` | Neon Postgres |
| `SECRET_KEY` | long random string | JWT signing |
| `GROQ_API_KEY` | `gsk_...` | LLM (free tier) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `FRONTEND_URL` | `https://your-app.vercel.app` | post-login redirect |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | allowed API origins |
| `UPLOAD_DIR` | `/tmp/uploads` | writable on Spaces |
| `HF_HOME` | `/tmp/hf` | model cache (writable) |
| `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | optional |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | optional |
| `GOOGLE_REDIRECT_URI` | `https://<user>-<space>.hf.space/auth/google/callback` | optional |

> Mark `SECRET_KEY`, `GROQ_API_KEY`, `DATABASE_URL`, and the Google secret as
> **Secrets**; the rest can be plain **Variables**.
