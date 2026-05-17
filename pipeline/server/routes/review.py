"""
server/routes/review.py — TA decision endpoint.

POST /review/{exam_id}/decide

This is the endpoint the GradeOps frontend calls when a TA:
  - Approves an AI grade (key A)
  - Overrides a score (key O)
  - Escalates to instructor (key F / escalate)

It resumes the LangGraph graph by calling graph.invoke(Command(resume=...)).
"""

from __future__ import annotations
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from pydantic import BaseModel, Field

from graph import graph

router = APIRouter(prefix="/review", tags=["review"])


class ApproveDecision(BaseModel):
    action: Literal["approve"]


class OverrideDecision(BaseModel):
    action: Literal["override"]
    score:   float = Field(..., ge=0, description="New score to assign")
    comment: str   = Field(default="", description="TA's reason for the override")


class EscalateDecision(BaseModel):
    action: Literal["escalate"]


# Union type for the request body
class DecisionRequest(BaseModel):
    action: str
    score:  float | None = None
    comment: str = ""


def _config(exam_id: str) -> dict:
    return {"configurable": {"thread_id": exam_id}}


def _build_resume_value(req: DecisionRequest) -> Any:
    """
    Convert the HTTP request body to the value passed into Command(resume=...).
    This is exactly what the review_node receives as the return of interrupt().
    """
    if req.action == "approve":
        return "approve"
    elif req.action == "override":
        return {"action": "override", "score": req.score, "comment": req.comment}
    elif req.action == "escalate":
        return "escalate"
    else:
        raise ValueError(f"Unknown action: {req.action!r}")


@router.post("/{exam_id}/decide")
async def submit_decision(exam_id: str, body: DecisionRequest):
    """
    Submit a TA decision for the currently pending review in an exam.

    The graph resumes from the interrupt() call in review_node and
    either loops back for the next student or proceeds to finalize.

    Returns the updated state (including next_review if another student is waiting).
    """
    # Check that the exam exists and has a pending interrupt
    snapshot = graph.get_state(_config(exam_id))
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Exam {exam_id!r} not found")

    has_interrupt = any(task.interrupts for task in snapshot.tasks)
    if not has_interrupt:
        raise HTTPException(
            status_code=409,
            detail="No pending review for this exam. It may already be finalized.",
        )

    try:
        resume_value = _build_resume_value(body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # ── Run pipeline resume in thread pool (non-blocking) ─────────────────────
    import asyncio
    from server.routes.pipeline import _executor, _resume_graph_sync, _pipeline_status

    # Set status to processing immediately so the frontend knows to wait
    _pipeline_status[exam_id] = "processing"

    cmd = Command(resume=resume_value)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _resume_graph_sync, cmd, exam_id)

    return {
        "exam_id":     exam_id,
        "status":      "processing",
    }
