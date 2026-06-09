"""Retrieval pipeline: (hybrid dense+sparse | dense-only) candidate search ->
optional cross-encoder rerank -> relevance floor -> top_k. The use_hybrid and
use_reranker flags let the eval harness measure each stage's impact.

The relevance floor turns "no good source exists" into an empty result instead of
five barely-related chunks, so callers can answer "not found" deterministically
rather than trusting the LLM to notice the context is garbage."""
from ..config import settings
from .store import vector_search
from .hybrid import hybrid_search
from .reranker import rerank


def retrieve(kb_id, query, top_n=10, top_k=5, use_reranker=True, doc_type=None, use_hybrid=True):
    if use_hybrid:
        hits = hybrid_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    else:
        hits = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    if not use_reranker:
        return hits[:top_k]
    hits = rerank(query, hits, top_k=top_k)
    return [h for h in hits if h["rerank_score"] >= settings.rerank_score_floor]
