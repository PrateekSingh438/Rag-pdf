"""Cross-document study insights: scans ALL of a KB's material (notes + exam
papers) and ranks the highest-yield topics — those most often tested in the exams
('most scoring') and recurring across the notes. Powers the 'Key topics' view."""
import json
from .store import get_chunks
from .llm import chat

_PROMPT = (
    "You are analysing a student's study material for one course. Below are "
    "excerpts from their NOTES and their PAST EXAM PAPERS. Identify the key topics "
    "and, for each, judge how heavily it is tested and how central it is, so the "
    "student knows what to prioritise. List the most important topics first.\n"
    "Return ONLY valid JSON of this shape:\n"
    '{{"topics": [{{"topic": "...", "exam_frequency": 3, "in_notes": true, '
    '"importance": "high", "example": "a representative exam question or key point"}}]}}\n'
    "Rules: exam_frequency = number of distinct past-exam questions related to the "
    "topic (0 if it does not appear in the exams). importance is high|medium|low, "
    "reflecting how high-yield/scoring it is. Use ONLY the material provided.\n\n"
    "NOTES:\n{notes}\n\nEXAM PAPERS:\n{exams}"
)

_ORDER = {"high": 0, "medium": 1, "low": 2}


def analyze_study_topics(kb_id):
    """Returns a ranked list of topic dicts, or None if the KB has no documents."""
    notes = get_chunks(kb_id, doc_type="notes")
    exams = get_chunks(kb_id, doc_type="exam")
    if not notes and not exams:
        return None
    notes_txt = ("\n\n".join(c["text"] for c in notes)[:6000]) or "(no notes provided)"
    exams_txt = ("\n\n".join(c["text"] for c in exams)[:4000]) or "(no exam papers provided)"

    raw = chat([{"role": "user",
                 "content": _PROMPT.format(notes=notes_txt, exams=exams_txt)}],
               temperature=0.2, max_tokens=1100, response_format={"type": "json_object"})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        s, e = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[s:e + 1])

    topics = []
    for t in data.get("topics", []):
        name = (t.get("topic") or "").strip()
        if not name:
            continue
        freq = t.get("exam_frequency", 0)
        if not isinstance(freq, int):
            try:
                freq = int(freq)
            except (ValueError, TypeError):
                freq = 0
        imp = (t.get("importance") or "medium").lower()
        if imp not in _ORDER:
            imp = "medium"
        topics.append({
            "topic": name,
            "exam_frequency": freq,
            "in_notes": bool(t.get("in_notes", True)),
            "importance": imp,
            "example": (t.get("example") or "").strip(),
        })
    topics.sort(key=lambda x: (_ORDER[x["importance"]], -x["exam_frequency"]))
    return topics
