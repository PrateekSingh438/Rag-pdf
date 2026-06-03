"""Domain feature: generate a day-by-day study plan from a KB's material. Uses the
notes + exam papers so the plan front-loads the highest-yield, most-tested topics
and ends with revision and a mock test. Returns a structured, day-keyed plan."""
import json
from .store import get_chunks
from .llm import chat

_PROMPT = (
    "You are a study coach. Build a {days}-day revision plan (about {hours} hours "
    "per day) for a student, using ONLY the material below (their NOTES and PAST "
    "EXAM PAPERS). Prioritise the topics that recur and are most heavily tested in "
    "the exams early in the plan, group related topics sensibly, and finish with "
    "revision and a mock test. Each day has a short focus, the topics to cover, and "
    "2-4 concrete tasks (e.g. read notes on X, do practice questions, attempt past "
    "exam question on Y).\n"
    "Return ONLY valid JSON of this exact shape:\n"
    '{{"overview": "1-2 sentence summary", "days": [{{"day": 1, "focus": "...", '
    '"topics": ["..."], "tasks": ["..."]}}]}}\n'
    "Produce exactly {days} day objects. Use only the material provided.\n\n"
    "NOTES:\n{notes}\n\nEXAM PAPERS:\n{exams}"
)


def generate_study_plan(kb_id, days=7, hours_per_day=2):
    notes = get_chunks(kb_id, doc_type="notes")
    exams = get_chunks(kb_id, doc_type="exam")
    if not notes and not exams:
        return None
    notes_txt = ("\n\n".join(c["text"] for c in notes)[:6000]) or "(no notes provided)"
    exams_txt = ("\n\n".join(c["text"] for c in exams)[:4000]) or "(no exam papers provided)"

    raw = chat([{"role": "user", "content": _PROMPT.format(
        days=days, hours=hours_per_day, notes=notes_txt, exams=exams_txt)}],
        temperature=0.3, max_tokens=1600, response_format={"type": "json_object"})
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        s, e = raw.find("{"), raw.rfind("}")
        data = json.loads(raw[s:e + 1])

    out_days = []
    for i, d in enumerate(data.get("days", []), 1):
        out_days.append({
            "day": d.get("day", i) if isinstance(d.get("day"), int) else i,
            "focus": (d.get("focus") or "").strip(),
            "topics": [str(t) for t in (d.get("topics") or [])],
            "tasks": [str(t) for t in (d.get("tasks") or [])],
        })
    return {"overview": (data.get("overview") or "").strip(), "days": out_days}
