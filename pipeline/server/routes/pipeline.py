"""
server/routes/pipeline.py — Pipeline management endpoints.

POST /pipeline/start   → upload PDF + rubric, save to disk, start grading
                         in background; returns exam_id immediately.
GET  /pipeline/{id}    → poll current state (students, stats, next interrupt)
"""

from __future__ import annotations
import asyncio
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from config import settings
from graph import graph

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# Thread pool for running the synchronous LangGraph graph without blocking FastAPI
_executor = ThreadPoolExecutor(max_workers=4)

# In-memory map of exam_id → pipeline status so the frontend can poll
_pipeline_status: dict[str, str] = {}   # "processing" | "awaiting_review" | "complete" | "error"


def _config(exam_id: str) -> dict:
    return {"configurable": {"thread_id": exam_id}}


def _run_graph_sync(initial_state: dict, exam_id: str):
    """
    Run graph.invoke() synchronously in a thread-pool worker.
    This keeps the FastAPI event loop free while the pipeline runs.
    The graph pauses at the first interrupt() call and returns — the
    frontend then polls GET /pipeline/{exam_id} to find the pending review.
    """
    try:
        _pipeline_status[exam_id] = "processing"
        result = graph.invoke(initial_state, config=_config(exam_id))
        if result.get("error"):
            _pipeline_status[exam_id] = "error"
        else:
            # Check if there is an interrupt pending
            snapshot = graph.get_state(_config(exam_id))
            has_interrupt = any(t.interrupts for t in snapshot.tasks)
            _pipeline_status[exam_id] = "awaiting_review" if has_interrupt else "complete"
    except Exception as exc:
        _pipeline_status[exam_id] = "error"
        print(f"[pipeline] Unhandled error for {exam_id}: {exc}")


def _resume_graph_sync(resume_cmd, exam_id: str):
    """
    Run graph.invoke() synchronously with a resume Command in a thread-pool worker.
    """
    try:
        _pipeline_status[exam_id] = "processing"
        result = graph.invoke(resume_cmd, config=_config(exam_id))
        if result.get("error"):
            _pipeline_status[exam_id] = "error"
        else:
            snapshot = graph.get_state(_config(exam_id))
            has_interrupt = any(t.interrupts for t in snapshot.tasks)
            _pipeline_status[exam_id] = "awaiting_review" if has_interrupt else "complete"
    except Exception as exc:
        _pipeline_status[exam_id] = "error"
        print(f"[pipeline] Unhandled error resuming {exam_id}: {exc}")


@router.post("/start")
async def start_pipeline(
    pdfs:    list[UploadFile] = File(..., description="List of individual student exam PDFs"),
    rubric:  UploadFile = File(...,       description="Grading rubric JSON"),
    exam_id: str | None = Form(default=None,  description="Optional exam ID"),
    mock:    bool       = Form(default=False, description="Use mock LLM responses"),
):
    """
    Upload a PDF and rubric JSON, then kick off the grading pipeline.

    The pipeline runs in a background thread. This endpoint returns
    immediately with the exam_id so the frontend can start polling.

    Poll GET /pipeline/{exam_id} for status and the next TA review.
    """
    if mock:
        os.environ["MOCK_LLM"] = "true"
        settings.mock_llm = True
    else:
        os.environ.pop("MOCK_LLM", None)
        settings.mock_llm = False

    eid = exam_id or f"exam_{uuid.uuid4().hex[:8]}"

    # ── Save uploaded files to a permanent scratch directory ──────────────────
    # (DO NOT use tempfile.TemporaryDirectory — it deletes the file before
    #  the pipeline agent reads it off disk)
    upload_dir = Path(settings.local_storage_path) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    pdf_paths = []
    for i, p in enumerate(pdfs):
        path = upload_dir / f"{eid}_student_{i+1:03d}.pdf"
        path.write_bytes(await p.read())
        pdf_paths.append(str(path))

    rubric_raw = None
    rubric_pdf_path = None

    if rubric.filename and rubric.filename.lower().endswith(".pdf"):
        rubric_file_path = upload_dir / f"{eid}_rubric.pdf"
        rubric_file_path.write_bytes(await rubric.read())
        rubric_pdf_path = str(rubric_file_path)
    else:
        rubric_raw = (await rubric.read()).decode()

    initial_state = {
        "_pdf_paths":         pdf_paths,
        "_rubric_raw":        rubric_raw,
        "_rubric_pdf_path":   rubric_pdf_path,
        "exam_id":            eid,
        "students":           [],
        "current_review_idx": 0,
        "stats":              {},
        "error":              None,
        "rubric":             {},
    }

    # ── Run pipeline in thread pool (non-blocking) ────────────────────────────
    _pipeline_status[eid] = "processing"
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_graph_sync, initial_state, eid)

    return {"exam_id": eid, "status": "processing"}


@router.get("/{exam_id}")
async def get_pipeline_state(exam_id: str):
    """
    Return the current pipeline state for an exam.

    The frontend should poll this endpoint every 2–3 seconds while
    status is "processing". When next_review is non-null, the TA
    review UI should be shown. When is_complete is true, show stats.
    """
    snapshot = graph.get_state(_config(exam_id))
    pipeline_status = _pipeline_status.get(exam_id, "unknown")

    # If graph has no state yet (still initialising), return early
    if not snapshot or not snapshot.values:
        return {
            "exam_id":     exam_id,
            "status":      pipeline_status,
            "students":    [],
            "stats":       {},
            "error":       None,
            "next_review": None,
            "is_complete": False,
        }

    state = snapshot.values
    next_review = None

    for task in snapshot.tasks:
        if task.interrupts:
            next_review = task.interrupts[0].value
            break

    is_complete = not bool(snapshot.tasks) and pipeline_status != "processing"

    return {
        "exam_id":     state.get("exam_id"),
        "status":      pipeline_status,
        "students":    state.get("students", []),
        "stats":       state.get("stats", {}),
        "error":       state.get("error"),
        "next_review": next_review,
        "is_complete": is_complete,
    }
