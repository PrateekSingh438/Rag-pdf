"""Vector storage. Each knowledge base gets its own Chroma collection so users'
data stays isolated. Embeddings are normalized so cosine similarity = dot product.

The embedder and Chroma client are module-level singletons: the model loads once
per process, and the persistent client keeps vectors on disk under CHROMA_DIR."""
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


def get_chunks(kb_id: int, doc_type=None, limit=None):
    """Fetch stored chunks (no query) — used to analyze a KB's material, e.g.
    mining all exam-paper chunks for topic frequency."""
    col = _col(kb_id)
    where = {"doc_type": doc_type} if doc_type else None
    res = col.get(where=where, include=["documents", "metadatas"], limit=limit)
    ids = res.get("ids") or []
    docs = res.get("documents") or []
    metas = res.get("metadatas") or []
    return [{"id": i, "text": d, "metadata": m} for i, d, m in zip(ids, docs, metas)]


def delete_document(kb_id: int, doc_id: int):
    _col(kb_id).delete(where={"doc_id": doc_id})


def delete_collection(kb_id: int):
    """Drop a knowledge base's entire Chroma collection (used when a KB is deleted)."""
    _client.delete_collection(f"kb_{kb_id}")
