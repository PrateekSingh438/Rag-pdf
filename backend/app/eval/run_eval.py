"""Evaluation harness + ablation.

For each configuration in {chunk_size: 256, 512} x {use_reranker: True, False} we:
  1. Build an ephemeral, in-memory index (numpy) from the bundled corpus, chunked
     at that chunk_size (so the index does not touch the app's persistent store).
  2. Measure retrieval quality against the labeled dataset, with no LLM:
       - hit_rate@k : fraction of questions with >=1 gold-doc chunk in the top-k
       - recall@k   : fraction of the gold doc's chunks that made the top-k
       - MRR        : mean reciprocal rank of the first gold-doc chunk
  3. Measure answer faithfulness with an LLM-as-judge over a small sample: build
     the grounded answer, then ask the model to score 0..1 whether every claim is
     supported by the retrieved sources.

Results for all configs are written to results.json (used for the README / report).
Run with:  python -m app.eval.run_eval
"""
import os
import json
import time
from datetime import datetime, timezone

import numpy as np

from ..config import settings
from ..rag.chunker import chunk_document
from ..rag.store import embed
from ..rag.reranker import rerank
from ..rag.generator import build_messages
from .corpus import CORPUS

# Retrieval settings for the eval (top_k is the "k" in the metrics).
TOP_N = 10
TOP_K = 3
# Ablation grid.
CHUNK_SIZES = [256, 512]
RERANKER_OPTIONS = [True, False]
# Faithfulness is the only LLM-dependent metric; cap the sample to bound cost.
FAITHFULNESS_SAMPLE = 5
LLM_CALL_SPACING_SEC = 2.0  # stay under Groq free-tier rate limits

HERE = os.path.dirname(__file__)
DATASET_PATH = os.path.join(HERE, "dataset.json")
RESULTS_PATH = os.path.join(HERE, "results.json")

_JUDGE_SYSTEM = (
    "You are a strict evaluator of factual faithfulness. You are given SOURCES and "
    "an ANSWER. Decide whether every claim in the ANSWER is supported by the "
    "SOURCES. Reply with ONLY a single number between 0 and 1: 1.0 if fully "
    "supported, 0.0 if unsupported or contradicted, a fraction in between if "
    "partially supported. An answer that correctly says it could not find the "
    "information counts as fully faithful (1.0). Output only the number."
)


