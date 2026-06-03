"""Phase 4 debug harness: retrieve -> build grounded prompt -> call the LLM ->
print the answer and its citations. Run with an in-domain and an off-domain
question to confirm grounding and the explicit 'not found' path.

Usage: python -m tests.debug_generate <kb_id> "your question"
"""
import sys
import json
import warnings
warnings.filterwarnings("ignore")

from app.rag.retriever import retrieve
from app.rag.generator import build_messages, citations_from_hits
from app.rag.llm import chat


def answer(kb_id, question):
    print(f"\n=== Q: {question!r} ===")
    hits = retrieve(kb_id, question, top_n=10, top_k=5, use_reranker=True)
    messages = build_messages(question, hits)
    out = chat(messages)
    print("ANSWER:\n" + out)
    print("\nCITATIONS:")
    for c in citations_from_hits(hits):
        print(f"  [{c['tag']}] {c['source_file']} p{c['page']} ({c['doc_type']})")


if __name__ == "__main__":
    kb_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    if len(sys.argv) > 2:
        answer(kb_id, sys.argv[2])
    else:
        answer(kb_id, "What is a binary search tree and what is its ordering property?")
        answer(kb_id, "What is the capital of France?")  # off-domain -> not found
