"""Domain feature: surface past exam questions related to the concept by
retrieving specifically from documents tagged doc_type='exam'."""
from .retriever import retrieve


def find_related_exam_questions(kb_id, query, top_k=3):
    hits = retrieve(kb_id, query, top_k=top_k, use_reranker=True, doc_type="exam")
    return [{"source_file": h["metadata"]["source_file"], "page": h["metadata"].get("page"),
             "snippet": h["text"][:300]} for h in hits]
