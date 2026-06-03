"""Builds the grounded prompt. The system prompt forbids outside knowledge and
forces citations + an explicit 'not found' answer — this is what kills
hallucination. Sources are labeled [S1], [S2]... and echoed back as citations."""
SYSTEM_PROMPT = (
    "You are StudyMate, a study assistant. Answer the student's question using "
    "ONLY the provided sources.\n"
    "Rules:\n"
    "- Use only information in the sources below. Do not use outside knowledge.\n"
    "- Cite sources inline using their tags, e.g. [S1], [S2].\n"
    "- If the sources do not contain the answer, reply exactly: "
    "\"I couldn't find this in your uploaded documents.\"\n"
    "- Be clear and concise, like good revision notes."
)


def _context(hits) -> str:
    out = []
    for i, h in enumerate(hits, 1):
        m = h["metadata"]
        out.append(f"[S{i}] (from {m['source_file']}, page {m.get('page', '?')})\n{h['text']}")
    return "\n\n".join(out)


def build_messages(question, hits, history=None):
    """Assemble the chat messages. `history` is an optional list of prior
    {"role", "content"} turns in this conversation, inserted between the system
    rules and the current grounded question so the model can resolve follow-ups
    ("explain that again", "what about deletion?") while still answering only from
    the freshly retrieved sources."""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append(
        {"role": "user", "content": f"Sources:\n\n{_context(hits)}\n\nQuestion: {question}"}
    )
    return messages


def citations_from_hits(hits):
    cites = []
    for i, h in enumerate(hits, 1):
        m = h["metadata"]
        cites.append({"tag": f"S{i}", "source_file": m["source_file"],
                      "page": m.get("page"), "doc_type": m.get("doc_type"),
                      "doc_id": m.get("doc_id"), "snippet": h["text"][:300]})
    return cites
