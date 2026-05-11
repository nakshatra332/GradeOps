"""
server/routes/pipeline.py — Pipeline management endpoints.

POST /pipeline/start   → upload PDF + rubric, start the graph, return exam_id
GET  /pipeline/{id}    → poll current state (students, stats, next interrupt)
"""

from __future__ import annotations
import json
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from langgraph.types import Command

from graph import graph

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def _config(exam_id: str) -> dict:
    return {"configurable": {"thread_id": exam_id}}


@router.post("/start")
async def start_pipeline(
    pdf:    UploadFile = File(..., description="Scanned exam PDF"),
    rubric: UploadFile = File(..., description="Grading rubric JSON"),
    exam_id: str | None = Form(default=None, description="Optional exam ID"),
    mock:   bool = Form(default=False, description="Use mock LLM responses"),
):
    """
    Upload a PDF and rubric, then kick off the grading pipeline.

    Returns the exam_id — use it to poll /pipeline/{exam_id} for status
    and POST to /review/{exam_id}/decide for TA decisions.
    """
    if mock:
        os.environ["MOCK_LLM"] = "true"

    # Save uploaded files to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path    = Path(tmpdir) / pdf.filename
        rubric_path = Path(tmpdir) / rubric.filename

        pdf_path.write_bytes(await pdf.read())
        rubric_raw = (await rubric.read()).decode()

        # Build initial state and invoke graph (runs until first interrupt)
        import uuid
        eid = exam_id or f"exam_{uuid.uuid4().hex[:8]}"

        initial_state = {
            "_pdf_path":          str(pdf_path),
            "_rubric_raw":        rubric_raw,
            "exam_id":            eid,
            "students":           [],
            "current_review_idx": 0,
            "stats":              {},
            "error":              None,
            "rubric":             {},
        }

        result = graph.invoke(initial_state, config=_config(eid))

    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])

    return {"exam_id": eid, "student_count": len(result.get("students", []))}


@router.get("/{exam_id}")
async def get_pipeline_state(exam_id: str):
    """
    Return the current pipeline state for an exam.

    Includes:
      - students with their transcripts, AI grades, and TA decisions
      - stats (if finalized)
      - next_review: the student currently awaiting TA action (if any)
    """
    snapshot = graph.get_state(_config(exam_id))
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Exam {exam_id!r} not found")

    state = snapshot.values
    next_review = None

    for task in snapshot.tasks:
        if task.interrupts:
            next_review = task.interrupts[0].value
            break

    return {
        "exam_id":     state.get("exam_id"),
        "students":    state.get("students", []),
        "stats":       state.get("stats", {}),
        "error":       state.get("error"),
        "next_review": next_review,
        "is_complete": not bool(snapshot.tasks),
    }
