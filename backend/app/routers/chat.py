"""Streaming chat. Retrieve -> build prompt -> stream tokens -> persist -> send
final metadata (citations + exam links). DB writes happen in a fresh session
inside the generator because the request-scoped session closes when streaming
starts. Exam links are computed inside the stream, after the tokens, so they
never delay the first token.

Also exposes conversation history endpoints (list / detail / rename / delete),
each scoped to the authenticated user's knowledge bases."""
import json
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..ratelimit import limiter
from ..auth import get_current_user
from ..models import User, KnowledgeBase, Conversation, Message
from ..schemas import ConversationOut, ConversationDetail, ConversationUpdate, MessageOut
from ..config import settings
from ..rag.retriever import retrieve
from ..rag.generator import build_messages, citations_from_hits, NOT_FOUND_ANSWER
from ..rag.llm import chat, chat_stream
from ..rag.exam_linker import find_related_exam_questions
from ..rag.verifier import self_check, revise_answer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Inline citation tags ([S1], [S2]...) only mean something next to the sources of
# the SAME turn. Strip them from history so the model doesn't imitate tags that
# point at sources the current answer doesn't have.
_TAG_RE = re.compile(r"\s*\[S\d+\]")
# Words that signal the question leans on conversation context.
_REFERENTIAL = re.compile(
    r"\b(that|this|it|these|those|above|previous|last|again|more|same|elaborate)\b", re.I)

_REWRITE_SYSTEM = (
    "Rewrite the student's follow-up message as ONE standalone search query about "
    "their study material, resolving references like 'that' or 'it' from the "
    "conversation. Keep it short. Output ONLY the rewritten query."
)


def _owned_kb_or_404(kb_id: int, user: User, db: Session) -> KnowledgeBase:
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, owner_id=user.id).first()
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    return kb


def _owned_conversation_or_404(conv_id: int, user: User, db: Session) -> Conversation:
    conv = (db.query(Conversation)
            .join(KnowledgeBase, Conversation.kb_id == KnowledgeBase.id)
            .filter(Conversation.id == conv_id, KnowledgeBase.owner_id == user.id)
            .first())
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


def _retrieval_query(question: str, prior: list) -> str:
    """A follow-up like "explain that again" retrieves garbage on its own. When the
    question looks context-dependent, ask the (fast, default) LLM to rewrite it as
    a standalone query; fall back to prepending the previous question if that
    fails. Standalone questions pass through untouched."""
    if not prior:
        return question
    if len(question.split()) > 12 and not _REFERENTIAL.search(question):
        return question
    last_user = next((m.content for m in reversed(prior) if m.role == "user"), None)
    if not last_user:
        return question
    convo = "\n".join(f"{m.role}: {m.content[:300]}" for m in prior[-4:])
    try:
        rewritten = chat(
            [{"role": "system", "content": _REWRITE_SYSTEM},
             {"role": "user", "content": f"Conversation:\n{convo}\n\nFollow-up: {question}"}],
            temperature=0.0, max_tokens=60).strip().strip('"')
        if rewritten:
            return rewritten
    except Exception:
        logger.warning("Follow-up query rewrite failed; using heuristic", exc_info=True)
    return f"{last_user} {question}"


def _mark_used_citations(citations: list, answer: str) -> list:
    """Flag which retrieved sources the answer actually cited, so the UI can show
    real citations prominently and the merely-retrieved ones dimmed."""
    used = set(re.findall(r"\[S(\d+)\]", answer))
    for c in citations:
        c["used"] = c["tag"].lstrip("S") in used
    return citations


