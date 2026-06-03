"""Hybrid retrieval: combine dense (embedding) search with sparse (BM25 keyword)
search and fuse the two rankings with Reciprocal Rank Fusion (RRF).

Dense search is great at meaning/paraphrase but can miss rare exact terms (codes,
acronyms, specific names) that the embedder generalizes away; BM25 nails those but
misses synonyms. RRF blends both rank lists without needing to calibrate their
different score scales: each document's fused score is sum(1 / (k + rank)) over the
rankers it appears in. The BM25 index is built per query from the KB's chunks —
fine at study-app scale; a persistent index is the scaling step.
"""
import re
from rank_bm25 import BM25Okapi
from .store import vector_search, get_chunks

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


def hybrid_search(kb_id, query, top_n=10, doc_type=None):
    # Dense candidates (already ranked by cosine similarity).
    dense = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    by_id = {h["id"]: h for h in dense}
    dense_ranking = [h["id"] for h in dense]

    # Sparse candidates via BM25 over the KB's chunks.
    sparse_ranking = []
    chunks = get_chunks(kb_id, doc_type=doc_type)
    if chunks:
        bm25 = BM25Okapi([_tok(c["text"]) for c in chunks])
        scores = bm25.get_scores(_tok(query))
        order = sorted(range(len(chunks)), key=lambda i: scores[i], reverse=True)[:top_n]
        for i in order:
            if scores[i] <= 0:
                continue
            c = chunks[i]
            sparse_ranking.append(c["id"])
            by_id.setdefault(c["id"], {"id": c["id"], "text": c["text"],
                                       "metadata": c["metadata"], "score": 0.0})

    # If BM25 found nothing useful, this gracefully degrades to dense-only.
    fused = _rrf([dense_ranking, sparse_ranking])
    ranked_ids = sorted(fused, key=lambda c: fused[c], reverse=True)[:top_n]
    out = []
    for cid in ranked_ids:
        hit = dict(by_id[cid])
        hit["rrf_score"] = fused[cid]
        out.append(hit)
    return out
