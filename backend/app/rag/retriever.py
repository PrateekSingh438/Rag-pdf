"""Retrieval pipeline: (hybrid dense+sparse | dense-only) candidate search ->
cross-encoder rerank over the WHOLE pool -> relevance floor -> diverse top_k.
The use_hybrid and use_reranker flags let the eval harness measure each stage.

Two accuracy levers live here:
  * Wide candidate pool, then rerank. Vector/keyword search is a cheap, lossy
    filter; the cross-encoder is the accurate judge. So we hand the reranker a
    large pool (settings.retrieve_candidates) and let it choose, rather than
    pre-truncating to top_k and hoping the cheap stage got the order right.
  * Diversity. Adjacent/overlapping chunks can all score well yet restate the
    same passage; _select_diverse drops near-duplicates so the top_k carry
    distinct information.

The relevance floor turns "no good source exists" into an empty result instead of
five barely-related chunks, so callers can answer "not found" deterministically
rather than trusting the LLM to notice the context is garbage."""
import re

from ..config import settings
from .store import vector_search
from .hybrid import hybrid_search
from .reranker import rerank


def _tokens(text: str) -> set:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _select_diverse(hits, top_k):
    """MMR-lite: walk the reranked list (best first) and keep a chunk only if it
    isn't a near-duplicate of one already kept (word-overlap Jaccard above
    settings.dedup_jaccard). If diversity leaves us short of top_k, backfill with
    the highest-scoring skipped chunks so the prompt still gets top_k sources."""
    kept, kept_tokens, skipped = [], [], []
    for h in hits:
        toks = _tokens(h["text"])
        is_dup = any(
            (len(toks & kt) / len(toks | kt) if (toks or kt) else 0.0) > settings.dedup_jaccard
            for kt in kept_tokens
        )
        if is_dup:
            skipped.append(h)
            continue
        kept.append(h)
        kept_tokens.append(toks)
        if len(kept) == top_k:
            return kept
    return (kept + skipped)[:top_k]


def retrieve(kb_id, query, top_n=None, top_k=None, use_reranker=True, doc_type=None, use_hybrid=True):
    top_n = top_n or settings.retrieve_candidates
    top_k = top_k or settings.retrieve_top_k
    if use_hybrid:
        hits = hybrid_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    else:
        hits = vector_search(kb_id, query, top_n=top_n, doc_type=doc_type)
    if not use_reranker:
        return hits[:top_k]
    # Rerank the entire candidate pool, drop clearly-irrelevant chunks, then pick
    # a diverse top_k from what survives.
    ranked = rerank(query, hits, top_k=len(hits))
    ranked = [h for h in ranked if h["rerank_score"] >= settings.rerank_score_floor]
    return _select_diverse(ranked, top_k)
