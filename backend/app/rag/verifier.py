"""Agentic self-check: after an answer is drafted, a verifier pass reads the
sources and the draft and flags claims the sources don't support. If anything
fails, a single bounded revision rewrites the answer from the same sources.

One critique call per answer (always the fast default model) and one revision
call only when needed; the loop never iterates further, so latency and free-tier
cost stay bounded. Runs after the tokens have streamed, so it never delays the
first token — the corrected text, when there is one, replaces the draft in the
final metadata event."""
import json
import logging
from .llm import chat
from .generator import SYSTEM_PROMPT, NOT_FOUND_ANSWER

logger = logging.getLogger(__name__)

_CHECK_SYSTEM = (
    "You are a strict fact-checker for a study assistant. You are given SOURCES "
    "and an ANSWER. Decide whether every factual claim in the ANSWER is supported "
    "by the SOURCES. Citation tags like [S1] are not claims; ignore them. The "
    f"exact reply \"{NOT_FOUND_ANSWER}\" always passes. Respond with ONLY valid "
    'JSON of this shape: {"verdict": "pass", "unsupported": []} where verdict is '
    '"pass" or "fail" and unsupported briefly quotes each unsupported claim.'
)


def _sources(hits) -> str:
    return "\n\n".join(f"[S{i}] {h['text']}" for i, h in enumerate(hits, 1))


def self_check(answer: str, hits) -> dict:
    """Returns {"verdict": "pass"|"fail", "unsupported": [...], "revised": False}.
    Raises on LLM/JSON failure — callers treat that as "check unavailable"."""
    raw = chat(
        [{"role": "system", "content": _CHECK_SYSTEM},
         {"role": "user", "content": f"SOURCES:\n{_sources(hits)}\n\nANSWER:\n{answer}"}],
        temperature=0.0, max_tokens=400, response_format={"type": "json_object"})
    data = json.loads(raw)
    verdict = "pass" if str(data.get("verdict", "pass")).lower() == "pass" else "fail"
    unsupported = [str(c)[:200] for c in (data.get("unsupported") or []) if str(c).strip()][:5]
    if verdict == "fail" and not unsupported:
        # A fail with no named claims isn't actionable; don't trigger a revision.
        verdict = "pass"
    return {"verdict": verdict, "unsupported": unsupported, "revised": False}


def revise_answer(question: str, hits, draft: str, unsupported: list, model=None) -> str:
    """One-shot revision: rewrite the draft so every claim is grounded in the
    sources. Uses the same model the draft was written with."""
    issues = "\n".join(f"- {c}" for c in unsupported)
    user = (
        f"Sources:\n\n{_sources(hits)}\n\nQuestion: {question}\n\n"
        f"Your previous draft:\n{draft}\n\n"
        "A fact-check found these claims are NOT supported by the sources:\n"
        f"{issues}\n\n"
        "Rewrite the answer using ONLY the sources: correct or remove the "
        "unsupported claims, keep everything that is supported, and keep inline "
        "[S#] citations. If the sources truly do not contain the answer, reply "
        f"exactly: \"{NOT_FOUND_ANSWER}\""
    )
    return chat([{"role": "system", "content": SYSTEM_PROMPT},
                 {"role": "user", "content": user}],
                temperature=0.2, max_tokens=1024, model=model).strip()