def load_dataset():
    with open(DATASET_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_index(chunk_size: int):
    """Chunk the corpus at chunk_size and embed it into an in-memory index.
    Returns ((items, matrix), gold_chunk_counts), where items[i] aligns with row i
    of the normalized embedding matrix, so cosine similarity is just a dot product."""
    items, embs = [], []
    gold_counts: dict[str, int] = {}
    for doc_id, (fname, meta) in enumerate(CORPUS.items()):
        pages = [{"page": 1, "text": meta["text"]}]
        chunks = chunk_document(pages, fname, meta["doc_type"], chunk_size=chunk_size)
        gold_counts[fname] = len(chunks)
        for c, vec in zip(chunks, embed([c["text"] for c in chunks])):
            items.append({"id": f"{doc_id}_{c['metadata']['chunk_index']}",
                          "text": c["text"],
                          "metadata": {**c["metadata"], "doc_id": doc_id}})
            embs.append(vec)
    matrix = np.array(embs, dtype=np.float32) if embs else np.zeros((0, 1), dtype=np.float32)
    return (items, matrix), gold_counts


def search(index, query: str, use_reranker: bool):
    items, matrix = index
    if matrix.shape[0] == 0:
        return []
    q = np.asarray(embed([query])[0], dtype=np.float32)
    sims = matrix @ q  # embeddings are normalized -> dot product == cosine similarity
    order = np.argsort(-sims)[:TOP_N]
    hits = [{"id": items[i]["id"], "text": items[i]["text"],
             "metadata": items[i]["metadata"], "score": float(sims[i])} for i in order]
    return rerank(query, hits, top_k=TOP_K) if use_reranker else hits[:TOP_K]


def retrieval_metrics(index, gold_counts, dataset, use_reranker):
    hit_sum = recall_sum = mrr_sum = 0.0
    for item in dataset:
        gold = item["gold_doc"]
        hits = search(index, item["question"], use_reranker)
        gold_in_topk = [i for i, h in enumerate(hits) if h["metadata"]["source_file"] == gold]
        hit_sum += 1.0 if gold_in_topk else 0.0
        total_gold = max(1, gold_counts.get(gold, 1))
        recall_sum += len(gold_in_topk) / total_gold
        mrr_sum += 1.0 / (gold_in_topk[0] + 1) if gold_in_topk else 0.0
    n = len(dataset)
    return {"hit_rate_at_k": hit_sum / n, "recall_at_k": recall_sum / n, "mrr": mrr_sum / n}


def _llm_with_retry(messages, **kwargs):
    """Call the LLM with simple backoff so transient rate limits don't abort a run."""
    from ..rag.llm import chat  # imported lazily so retrieval-only runs need no key
    for attempt in range(5):
        try:
            return chat(messages, **kwargs)
        except Exception as e:  # noqa: BLE001 - groq raises various error types
            wait = 2 ** attempt
            print(f"    LLM call failed ({e}); retrying in {wait}s")
            time.sleep(wait)
    raise RuntimeError("LLM call failed after retries")


def faithfulness_metric(index, dataset, use_reranker):
    """Average LLM-as-judge faithfulness over a small sample of questions."""
    if not settings.groq_api_key:
        print("  (no GROQ_API_KEY; skipping faithfulness)")
        return 0.0
    sample = dataset[:FAITHFULNESS_SAMPLE]
    total = 0.0
    for item in sample:
        hits = search(index, item["question"], use_reranker)
        answer = _llm_with_retry(build_messages(item["question"], hits),
                                 temperature=0.0, max_tokens=400)
        time.sleep(LLM_CALL_SPACING_SEC)
        sources = "\n\n".join(h["text"] for h in hits)
        judge = _llm_with_retry(
            [{"role": "system", "content": _JUDGE_SYSTEM},
             {"role": "user", "content": f"SOURCES:\n{sources}\n\nANSWER:\n{answer}\n\nScore:"}],
            temperature=0.0, max_tokens=8)
        time.sleep(LLM_CALL_SPACING_SEC)
        try:
            score = float(judge.strip().split()[0])
            score = min(1.0, max(0.0, score))
        except (ValueError, IndexError):
            score = 0.0
        total += score
    return total / max(1, len(sample))


def run():
    dataset = load_dataset()
    print(f"Evaluating {len(dataset)} questions over {len(CORPUS)} documents "
          f"(k={TOP_K}, top_n={TOP_N})\n")
    runs = []
    for chunk_size in CHUNK_SIZES:
        index, gold_counts = build_index(chunk_size)
        total_chunks = sum(gold_counts.values())
        print(f"chunk_size={chunk_size}: {total_chunks} chunks in index")
        for use_reranker in RERANKER_OPTIONS:
            rm = retrieval_metrics(index, gold_counts, dataset, use_reranker)
            faith = faithfulness_metric(index, dataset, use_reranker)
            run_result = {
                "config": {"chunk_size": chunk_size, "use_reranker": use_reranker},
                "recall_at_k": rm["recall_at_k"],
                "hit_rate_at_k": rm["hit_rate_at_k"],
                "mrr": rm["mrr"],
                "faithfulness": faith,
            }
            runs.append(run_result)
            print(f"  reranker={use_reranker!s:5}  "
                  f"recall@{TOP_K}={rm['recall_at_k']:.3f}  "
                  f"hit@{TOP_K}={rm['hit_rate_at_k']:.3f}  "
                  f"MRR={rm['mrr']:.3f}  faithfulness={faith:.3f}")

    results = {
        "k": TOP_K,
        "num_questions": len(dataset),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runs": runs,
    }
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {RESULTS_PATH}")
    return results


if __name__ == "__main__":
    run()