@router.post("/{kb_id}")
@limiter.limit("30/minute")
def chat_endpoint(request: Request, kb_id: int, payload: dict, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    _owned_kb_or_404(kb_id, user, db)
    question = payload.get("question")
    if not question:
        raise HTTPException(400, "question is required")
    conversation_id = payload.get("conversation_id")
    model = payload.get("model")  # optional LLM override; validated in chat_stream
    regenerate = bool(payload.get("regenerate"))

    # Load prior turns for multi-turn context.
    history, prior = [], []
    if conversation_id:
        conv = db.query(Conversation).filter_by(id=conversation_id, kb_id=kb_id).first()
        if conv:
            prior = (db.query(Message)
                     .filter_by(conversation_id=conv.id)
                     .order_by(Message.created_at.asc(), Message.id.asc())
                     .all())
    if regenerate and prior:
        # Regenerating the last answer: the model shouldn't see (or repeat) it,
        # and the question is already the conversation's last user message.
        if prior[-1].role == "assistant":
            prior = prior[:-1]
        if prior and prior[-1].role == "user" and prior[-1].content == question:
            prior = prior[:-1]
    history = [{"role": m.role, "content": _TAG_RE.sub("", m.content)}
               for m in prior[-6:]]
    retrieval_query = _retrieval_query(question, prior)

    hits = retrieve(kb_id, retrieval_query, top_n=10, top_k=5, use_reranker=True)
    citations = citations_from_hits(hits)
    messages = build_messages(question, hits, history=history)

    def persist(full: str, cites: list, verification: dict | None) -> int:
        # Persist with a fresh session (the request session is closed by now).
        s = SessionLocal()
        try:
            conv = s.get(Conversation, conversation_id) if conversation_id else None
            # never append to a conversation outside this KB
            if conv and conv.kb_id != kb_id:
                conv = None
            if not conv:
                conv = Conversation(kb_id=kb_id, title=question[:60])
                s.add(conv)
                s.flush()
            if regenerate:
                # The new answer replaces the old one instead of stacking under it.
                old = (s.query(Message)
                       .filter_by(conversation_id=conv.id, role="assistant")
                       .order_by(Message.created_at.desc(), Message.id.desc())
                       .first())
                if old:
                    s.delete(old)
            else:
                s.add(Message(conversation_id=conv.id, role="user", content=question))
            s.add(Message(conversation_id=conv.id, role="assistant",
                          content=full, citations=json.dumps(cites),
                          verification=json.dumps(verification) if verification else None))
            s.commit()
            return conv.id
        finally:
            s.close()

    def stream():
        full = ""
        if not hits:
            # Nothing relevant in the KB — answer honestly without an LLM call.
            full = NOT_FOUND_ANSWER
            yield f"data: {json.dumps({'type': 'token', 'content': full})}\n\n"
        else:
            try:
                for tok in chat_stream(messages, model=model):
                    full += tok
                    yield f"data: {json.dumps({'type': 'token', 'content': tok})}\n\n"
            except Exception as e:
                # Don't let an LLM error (e.g. Groq 429 rate limit) kill the stream —
                # emit a readable message and still finish cleanly.
                logger.warning("LLM stream failed: %s", e)
                rate = "rate_limit" in str(e).lower() or "429" in str(e)
                msg = ("The AI service has hit its free-tier rate limit. Please try again "
                       "in a few minutes." if rate
                       else "Sorry — the AI service is temporarily unavailable. Please try again.")
                note = ("\n\n_" + msg + "_") if full.strip() else ("⚠️ " + msg)
                full += note
                yield f"data: {json.dumps({'type': 'token', 'content': note})}\n\n"

        # Agentic self-check: verify the draft's claims against the sources and,
        # if anything is unsupported, do one bounded revision. Runs after the
        # stream so it never delays tokens; a failure just skips the badge.
        verification = None
        if settings.self_check and hits and full.strip() and NOT_FOUND_ANSWER not in full:
            try:
                verification = self_check(full, hits)
                if verification["verdict"] == "fail":
                    revised = revise_answer(question, hits, full,
                                            verification["unsupported"], model=model)
                    if revised:
                        full = revised
                        verification["revised"] = True
            except Exception:
                logger.warning("Self-check unavailable for this answer", exc_info=True)
                verification = None

        cites = _mark_used_citations(citations, full)
        # Related past-exam questions are nice-to-have metadata: computed after the
        # tokens so they never delay the answer, and never allowed to break it.
        exam_links = []
        if hits:
            try:
                exam_links = find_related_exam_questions(kb_id, retrieval_query)
            except Exception:
                logger.warning("Exam-link lookup failed", exc_info=True)
        cid = persist(full, cites, verification)
        done = {"type": "done", "conversation_id": cid, "citations": cites,
                "exam_links": exam_links, "verification": verification}
        if verification and verification.get("revised"):
            # The revised text replaces the streamed draft on the client.
            done["content"] = full
        yield "data: " + json.dumps(done) + "\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(kb_id: int, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    _owned_kb_or_404(kb_id, user, db)
    return (db.query(Conversation)
            .filter_by(kb_id=kb_id)
            .order_by(Conversation.created_at.desc())
            .all())


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(conv_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    conv = _owned_conversation_or_404(conv_id, user, db)
    msgs = (db.query(Message)
            .filter_by(conversation_id=conv.id)
            .order_by(Message.created_at.asc(), Message.id.asc())
            .all())
    return ConversationDetail(
        id=conv.id, title=conv.title, created_at=conv.created_at,
        messages=[MessageOut(id=m.id, role=m.role, content=m.content,
                             citations=json.loads(m.citations or "[]"),
                             verification=json.loads(m.verification) if m.verification else None,
                             created_at=m.created_at) for m in msgs],
    )


@router.patch("/conversations/{conv_id}", response_model=ConversationOut)
def rename_conversation(conv_id: int, payload: ConversationUpdate,
                        db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    conv = _owned_conversation_or_404(conv_id, user, db)
    title = payload.title.strip()
    if not title:
        raise HTTPException(400, "title cannot be empty")
    conv.title = title[:60]
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    conv = _owned_conversation_or_404(conv_id, user, db)
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}
