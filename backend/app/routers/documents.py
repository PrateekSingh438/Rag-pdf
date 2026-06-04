"""Document upload, listing, and deletion within a knowledge base.

Upload saves the PDF to UPLOAD_DIR, creates a Document row with status
"processing", and schedules ingestion as a BackgroundTask so the request returns
immediately while chunking/embedding happens in the background. Delete removes the
DB row, the file on disk, and the document's vectors from Chroma."""
import os
from fastapi import (APIRouter, Depends, HTTPException, UploadFile, File, Form,
                     BackgroundTasks, Response)
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import User, KnowledgeBase, Document
from ..schemas import DocumentOut
from ..auth import get_current_user
from ..services.ingest_service import ingest_document
from ..rag.store import delete_document as store_delete_document

router = APIRouter(prefix="/kb/{kb_id}/documents", tags=["documents"])


def _owned_kb_or_404(kb_id: int, user: User, db: Session) -> KnowledgeBase:
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


def _doc_path(kb_id: int, doc_id: int, filename: str) -> str:
    safe = os.path.basename(filename)
    return os.path.join(settings.upload_dir, str(kb_id), f"{doc_id}_{safe}")


@router.post("", response_model=DocumentOut)
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    doc_type: str = Form("notes"),
    background: BackgroundTasks = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _owned_kb_or_404(kb_id, user, db)
    if doc_type not in ("notes", "exam"):
        raise HTTPException(status_code=400, detail="doc_type must be 'notes' or 'exam'")
    # Accept PDFs and common image formats (photos of notes are OCR'd on ingest).
    if not (file.filename or "").lower().endswith((".pdf", ".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(status_code=400,
                            detail="Only PDF or image files (JPG, PNG, WEBP) are supported")

    # Create the row first so we have an id to build a stable file path.
    doc = Document(filename=os.path.basename(file.filename), doc_type=doc_type,
                   status="processing", kb_id=kb_id)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    path = _doc_path(kb_id, doc.id, doc.filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(await file.read())

    background.add_task(ingest_document, doc.id, path, kb_id, doc.filename, doc_type)
    return doc


@router.get("", response_model=list[DocumentOut])
def list_documents(kb_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    _owned_kb_or_404(kb_id, user, db)
    return (db.query(Document)
            .filter_by(kb_id=kb_id)
            .order_by(Document.created_at.desc())
            .all())


@router.delete("/{doc_id}")
def delete_document(kb_id: int, doc_id: int, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    _owned_kb_or_404(kb_id, user, db)
    doc = db.query(Document).filter_by(id=doc_id, kb_id=kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Best-effort cleanup of vectors and file, then remove the DB row.
    try:
        store_delete_document(kb_id, doc_id)
    except Exception:
        pass
    path = _doc_path(kb_id, doc_id, doc.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}


@router.post("/{doc_id}/retry", response_model=DocumentOut)
def retry_document(kb_id: int, doc_id: int, background: BackgroundTasks = None,
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    """Re-run ingestion for a document (e.g. after a 'failed' status). Reuses the
    file already saved on disk; clears any partial vectors first."""
    _owned_kb_or_404(kb_id, user, db)
    doc = db.query(Document).filter_by(id=doc_id, kb_id=kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = _doc_path(kb_id, doc_id, doc.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=400,
                            detail="Original file is no longer available; please re-upload.")

    try:
        store_delete_document(kb_id, doc_id)  # drop any partial vectors
    except Exception:
        pass
    doc.status = "processing"
    doc.num_chunks = 0
    db.commit()
    db.refresh(doc)

    background.add_task(ingest_document, doc.id, path, kb_id, doc.filename, doc.doc_type)
    return doc


@router.get("/{doc_id}/page/{page}")
def document_page(kb_id: int, doc_id: int, page: int, q: str | None = None,
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Render a document page to PNG, highlighting the cited snippet (`q`). Powers
    the citation drawer's PDF preview. 404s if the source file isn't on disk
    (e.g. demo content), so the frontend can fall back to the text snippet."""
    import fitz  # PyMuPDF

    _owned_kb_or_404(kb_id, user, db)
    doc = db.query(Document).filter_by(id=doc_id, kb_id=kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = _doc_path(kb_id, doc_id, doc.filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="No source file for this document")

    pdf = fitz.open(path)
    try:
        if page < 1 or page > pdf.page_count:
            raise HTTPException(status_code=404, detail="Page out of range")
        pg = pdf[page - 1]
        if q:
            words = q.split()
            rects = pg.search_for(" ".join(words[:10])) or pg.search_for(" ".join(words[:5]))
            for r in (rects or []):
                pg.add_highlight_annot(r)
        png = pg.get_pixmap(dpi=130).tobytes("png")
    finally:
        pdf.close()
    return Response(content=png, media_type="image/png")
