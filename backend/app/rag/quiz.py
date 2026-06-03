"""Domain feature: generate interactive multiple-choice quiz questions grounded
in the student's notes. The LLM returns structured JSON (one correct option per
question plus an explanation), which we parse and sanitize before returning."""
import json
from .retriever import retrieve
from .llm import chat

_PROMPT = (
    "Using ONLY the study material below, write {n} multiple-choice quiz questions "
    "on the topic, mixing difficulty. Each question must have exactly 4 options with "
    "exactly one correct answer, plus a one-sentence explanation grounded in the "
    "material. Do not invent facts beyond the material.\n"
    "Respond with ONLY valid JSON of this exact shape:\n"
    '{{"questions": [{{"question": "...", "options": ["..", "..", "..", ".."], '
    '"answer_index": 0, "explanation": "..."}}]}}\n\n'
    "Material:\n{material}\n\nTopic: {topic}"
)


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            raise
        return json.loads(text[start:end + 1])


def generate_quiz(kb_id, topic, n=5):
    hits = retrieve(kb_id, topic, top_n=12, top_k=6, use_reranker=True, doc_type="notes")
    if not hits:
        return []
    material = "\n\n".join(h["text"] for h in hits)
    raw = chat(
        [{"role": "user", "content": _PROMPT.format(n=n, material=material, topic=topic)}],
        temperature=0.3, max_tokens=1500, response_format={"type": "json_object"},
    )
    data = _parse_json(raw)

    clean = []
    for q in data.get("questions", []):
        question = (q.get("question") or "").strip()
        options = [str(o) for o in (q.get("options") or [])]
        if not question or len(options) < 2:
            continue
        idx = q.get("answer_index", 0)
        if not isinstance(idx, int) or not (0 <= idx < len(options)):
            idx = 0
        clean.append({
            "question": question,
            "options": options,
            "answer_index": idx,
            "explanation": (q.get("explanation") or "").strip(),
        })
    return clean
