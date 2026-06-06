"""Knowledge base CRUD. Every route depends on get_current_user and filters by
owner_id, so a user can only ever see or touch their own knowledge bases."""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import User, KnowledgeBase, Document, DocumentFile
from ..schemas import KBCreate, KBOut
from ..auth import get_current_user
from ..rag.store import delete_collection, add_chunks
from ..rag.chunker import chunk_document
from ..demo_content import DEMO_NOTES, DEMO_EXAM

router = APIRouter(prefix="/kb", tags=["knowledge_bases"])


def _owned_kb_or_404(kb_id: int, user: User, db: Session) -> KnowledgeBase:
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


@router.post("", response_model=KBOut)
def create_kb(body: KBCreate, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    kb = KnowledgeBase(name=body.name, owner_id=user.id)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return kb


def _seed_doc(db: Session, kb_id: int, filename: str, doc_type: str, text: str):
    doc = Document(filename=filename, doc_type=doc_type, status="processing", kb_id=kb_id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    chunks = chunk_document([{"page": 1, "text": text}], filename, doc_type)
    add_chunks(kb_id, doc.id, chunks)
    doc.num_chunks, doc.status = len(chunks), "ready"
    db.commit()


@router.post("/demo", response_model=KBOut)
def create_demo_kb(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Onboarding: create a ready-to-use sample knowledge base (notes + an exam
    paper) so a new account isn't an empty dead end."""
    kb = KnowledgeBase(name="Data Structures (Demo)", owner_id=user.id)
    db.add(kb)
    db.commit()
    db.refresh(kb)
    _seed_doc(db, kb.id, "DS_notes.pdf", "notes", DEMO_NOTES)
    _seed_doc(db, kb.id, "DS_exam.pdf", "exam", DEMO_EXAM)
    return kb


@router.get("", response_model=list[KBOut])
def list_kbs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (db.query(KnowledgeBase)
            .filter_by(owner_id=user.id)
            .order_by(KnowledgeBase.created_at.desc())
            .all())


@router.get("/{kb_id}", response_model=KBOut)
def get_kb(kb_id: int, db: Session = Depends(get_db),
           user: User = Depends(get_current_user)):
    return _owned_kb_or_404(kb_id, user, db)


@router.delete("/{kb_id}")
def delete_kb(kb_id: int, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    kb = _owned_kb_or_404(kb_id, user, db)
    # Clean up the KB's vectors and uploaded files so nothing is orphaned on disk.
    try:
        delete_collection(kb_id)
    except Exception:
        pass
    kb_dir = os.path.join(settings.upload_dir, str(kb_id))
    if os.path.isdir(kb_dir):
        shutil.rmtree(kb_dir, ignore_errors=True)
    db.query(DocumentFile).filter_by(kb_id=kb_id).delete()
    db.delete(kb)  # cascades to documents + conversations in the DB
    db.commit()
    return {"deleted": kb_id}
