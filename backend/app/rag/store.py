"""Vector storage backed by Postgres (pgvector). Each chunk is a row in the
`chunks` table tagged with its knowledge base, so users' data stays isolated via a
`kb_id` filter. Embeddings are normalized, so cosine distance ranks by semantic
similarity and `score = 1 - distance` is the cosine similarity.

Keeping vectors in Postgres (instead of an on-disk Chroma store) means they
persist across container rebuilds — the DB is the single source of truth, so the
document records and their vectors can't drift out of sync.

The embedder is a module-level singleton: the model loads once per process. Each
function opens its own short-lived session since callers don't pass one in."""
import re
from sqlalchemy import select, delete as sa_delete, func, text as sa_text
from sentence_transformers import SentenceTransformer
from ..config import settings
from ..database import SessionLocal
from ..models import Chunk

_embedder = SentenceTransformer(settings.embed_model)

# bge-*-v1.5 models are trained with an instruction prefix on the QUERY side of
# short-query -> passage retrieval (passages are embedded bare). Skipping it
# measurably hurts retrieval, so queries get it and documents don't.
_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "


def embed(texts):
    return _embedder.encode(texts, normalize_embeddings=True).tolist()


def embed_query(query: str):
    prefix = _QUERY_PREFIX if "bge" in settings.embed_model.lower() else ""
    return _embedder.encode([prefix + query], normalize_embeddings=True).tolist()[0]


def _meta(c: Chunk) -> dict:
    return {"source_file": c.source_file, "doc_type": c.doc_type,
            "page": c.page, "chunk_index": c.chunk_index, "doc_id": c.doc_id}


def add_chunks(kb_id: int, doc_id: int, chunks):
    embeddings = embed([c["text"] for c in chunks])
    db = SessionLocal()
    try:
        for c, emb in zip(chunks, embeddings):
            m = c["metadata"]
            db.add(Chunk(
                chunk_uid=f"{doc_id}_{m['chunk_index']}",
                kb_id=kb_id, doc_id=doc_id, text=c["text"],
                source_file=m["source_file"], doc_type=m["doc_type"],
                page=m["page"], chunk_index=m["chunk_index"], embedding=emb,
            ))
        db.commit()
    finally:
        db.close()


def vector_search(kb_id: int, query: str, top_n=10, doc_type=None):
    q = embed_query(query)
    db = SessionLocal()
    try:
        dist = Chunk.embedding.cosine_distance(q).label("dist")
        stmt = select(Chunk, dist).where(Chunk.kb_id == kb_id)
        if doc_type:
            stmt = stmt.where(Chunk.doc_type == doc_type)
        stmt = stmt.order_by(dist).limit(top_n)
        return [{"id": c.chunk_uid, "text": c.text, "metadata": _meta(c),
                 "score": 1.0 - float(d)}
                for c, d in db.execute(stmt).all()]
    finally:
        db.close()


def keyword_search(kb_id: int, query: str, top_n=10, doc_type=None):
    """Sparse retrieval via Postgres full-text search (GIN-indexed, see
    database._ensure_text_index). Terms are OR'd so a long natural-language
    question still matches chunks containing any keyword, like BM25 would.
    Returns [] for queries that reduce to stopwords."""
    terms = " | ".join(set(re.findall(r"[a-z0-9]+", query.lower())))
    if not terms:
        return []
    db = SessionLocal()
    try:
        tsv = func.to_tsvector(sa_text("'english'"), Chunk.text)
        tsq = func.to_tsquery(sa_text("'english'"), terms)
        rank = func.ts_rank(tsv, tsq).label("rank")
        stmt = select(Chunk, rank).where(Chunk.kb_id == kb_id, tsv.op("@@")(tsq))
        if doc_type:
            stmt = stmt.where(Chunk.doc_type == doc_type)
        stmt = stmt.order_by(rank.desc()).limit(top_n)
        return [{"id": c.chunk_uid, "text": c.text, "metadata": _meta(c),
                 "score": float(r)}
                for c, r in db.execute(stmt).all()]
    finally:
        db.close()


def get_chunks(kb_id: int, doc_type=None, limit=None):
    """Fetch stored chunks (no query) — used to analyze a KB's material, e.g.
    mining all exam-paper chunks for topic frequency."""
    db = SessionLocal()
    try:
        stmt = select(Chunk).where(Chunk.kb_id == kb_id)
        if doc_type:
            stmt = stmt.where(Chunk.doc_type == doc_type)
        if limit:
            stmt = stmt.limit(limit)
        return [{"id": c.chunk_uid, "text": c.text, "metadata": _meta(c)}
                for c in db.execute(stmt).scalars().all()]
    finally:
        db.close()


def delete_document(kb_id: int, doc_id: int):
    db = SessionLocal()
    try:
        db.execute(sa_delete(Chunk).where(Chunk.kb_id == kb_id, Chunk.doc_id == doc_id))
        db.commit()
    finally:
        db.close()


def delete_collection(kb_id: int):
    """Drop all of a knowledge base's chunks (used when a KB is deleted)."""
    db = SessionLocal()
    try:
        db.execute(sa_delete(Chunk).where(Chunk.kb_id == kb_id))
        db.commit()
    finally:
        db.close()
