"""
server/routes/pipeline.py — Pipeline management endpoints.

<<<<<<< HEAD
POST /pipeline/start   → upload PDF + rubric, save to disk, start grading
                         in background; returns exam_id immediately.
GET  /pipeline/{id}    → poll current state (students, stats, next interrupt)
=======
POST /pipeline/start              → upload PDF + rubric, start grading in background
GET  /pipeline/{id}               → poll current state (students, stats, next interrupt)
GET  /pipeline/{id}/export/csv    → download gradebook as CSV
GET  /pipeline/{id}/export/json   → download raw gradebook JSON
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
"""

from __future__ import annotations
import asyncio
<<<<<<< HEAD
=======
import csv
import io
import json
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
<<<<<<< HEAD

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from config import settings
from graph import graph
=======
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, Response

from pipeline.config import settings
from pipeline.graph import graph
from pipeline.server.routes.metadata import register_exam, ExamMetadata, _load_json, COURSES_FILE
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

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
<<<<<<< HEAD
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
=======
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
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    """
    if mock:
        os.environ["MOCK_LLM"] = "true"
        settings.mock_llm = True
    else:
        os.environ.pop("MOCK_LLM", None)
        settings.mock_llm = False

    eid = exam_id or f"exam_{uuid.uuid4().hex[:8]}"

<<<<<<< HEAD
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
=======
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
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
        "students":           [],
        "current_review_idx": 0,
        "stats":              {},
        "error":              None,
        "rubric":             {},
    }

<<<<<<< HEAD
    # ── Run pipeline in thread pool (non-blocking) ────────────────────────────
    _pipeline_status[eid] = "processing"
=======
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
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
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


<<<<<<< HEAD
@router.get("/")
async def list_exams():
    """
    List all exams stored in MongoDB.

    Queries the checkpointing_db for distinct thread_ids (each = one exam),
    fetches the latest state for each, and returns a summary array that
    the frontend dashboard can render immediately.
    """
    try:
        from database.connection import get_mongo_client

        client = get_mongo_client()
        if client is None:
            return []

        db = client["checkpointing_db"]
        checkpoints = db["checkpoints"]
        thread_ids = checkpoints.distinct("thread_id")
        exams = []

        for tid in thread_ids:
            try:
                snap = graph.get_state({"configurable": {"thread_id": tid}})
                if not snap or not snap.values:
                    continue

                state = snap.values
                students = state.get("students", [])
                reviewed = sum(1 for s in students if s.get("ta_decision"))

                # Determine status
                status = _pipeline_status.get(tid, "unknown")
                if state.get("error"):
                    status = "error"
                elif any(t.interrupts for t in snap.tasks):
                    status = "awaiting_review"
                elif not snap.tasks and status not in ("processing",):
                    status = "graded"

                rubric = state.get("rubric", {})
                stats = state.get("stats", {})

                exams.append({
                    "id":       tid,
                    "name":     rubric.get("exam", f"Exam {tid[-8:]}"),
                    "course":   rubric.get("course", "Unknown"),
                    "uploaded": stats.get("finalized_at", "Recently"),
                    "status":   status,
                    "students": len(students),
                    "reviewed": reviewed,
                    "pending":  len(students) - reviewed,
                    "rubric":   "rubric.json",
                })
            except Exception as inner_exc:
                print(f"[list_exams] Error reading state for {tid}: {inner_exc}")
                continue

        # Show newest first
        return list(reversed(exams))
    except Exception as exc:
        print(f"[list_exams] Error: {exc}")
        return []
=======
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
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
