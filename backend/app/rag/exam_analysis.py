"""Domain feature: mine the KB's uploaded exam papers to surface the highest-yield
topics — which concepts are tested most often — so students can prioritise."""
import json
from .store import get_chunks
from .llm import chat

_PROMPT = (
    "Below are excerpts from a student's past exam papers. Identify the main "
    "recurring topics and, for each, estimate how many questions relate to it and "
    "give one short example question. Focus on the most frequently tested topics, "
    "ordered from most to least common. Respond with ONLY valid JSON of this shape:\n"
    '{{"topics": [{{"topic": "...", "count": 3, "example": "..."}}]}}\n\n'
    "Exam excerpts:\n{material}"
)


def analyze_exams(kb_id):
    """Returns a ranked list of {topic, count, example}, or None if the KB has no
    exam-tagged documents yet."""
    chunks = get_chunks(kb_id, doc_type="exam")
    if not chunks:
        return None
    material = "\n\n".join(c["text"] for c in chunks)[:8000]  # bound prompt size
    raw = chat([{"role": "user", "content": _PROMPT.format(material=material)}],
               temperature=0.2, max_tokens=900, response_format={"type": "json_object"})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[start:end + 1])

    topics = []
    for t in data.get("topics", []):
        name = (t.get("topic") or "").strip()
        if not name:
            continue
        count = t.get("count", 1)
        if not isinstance(count, int):
            try:
                count = int(count)
            except (ValueError, TypeError):
                count = 1
        topics.append({"topic": name, "count": count, "example": (t.get("example") or "").strip()})
    topics.sort(key=lambda x: x["count"], reverse=True)
    return topics
