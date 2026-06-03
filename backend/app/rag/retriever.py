"""Retrieval pipeline: (hybrid dense+BM25 | dense-only) candidate search -> optional
cross-encoder rerank -> top_k. The use_hybrid and use_reranker flags let the eval
harness measure each stage's impact."""
from .store import vector_search
from .hybrid import hybrid_search
from .reranker import rerank


def retrieve(kb_id, query, top_n=10, top_k=5, use_reranker=True, doc_type=None, use_hybrid=True):
    if use_hybrid:
        hits = hybrid_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    else:
        hits = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    return rerank(query, hits, top_k=top_k) if use_reranker else hits[:top_k]
