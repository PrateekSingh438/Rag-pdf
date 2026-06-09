"""Hybrid retrieval: combine dense (embedding) search with sparse (keyword)
search and fuse the two rankings with Reciprocal Rank Fusion (RRF).

Dense search is great at meaning/paraphrase but can miss rare exact terms (codes,
acronyms, specific names) that the embedder generalizes away; keyword search nails
those but misses synonyms. RRF blends both rank lists without needing to calibrate
their different score scales: each document's fused score is sum(1 / (k + rank))
over the rankers it appears in.

Sparse search runs as GIN-indexed Postgres full-text search, so it scales with the
index instead of loading every chunk per query. On SQLite (local dev without
Postgres) it falls back to an in-memory BM25 over the KB's chunks.
"""
import re
from ..database import is_postgres
from .store import vector_search, keyword_search, get_chunks

_RRF_K = 60  # standard RRF constant


def _tok(text: str):
    return re.findall(r"[a-z0-9]+", text.lower())


def _rrf(rankings):
    """rankings: list of ordered id-lists. Returns {id: fused_score}."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, cid in enumerate(ranking):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (_RRF_K + rank + 1)
    return scores


def _sparse_search(kb_id, query, top_n, doc_type):
    if is_postgres():
        return keyword_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    # SQLite fallback: build BM25 over the KB's chunks for this query.
    from rank_bm25 import BM25Okapi

    chunks = get_chunks(kb_id, doc_type=doc_type)
    if not chunks:
        return []
    bm25 = BM25Okapi([_tok(c["text"]) for c in chunks])
    scores = bm25.get_scores(_tok(query))
    order = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)[:top_n]
    return [{"id": chunks[i]["id"], "text": chunks[i]["text"],
             "metadata": chunks[i]["metadata"], "score": float(scores[i])}
            for i in order if scores[i] > 0]


def hybrid_search(kb_id, query, top_n=10, doc_type=None):
    # Dense candidates (already ranked by cosine similarity).
    dense = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    by_id = {h["id"]: h for h in dense}
    dense_ranking = [h["id"] for h in dense]

    # Sparse candidates (already ranked by keyword relevance).
    sparse_ranking = []
    for h in _sparse_search(kb_id, query, top_n, doc_type):
        sparse_ranking.append(h["id"])
        by_id.setdefault(h["id"], {"id": h["id"], "text": h["text"],
                                   "metadata": h["metadata"], "score": 0.0})

    # If keyword search found nothing, this gracefully degrades to dense-only.
    fused = _rrf([dense_ranking, sparse_ranking])
    ranked_ids = sorted(fused, key=lambda c: fused[c], reverse=True)[:top_n]
    out = []
    for cid in ranked_ids:
        hit = dict(by_id[cid])
        hit["rrf_score"] = fused[cid]
        out.append(hit)
    return out
