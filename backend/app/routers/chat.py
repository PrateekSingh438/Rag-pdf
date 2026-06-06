"""Streaming chat. Retrieve -> build prompt -> stream tokens -> persist -> send
final metadata (citations + exam links). DB writes happen in a fresh session
inside the generator because the request-scoped session closes when streaming
starts.

Also exposes conversation history endpoints (list / detail / delete), each scoped
to the authenticated user's knowledge bases."""
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..ratelimit import limiter
from ..auth import get_current_user
from ..models import User, KnowledgeBase, Conversation, Message
from ..schemas import ConversationOut, ConversationDetail, MessageOut
from ..rag.retriever import retrieve
from ..rag.generator import build_messages, citations_from_hits
from ..rag.llm import chat_stream
from ..rag.exam_linker import find_related_exam_questions

router = APIRouter(prefix="/chat", tags=["chat"])


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


@router.post("/{kb_id}")
@limiter.limit("30/minute")
def chat(request: Request, kb_id: int, payload: dict, db: Session = Depends(get_db),
         user: User = Depends(get_current_user)):
    _owned_kb_or_404(kb_id, user, db)
    question = payload.get("question")
    if not question:
        raise HTTPException(400, "question is required")
    conversation_id = payload.get("conversation_id")
    model = payload.get("model")  # optional LLM override; validated in chat_stream

    # Load prior turns for multi-turn context. For a short follow-up (likely a
    # reference like "explain that again"), fold the previous question into the
    # retrieval query so we re-retrieve on the right topic.
    history, retrieval_query = [], question
    if conversation_id:
        conv = db.query(Conversation).filter_by(id=conversation_id, kb_id=kb_id).first()
        if conv:
            prior = (db.query(Message)
                     .filter_by(conversation_id=conv.id)
                     .order_by(Message.created_at.asc(), Message.id.asc())
                     .all())
            history = [{"role": m.role, "content": m.content} for m in prior[-6:]]
            last_user = next((m.content for m in reversed(prior) if m.role == "user"), None)
            if last_user and len(question.split()) <= 6:
                retrieval_query = f"{last_user} {question}"

    hits = retrieve(kb_id, retrieval_query, top_n=10, top_k=5, use_reranker=True)
    citations = citations_from_hits(hits)
    exam_links = find_related_exam_questions(kb_id, question)
    messages = build_messages(question, hits, history=history)

    def stream():
        full = ""
        try:
            for tok in chat_stream(messages, model=model):
                full += tok
                yield f"data: {json.dumps({'type': 'token', 'content': tok})}\n\n"
        except Exception as e:
            # Don't let an LLM error (e.g. Groq 429 rate limit) kill the stream —
            # emit a readable message and still finish cleanly.
            rate = "rate_limit" in str(e).lower() or "429" in str(e)
            msg = ("The AI service has hit its free-tier rate limit. Please try again "
                   "in a few minutes." if rate
                   else "Sorry — the AI service is temporarily unavailable. Please try again.")
            note = ("\n\n_" + msg + "_") if full.strip() else ("⚠️ " + msg)
            full += note
            yield f"data: {json.dumps({'type': 'token', 'content': note})}\n\n"
        # persist with a fresh session (request session is closed by now)
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
            s.add(Message(conversation_id=conv.id, role="user", content=question))
            s.add(Message(conversation_id=conv.id, role="assistant",
                          content=full, citations=json.dumps(citations)))
            s.commit()
            cid = conv.id
        finally:
            s.close()
        yield ("data: " + json.dumps({"type": "done", "conversation_id": cid,
               "citations": citations, "exam_links": exam_links}) + "\n\n")

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
                             created_at=m.created_at) for m in msgs],
    )


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    conv = _owned_conversation_or_404(conv_id, user, db)
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}
