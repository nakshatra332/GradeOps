"""
agents/ingestion.py — Agent 1: Ingestion.

Responsibilities:
  1. Validate and parse the rubric JSON against RubricSchema.
  2. Split the PDF into per-student page groups using PyMuPDF.
  3. Assign exam_id and student_id to each student.
  4. Upload page images to the configured storage backend.
  5. Return the initial ExamGradingState.
"""

from __future__ import annotations
import json
import uuid
from pathlib import Path

from pydantic import ValidationError

<<<<<<< HEAD
from config import settings
from schemas.rubric import RubricSchema
from state import ExamGradingState, StudentRecord, make_student_record
from tools.pdf_splitter import convert_pdf_to_images
from tools.storage import get_storage
=======
from pipeline.config import settings
from pipeline.schemas.rubric import RubricSchema
from pipeline.state import ExamGradingState, StudentRecord, make_student_record
from pipeline.tools.pdf_splitter import split_pdf_to_images
from pipeline.tools.storage import get_storage
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


def ingestion_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.
    
    Expects state to contain:
<<<<<<< HEAD
        _pdf_paths  (list[str]): paths to the uploaded PDFs
=======
        _pdf_path  (str): path to the uploaded PDF (set by the caller before graph.invoke())
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
        _rubric_raw (str | dict): raw rubric JSON string or dict

    Returns a partial state dict that LangGraph merges into ExamGradingState.
    """
<<<<<<< HEAD
    if state.get("error"):
        return {}

    pdf_paths  = state.get("_pdf_paths", [])
=======
    pdf_path   = state.get("_pdf_path", "")
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    rubric_raw = state.get("_rubric_raw", {})

    # ── 1. Validate rubric ────────────────────────────────────────────────────
    try:
        if isinstance(rubric_raw, str):
            rubric_raw = json.loads(rubric_raw)
        rubric = RubricSchema.model_validate(rubric_raw)
    except (json.JSONDecodeError, ValidationError) as exc:
        return {"error": f"Rubric validation failed: {exc}"}

<<<<<<< HEAD
    # ── 2. Process each student PDF ───────────────────────────────────────────
=======
    # ── 2. Split PDF into per-student page groups ─────────────────────────────
    try:
        student_page_groups: list[list[bytes]] = split_pdf_to_images(
            pdf_path=pdf_path,
            pages_per_student=rubric.pages_per_student,
        )
    except (FileNotFoundError, ValueError) as exc:
        return {"error": f"PDF splitting failed: {exc}"}

    # ── 3. Assign IDs and upload pages ────────────────────────────────────────
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    exam_id = state.get("exam_id") or f"exam_{uuid.uuid4().hex[:8]}"
    storage = get_storage()
    students: list[StudentRecord] = []

<<<<<<< HEAD
    for i, path in enumerate(pdf_paths):
        student_id = f"S{i + 1:03d}"
        page_paths: list[str] = []

        try:
            pages = convert_pdf_to_images(pdf_path=path)
        except Exception as exc:
            return {"error": f"Failed to process PDF {path}: {exc}"}

        for page_idx, png_bytes in enumerate(pages):
            key  = f"{exam_id}/{student_id}/page_{page_idx + 1}.png"
            storage_path = storage.write(key, png_bytes)
            page_paths.append(storage_path)
=======
    for i, pages in enumerate(student_page_groups):
        student_id = f"S{i + 1:03d}"
        page_paths: list[str] = []

        for page_idx, png_bytes in enumerate(pages):
            key  = f"{exam_id}/{student_id}/page_{page_idx + 1}.png"
            path = storage.write(key, png_bytes)
            page_paths.append(path)
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

        students.append(make_student_record(student_id=student_id, page_paths=page_paths))

    return {
        "exam_id":            exam_id,
        "rubric":             rubric.model_dump(),
        "students":           students,
        "current_review_idx": 0,
        "stats":              {},
        "error":              None,
    }
