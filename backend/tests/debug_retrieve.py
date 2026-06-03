"""Phase 3 debug harness: run the retrieval pipeline with and without the
cross-encoder reranker for a given KB + question, and print the ordering and
scores side by side so the reranker's effect is visible.

Usage: python -m tests.debug_retrieve <kb_id> "your question"
"""
import sys
import warnings
warnings.filterwarnings("ignore")

from app.rag.retriever import retrieve


def show(title, hits):
    print(f"\n--- {title} ---")
    for rank, h in enumerate(hits, 1):
        m = h["metadata"]
        rr = f"  rerank={h['rerank_score']:.3f}" if "rerank_score" in h else ""
        print(f"{rank}. vec={h['score']:.3f}{rr}  "
              f"({m['source_file']} p{m.get('page')}) {h['text'][:70]!r}")


if __name__ == "__main__":
    kb_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    query = sys.argv[2] if len(sys.argv) > 2 else "What is a binary search tree?"
    print(f"KB={kb_id}  Query={query!r}")
    show("WITHOUT reranker (pure vector order)",
         retrieve(kb_id, query, top_n=10, top_k=5, use_reranker=False))
    show("WITH cross-encoder reranker",
         retrieve(kb_id, query, top_n=10, top_k=5, use_reranker=True))
