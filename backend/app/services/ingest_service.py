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
        if not chunks:
            # No extractable text (e.g. a scanned/image-only or empty PDF). Mark
            # failed cleanly rather than attempting an empty vector insert.
            doc = db.get(Document, doc_id)
            if doc:
                doc.num_chunks, doc.status = 0, "failed"
                db.commit()
            return
        add_chunks(kb_id, doc_id, chunks)
        doc = db.get(Document, doc_id)
        doc.num_chunks, doc.status = len(chunks), "ready"
        db.commit()
    except Exception:
        doc = db.get(Document, doc_id)
        if doc:
            doc.status = "failed"
            db.commit()
        raise
    finally:
        db.close()
