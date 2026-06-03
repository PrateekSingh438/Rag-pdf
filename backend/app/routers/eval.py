"""Serves the evaluation results produced by app/eval/run_eval.py to the
dashboard. Read-only; requires authentication so results aren't world-readable."""
import os
import json
from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_current_user
from ..models import User

router = APIRouter(prefix="/eval", tags=["eval"])

_RESULTS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval", "results.json")


@router.get("")
def get_eval_results(user: User = Depends(get_current_user)):
    if not os.path.exists(_RESULTS_PATH):
        raise HTTPException(404, "No evaluation results yet. Run: python -m app.eval.run_eval")
    with open(_RESULTS_PATH, encoding="utf-8") as f:
        return json.load(f)
