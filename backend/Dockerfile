# Backend image: FastAPI + the RAG stack (sentence-transformers, chromadb).
# The embedding/reranker models download on first use into the HF cache, which
# docker-compose mounts as a volume so they persist across restarts.
FROM python:3.11-slim

WORKDIR /app

# System libs needed by OpenCV (pulled in by rapidocr-onnxruntime for the OCR
# fallback on scanned PDFs). Without these, `import cv2` fails and scanned
# documents get marked "failed". libgl1 -> libGL.so.1; libglib2.0-0 -> libgthread.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Model/HF caches and data go to writable dirs (Hugging Face Spaces runs the
# container as a non-root user, so /app may be read-only — these default to /tmp
# but are overridden by env in docker-compose). PORT lets the host pick the port
# (HF Spaces routes to app_port; compose uses 8000).
ENV PORT=8000

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
