"""Split page text into overlapping word-windows. Overlap preserves context that
would otherwise be cut at a chunk boundary. chunk_size/overlap are tunable — this
is what you ablate in evaluation."""
import re


def _clean(t: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def chunk_document(pages, source_file, doc_type, chunk_size=512, overlap=64):
    chunks, idx = [], 0
    step = max(1, chunk_size - overlap)
    for p in pages:
        text = _clean(p["text"])
        if not text:
            continue
        words = text.split()
        i = 0
        while i < len(words):
            piece = " ".join(words[i:i + chunk_size])
            chunks.append({
                "text": piece,
                "metadata": {"source_file": source_file, "doc_type": doc_type,
                             "page": p["page"], "chunk_index": idx},
            })
            idx += 1
            i += step
    return chunks
