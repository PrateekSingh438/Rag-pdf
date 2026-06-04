"""Lists the LLM models the in-app picker can choose from. Public (no per-user
state) so the frontend can populate the selector before/independently of a chat."""
from fastapi import APIRouter
from ..rag.llm import AVAILABLE_MODELS, resolve_model

router = APIRouter(prefix="/models", tags=["models"])


@router.get("")
def list_models():
    return {"default": resolve_model(None), "models": AVAILABLE_MODELS}
