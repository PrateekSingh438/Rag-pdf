# StudyMate — Study Guide & Interview Defense

This document explains every concept behind StudyMate in plain language, traces a
single question through the whole system, justifies the design decisions, and
lists likely interview questions with crisp answers. If you can explain this file,
you can defend the project.

---

## 1. Concept explainers (plain language)

### Embeddings & cosine similarity
An **embedding** is a list of numbers (a vector) that represents the *meaning* of a
piece of text. Our model, `BAAI/bge-small-en-v1.5`, turns any chunk of text into a
**384-dimensional** vector. Texts with similar meaning land close together in this
space, even if they use different words ("car" vs "automobile").

We compare two vectors with **cosine similarity** — the cosine of the angle
between them. It ranges from −1 (opposite) to 1 (identical direction) and ignores
length, so it measures *direction* (meaning) not *magnitude*. We **normalize**
every embedding to unit length, which makes cosine similarity equal to the dot
product — cheaper to compute, and exactly what Chroma's `hnsw:space: cosine`
collection uses. *(See `app/rag/store.py`.)*

### Chunking and the size/overlap trade-off
LLMs and embedders work on bounded spans of text, and retrieval is more precise
when each unit is a focused passage rather than a whole document. So we split each
page into **overlapping word windows** (`chunk_size=512`, `overlap=64`). *(See
`app/rag/chunker.py`.)*

- **Too large** → each chunk mixes several topics, embeddings get "blurry," and
  retrieval returns loosely-relevant text.
- **Too small** → a single idea gets split across chunks and loses context.
- **Overlap** copies the last ~64 words of one chunk into the next so a sentence
  cut at a boundary still appears whole in at least one chunk.

`chunk_size` is one axis of our evaluation ablation — see §3.

### Vector store & nearest-neighbor search
A **vector store** holds embeddings and answers the question "which stored vectors
are closest to this query vector?" — a **nearest-neighbor** search. Scanning every
vector is O(n); production stores use an **approximate** index (Chroma uses
**HNSW**, a navigable small-world graph) to find near-neighbors in roughly
O(log n). Each knowledge base gets its **own Chroma collection** (`kb_{id}`) so one
user's vectors are never searched against another's. *(See `app/rag/store.py`.)*

### Bi-encoder vs cross-encoder reranking
- A **bi-encoder** (our embedder) encodes the query and each chunk **separately**
  into vectors, then compares vectors. It is **fast** (chunks are embedded once at
  upload) but approximate — it never sees the query and chunk *together*.
- A **cross-encoder** (`cross-encoder/ms-marco-MiniLM-L-6-v2`) takes the query and
  one chunk **together** as a single input and outputs a relevance score. It is far
  more **accurate** but **slow** (it must run once per candidate at query time).

So we use both in a **two-stage retrieve-then-rerank** pipeline: the bi-encoder
casts a wide, cheap net (`top_n=10` candidates), then the cross-encoder carefully
re-scores just those candidates and keeps the best (`top_k=5`). *(See
`app/rag/retriever.py` and `app/rag/reranker.py`.)*

### The grounding prompt and how it prevents hallucination
A raw LLM answers from its training memory and will confidently invent things. We
**ground** it: the system prompt (in `app/rag/generator.py`) says to use **only**
the provided sources, to **cite** them inline as `[S1]`, `[S2]`, and — critically —
if the sources don't contain the answer, to reply **exactly** "I couldn't find
this in your uploaded documents." The user turn contains the retrieved chunks
labeled `[S1]…[Sn]` plus the question. This does three things: it constrains the
answer to retrieved evidence, it makes every claim traceable to a source, and it
gives the model an explicit "I don't know" exit instead of guessing.

### recall@k / MRR / faithfulness (how we measure quality)
- **recall@k** — of the questions, what fraction retrieved a chunk from the
  *correct* document within the top *k* results? Measures "did we find the right
  material at all."
- **hit-rate@k** — here, the same doc-level quantity (each question has one gold
  document), reported alongside recall.
- **MRR (Mean Reciprocal Rank)** — averages `1/rank` of the first correct chunk.
  Rank 1 → 1.0, rank 2 → 0.5, etc. Rewards putting the right chunk **first**, so it
  captures *ordering* quality, which is exactly what reranking improves.
