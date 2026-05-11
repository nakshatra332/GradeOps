"""
state.py — LangGraph ExamGradingState.

This is the single shared data structure that every node reads from
and writes to. LangGraph persists this via the checkpointer between
interrupt/resume cycles.

Design rules:
  - Nodes return PARTIAL state dicts — only the keys they modify.
  - LangGraph merges them into the full state automatically.
  - Never mutate the state dict in-place inside a node; always return a new dict.
"""

from __future__ import annotations
from typing import Any
from typing_extensions import TypedDict

from schemas.rubric import RubricSchema
from schemas.outputs import GradeOutput, FinalGrade


class StudentRecord(TypedDict):
    """One student's data, populated progressively by each agent."""
    student_id: str

    # Set by Agent 1 (Ingestion)
    page_paths: list[str]         # paths to per-page images in storage
    needs_priority_review: bool   # True if OCR confidence is low

    # Set by Agent 2 (OCR)
    transcript: str | None
    ocr_confidence: float | None

    # Set by Agent 3 (Grading)
    grade_output: dict | None     # serialised GradeOutput (dicts survive checkpointing)
    plagiarism_score: float | None
    plagiarism_match: str | None  # student_id of the suspected match

    # Set by HITL review node
    ta_decision: str | None       # "approve" | "override" | "escalate"
    ta_override_score: float | None
    ta_comment: str

    # Set by Finalize
    final_score: float | None


class ExamGradingState(TypedDict):
    """Top-level LangGraph state for one exam batch."""
    exam_id: str
    rubric: dict                   # serialised RubricSchema (dicts survive checkpointing)

    students: list[StudentRecord]

    # Pointer used by the review loop — which student is currently being reviewed
    current_review_idx: int

    # Aggregated stats written by the finalize agent
    stats: dict[str, Any]

    # Non-None if any agent encountered an unrecoverable error
    error: str | None


def make_student_record(student_id: str, page_paths: list[str]) -> StudentRecord:
    """Create a blank StudentRecord with all optional fields defaulted."""
    return StudentRecord(
        student_id=student_id,
        page_paths=page_paths,
        needs_priority_review=False,
        transcript=None,
        ocr_confidence=None,
        grade_output=None,
        plagiarism_score=None,
        plagiarism_match=None,
        ta_decision=None,
        ta_override_score=None,
        ta_comment="",
        final_score=None,
    )
