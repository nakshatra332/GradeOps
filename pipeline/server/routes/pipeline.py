"""
server/routes/pipeline.py — Pipeline management endpoints.

POST /pipeline/start              → upload PDF + rubric, start grading in background
GET  /pipeline/{id}               → poll current state (students, stats, next interrupt)
GET  /pipeline/{id}/export/csv    → download gradebook as CSV
GET  /pipeline/{id}/export/json   → download raw gradebook JSON
"""

from __future__ import annotations
import asyncio
import csv
import io
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, Response

from pipeline.config import settings
from pipeline.graph import graph
from pipeline.server.routes.metadata import register_exam, ExamMetadata, _load_json, COURSES_FILE

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
    pdf:        UploadFile = File(...,           description="Scanned exam PDF"),
    rubric:     UploadFile | None = File(None,   description="Grading rubric JSON"),
    rubric_id:  str | None = Form(default=None,  description="ID of a saved rubric"),
    course_id:  str | None = Form(default=None,  description="Course ID to associate"),
    exam_id:    str | None = Form(default=None,  description="Optional exam ID"),
    mock:       bool       = Form(default=False, description="Use mock LLM responses"),
):
    """
    Upload a PDF and kick off the grading pipeline.

    If rubric_id is provided, it uses a saved rubric from /metadata/rubrics.
    Otherwise, a new rubric file must be uploaded.
    """
    if mock:
        os.environ["MOCK_LLM"] = "true"
        settings.mock_llm = True
    else:
        os.environ.pop("MOCK_LLM", None)
        settings.mock_llm = False

    eid = exam_id or f"exam_{uuid.uuid4().hex[:8]}"

    # ── Load Rubric ───────────────────────────────────────────────────────────
    if rubric_id:
        rubric_path = Path(settings.local_storage_path) / "metadata" / "rubrics" / f"{rubric_id}.json"
        if not rubric_path.exists():
            raise HTTPException(status_code=404, detail=f"Rubric {rubric_id} not found")
        rubric_raw = rubric_path.read_text()
    elif rubric:
        rubric_raw = (await rubric.read()).decode(errors='replace')
    else:
        raise HTTPException(status_code=400, detail="Either rubric file or rubric_id is required")

    # ── Save uploaded PDF ─────────────────────────────────────────────────────
    upload_dir = Path(settings.local_storage_path) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = upload_dir / f"{eid}.pdf"
    pdf_path.write_bytes(await pdf.read())

    initial_state = {
        "_pdf_path":          str(pdf_path),
        "_rubric_raw":        rubric_raw,
        "exam_id":            eid,
        "course_id":          course_id,
        "students":           [],
        "current_review_idx": 0,
        "stats":              {},
        "error":              None,
        "rubric":             {},
    }

    # ── Register exam metadata ──────────────────────────────────────────────
    course_name = "Unknown Course"
    if course_id:
        courses = _load_json(COURSES_FILE)
        course = next((c for c in courses if c["id"] == course_id), None)
        if course:
            course_name = course["code"]

    try:
        rubric_obj = json.loads(rubric_raw) if isinstance(rubric_raw, str) else rubric_raw
        rubric_name = rubric_obj.get("exam", "Unknown Rubric")
    except:
        rubric_name = "Invalid Rubric"

    await register_exam(ExamMetadata(
        id=eid,
        name=f"Exam {eid[-8:]}", # default name
        course=course_name,
        courseId=course_id,
        rubric=rubric_name,
        uploaded=datetime.now().strftime("%b %d, %Y"),
        status="processing"
    ))

    # ── Run pipeline in thread pool (non-blocking) ────────────────────────────
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


@router.get("/{exam_id}/export/csv")
async def export_gradebook_csv(exam_id: str):
    """
    Download the final gradebook for an exam as a CSV file.

    The CSV contains one row per student with columns:
    student_id, final_score, max_score, ai_score, ta_decision, ta_comment,
    ocr_confidence, plagiarism_flag, plagiarism_match

    The gradebook.json must exist (i.e. all reviews must be complete).
    """
    gradebook_path = Path(settings.local_storage_path) / exam_id / "gradebook.json"
    if not gradebook_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Gradebook for exam '{exam_id}' not found. "
                "Ensure all TA reviews are complete before exporting."
            ),
        )

    data = json.loads(gradebook_path.read_text())
    gradebook_entries = data.get("gradebook", [])
    stats = data.get("stats", {})
    rubric = data.get("rubric", {})
    total_marks = stats.get("total_marks", rubric.get("total_marks", 100))

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "student_id",
        "final_score",
        "max_score",
        "ai_score",
        "percentage",
        "pass_fail",
        "ta_decision",
        "ta_comment",
        "ocr_confidence",
        "priority_review",
        "plagiarism_flag",
        "plagiarism_match",
    ])

    pass_threshold = total_marks * 0.5

    for entry in gradebook_entries:
        ai_grade = entry.get("ai_grade") or {}
        ta_decision = entry.get("ta_decision") or {}
        final_score = entry.get("final_score", 0.0)
        ai_score = ai_grade.get("total_score", 0.0) if ai_grade else 0.0
        pct = round((final_score / total_marks) * 100, 1) if total_marks else 0

        writer.writerow([
            entry.get("student_id", ""),
            final_score,
            total_marks,
            ai_score,
            f"{pct}%",
            "Pass" if final_score >= pass_threshold else "Fail",
            ta_decision.get("action", "approve"),
            ta_decision.get("comment", ""),
            round(entry.get("ocr_confidence", 1.0) * 100, 1),
            "Yes" if entry.get("needs_priority_review") else "No",
            "Yes" if entry.get("plagiarism_score") is not None else "No",
            entry.get("plagiarism_match", ""),
        ])

    csv_content = output.getvalue()
    filename = f"gradebook_{exam_id}.csv"

    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8-sig")),  # utf-8-sig adds BOM for Excel
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{exam_id}/export/json")
async def export_gradebook_json(exam_id: str):
    """
    Download the raw gradebook JSON produced by the finalize agent.
    Useful for integration with other systems.
    """
    gradebook_path = Path(settings.local_storage_path) / exam_id / "gradebook.json"
    if not gradebook_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Gradebook for exam '{exam_id}' not found.",
        )

    content = gradebook_path.read_bytes()
    filename = f"gradebook_{exam_id}.json"

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