- **faithfulness** — an **LLM-as-judge** metric: we give a judge model the
  retrieved sources and the generated answer and ask for a 0–1 score of whether
  *every claim is supported*. Catches hallucination even when retrieval was fine.

Retrieval metrics need **no LLM** (pure set/rank math); faithfulness does. *(See
`app/eval/run_eval.py`.)*

---

## 2. Data-flow walkthrough — one question, end to end

A student types "Explain AVL balancing" and hits send.

1. **Browser** — `components/ChatPanel.tsx` calls `streamChat()` in `lib/api.ts`,
   which POSTs `{question, conversation_id}` to `/chat/{kb_id}` with the JWT in the
   `Authorization` header and starts reading the response stream.
2. **Auth + ownership** — `app/routers/chat.py` resolves the user from the JWT
   (`app/auth.py → get_current_user`) and confirms they own that knowledge base.
3. **Retrieve** — `app/rag/retriever.py → retrieve()` calls
   `app/rag/store.py → vector_search()`: it embeds the question, runs HNSW
   nearest-neighbor search in the KB's Chroma collection, and returns the `top_n=10`
   candidate chunks with scores.
4. **Rerank** — `app/rag/reranker.py → rerank()` scores each candidate with the
   cross-encoder and keeps the best `top_k=5`.
5. **Build the grounded prompt** — `app/rag/generator.py → build_messages()`
   formats the chunks as `[S1]…[S5]` with file/page labels and the system rules.
   `citations_from_hits()` builds the citation objects in parallel, and
   `app/rag/exam_linker.py` runs a second, exam-only retrieval for related past
   questions.
6. **Stream** — `app/rag/llm.py → chat_stream()` calls Groq with `stream=True`; the
   route wraps each token as an SSE `data: {"type":"token",...}` event. The browser
   appends each token to the assistant bubble live.
7. **Persist** — when the token stream ends, the route opens a **fresh DB session**
   (the request session is already closed once streaming began) and saves the user
   and assistant messages (citations stored as a JSON string) under a Conversation.
8. **Final metadata** — the route sends one last SSE `done` event carrying the
   `conversation_id`, `citations`, and `exam_links`. `ChatPanel` attaches these to
   the message; `MessageBubble.tsx` renders inline `[S1]` chips and the "Appeared in
   your exams" section. Clicking a chip opens `CitationDrawer.tsx` with the exact
   snippet, file, page, and type.

---

## 3. The evaluation & what improved (measured)

We run an **ablation** over `{chunk_size: 256, 512} × {use_reranker: on, off}`
against an 18-question labeled dataset over 9 deliberately confusable
data-structures topics (`app/eval/`). Headline findings:

- **Reranking improves ranking quality (MRR) in every configuration**, lifting MRR
  from **0.880 → 0.972** — the right chunk is pushed to the top far more often.
- **Reranking improves recall@3** at the finer `chunk_size=256` (more, more-competitive
  chunks) from **0.889 → 0.917**. At `chunk_size=512` recall@3 is already saturated
  at 1.0 because each short doc becomes a single, strong vector — so there is no
  recall headroom and the reranker's gain shows up purely in MRR.
- **Faithfulness** stays high (~1.0) thanks to the grounding prompt: the model
  sticks to the sources or says it can't find the answer.

The teaching point: the **value of a cross-encoder reranker is in ordering**, and it
matters most when first-stage retrieval is *competitive* (many similar chunks). The
chunk-size axis shows the classic trade-off: coarse chunks ease doc-level recall but
blur precision; fine chunks need a reranker to sort out the competition.

*(Numbers are reproduced live by `python -m app.eval.run_eval`, which writes
`app/eval/results.json`, served at `GET /eval` and charted on the `/evals` page.)*

---

## 4. Why-this-design notes

- **Per-KB Chroma collections** (`kb_{id}`) — hard data isolation between users and
  between courses, and smaller per-query search spaces. The alternative (one
  collection with a `user_id` filter) is one mistaken filter away from a data leak.
- **Background ingestion** (`BackgroundTasks` → `ingest_service.py`) — chunking and
  embedding a PDF takes seconds; doing it inside the upload request would block the
  user. Instead we save the file, return immediately with `status="processing"`, and
  flip to `ready`/`failed` when done. The UI polls and shows a live badge.
