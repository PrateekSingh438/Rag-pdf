"""Cross-encoder reranking. A bi-encoder (the embedder) is fast but compares the
query and chunk separately; a cross-encoder reads them together and scores
relevance far more accurately. We rerank the top_n candidates down to top_k."""
from sentence_transformers import CrossEncoder
from ..config import settings

_reranker = CrossEncoder(settings.rerank_model)


def rerank(query: str, hits, top_k=5):
    if not hits:
        return []
    scores = _reranker.predict([[query, h["text"]] for h in hits])
    for h, s in zip(hits, scores):
        h["rerank_score"] = float(s)
    return sorted(hits, key=lambda h: h["rerank_score"], reverse=True)[:top_k]
