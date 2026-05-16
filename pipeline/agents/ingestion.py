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

from pipeline.config import settings
from pipeline.schemas.rubric import RubricSchema
from pipeline.state import ExamGradingState, StudentRecord, make_student_record
from pipeline.tools.pdf_splitter import split_pdf_to_images
from pipeline.tools.storage import get_storage


def ingestion_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.
    
    Expects state to contain:
        _pdf_path  (str): path to the uploaded PDF (set by the caller before graph.invoke())
        _rubric_raw (str | dict): raw rubric JSON string or dict

    Returns a partial state dict that LangGraph merges into ExamGradingState.
    """
    pdf_path   = state.get("_pdf_path", "")
    rubric_raw = state.get("_rubric_raw", {})

    # ── 1. Validate rubric ────────────────────────────────────────────────────
    try:
        if isinstance(rubric_raw, str):
            rubric_raw = json.loads(rubric_raw)
        rubric = RubricSchema.model_validate(rubric_raw)
    except (json.JSONDecodeError, ValidationError) as exc:
        return {"error": f"Rubric validation failed: {exc}"}

    # ── 2. Split PDF into per-student page groups ─────────────────────────────
    try:
        student_page_groups: list[list[bytes]] = split_pdf_to_images(
            pdf_path=pdf_path,
            pages_per_student=rubric.pages_per_student,
        )
    except (FileNotFoundError, ValueError) as exc:
        return {"error": f"PDF splitting failed: {exc}"}

    # ── 3. Assign IDs and upload pages ────────────────────────────────────────
    exam_id = state.get("exam_id") or f"exam_{uuid.uuid4().hex[:8]}"
    storage = get_storage()
    students: list[StudentRecord] = []

    for i, pages in enumerate(student_page_groups):
        student_id = f"S{i + 1:03d}"
        page_paths: list[str] = []

        for page_idx, png_bytes in enumerate(pages):
            key  = f"{exam_id}/{student_id}/page_{page_idx + 1}.png"
            path = storage.write(key, png_bytes)
            page_paths.append(path)

        students.append(make_student_record(student_id=student_id, page_paths=page_paths))

    return {
        "exam_id":            exam_id,
        "rubric":             rubric.model_dump(),
        "students":           students,
        "current_review_idx": 0,
        "stats":              {},
        "error":              None,
    }