- **JWT auth** (`app/auth.py`) — stateless tokens mean the API needs no server-side
  session store and scales horizontally; the signature proves identity on every
  request. We hash passwords with **bcrypt** (salted, slow by design).
- **Reranking** — see §1; cheap recall first, expensive precision second.
- **Citations stored as JSON** (`Message.citations`) — a citation is a small,
  read-as-a-unit list of `{tag, file, page, type, snippet}`. Storing it as a JSON
  string keeps the schema simple and avoids a join table we'd only ever fetch whole.
  The trade-off (can't query *inside* the JSON) doesn't matter — we never do.
- **Plain RAG code, no LangChain/LlamaIndex** — every step (chunk, embed, search,
  rerank, prompt, stream) is a few lines of readable code we can explain and tune,
  instead of a framework abstraction we'd have to reverse-engineer.
- **Provider-agnostic LLM** (`app/rag/llm.py`, model id from env) — swap Groq for
  another OpenAI-compatible provider by changing `.env`, no code change.

---

## 5. Likely interview questions (with crisp answers)

**Q: Why only vector search — why not hybrid (keyword + vector)?**
Vector search alone keeps the system simple and handles paraphrase well. Hybrid
(BM25 + vectors) helps with rare exact terms (codes, acronyms) the embedder
generalizes away. It's the first item on our future-work list; we'd fuse the two
rankings (e.g., reciprocal rank fusion) before reranking.

**Q: What happens if retrieval returns nothing relevant?**
Two safety nets. The grounding prompt forces the exact reply "I couldn't find this
in your uploaded documents," and `find_related_exam_questions`/practice paths
return explicit "not found" strings. We never let the model fall back to its
training memory.

**Q: How do you stop hallucination?**
Grounding. The model may use **only** the provided sources, must **cite** them, and
must say it can't find the answer otherwise. We then **measure** it with the
LLM-as-judge faithfulness metric, so the claim is backed by numbers, not vibes.

**Q: How did you measure quality, and what improved it?**
A labeled dataset with a gold document per question, plus a 2×2 ablation. We report
recall@k, hit-rate@k, MRR (no LLM), and faithfulness (LLM-judge). Reranking lifted
MRR from 0.880 to 0.972 and recall@3 from 0.889 to 0.917 at the finer chunk size —
the concrete justification for paying the cross-encoder's cost.

**Q: Why a cross-encoder reranker over just better embeddings?**
A bi-encoder must compress a chunk's meaning into one vector *before* it sees the
query, so it can't reason about query-specific relevance. The cross-encoder reads
query and chunk jointly and judges *this* chunk for *this* question — strictly more
information, hence more accurate. We can't afford it on the whole corpus, so we run
it only on the bi-encoder's top candidates.

**Q: Why store one Chroma collection per knowledge base?**
Isolation and locality (see §4). It also makes "delete this KB" trivial — drop the
collection — and keeps each search space small.

**Q: Why does DB persistence in the chat endpoint use a new session?**
`StreamingResponse` returns control to the framework and the request-scoped DB
session (`Depends(get_db)`) is closed once streaming starts. The generator runs
*after* that, so it opens its own `SessionLocal()` to write the messages.

**Q: How would you scale this?**
Move embeddings/reranking to a GPU worker or a managed embedding API; replace the
embedded Chroma with a server vector DB (Qdrant/pgvector) for concurrency and
sharding; put the LLM behind a queue with backpressure; cache hot queries; and run
several stateless API replicas behind a load balancer (JWT makes this easy). Move
ingestion to a real task queue (e.g., Celery/RQ) instead of in-process background
tasks.

**Q: What are the security considerations?**
Every data route is scoped by `owner_id`, so users only ever touch their own KBs.
Passwords are bcrypt-hashed; secrets live in `.env`. The JWT is currently stored in
the browser's localStorage (simple, but XSS-readable) — a hardening step is an
HttpOnly cookie. Uploads are restricted to PDFs and filenames are sanitized.

**Q: What are the main limitations / what would you do next?**
Hybrid search, a server-grade vector DB, response/embedding caching, PDF-page
highlight in the citation drawer, OCR for scanned PDFs, and per-user rate limiting.
