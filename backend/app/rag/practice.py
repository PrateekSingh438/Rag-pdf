"""Domain feature: generate practice questions grounded in the student's notes."""
from .retriever import retrieve
from .llm import chat

_PROMPT = (
    "Using ONLY the study material below, write {n} practice questions on the "
    "topic, mixing easy/medium/hard. For each, give the question and a short "
    "answer. Use only the material; do not invent facts.\n\n"
    "Material:\n{material}\n\nTopic: {topic}"
)


def generate_practice_questions(kb_id, topic, n=5):
    hits = retrieve(kb_id, topic, top_n=12, top_k=6, use_reranker=True, doc_type="notes")
    if not hits:
        return "I couldn't find this topic in your uploaded notes."
    material = "\n\n".join(h["text"] for h in hits)
    return chat([{"role": "user", "content": _PROMPT.format(n=n, material=material, topic=topic)}],
                temperature=0.4, max_tokens=1200)
