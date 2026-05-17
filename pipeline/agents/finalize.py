"""
agents/finalize.py — Agent 4: Aggregation and gradebook output.

After all students have been reviewed, this node:
  1. Computes class-level statistics.
  2. Writes the gradebook JSON to storage.
  3. Pushes stats to the WebSocket channel (if the server is running).
"""

from __future__ import annotations
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

<<<<<<< HEAD
from config import settings
from schemas.outputs import GradeOutput, FinalGrade, TADecision
from schemas.rubric import RubricSchema
from state import ExamGradingState, StudentRecord
from tools.storage import get_storage
=======
from pipeline.config import settings
from pipeline.schemas.outputs import GradeOutput, FinalGrade, TADecision
from pipeline.schemas.rubric import RubricSchema
from pipeline.state import ExamGradingState, StudentRecord
from pipeline.tools.storage import get_storage
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


def _compute_stats(students: list[StudentRecord], rubric: RubricSchema) -> dict:
    final_scores = [
        s["final_score"] for s in students if s["final_score"] is not None
    ]
    total_marks = rubric.total_marks
    pass_threshold = total_marks * 0.5  # 50% pass mark

    if not final_scores:
        return {}

    ai_scores = []
    for s in students:
        if s.get("grade_output"):
            grade = GradeOutput.model_validate(s["grade_output"])
            ai_scores.append(grade.total_score)

    agreement_count = sum(
        1 for s, ai in zip(students, ai_scores)
        if s.get("ta_decision") == "approve"
    )

    return {
        "total_students": len(students),
        "total_marks":    total_marks,
        "class_average":  round(statistics.mean(final_scores), 2),
        "std_deviation":  round(statistics.stdev(final_scores), 2) if len(final_scores) > 1 else 0.0,
        "highest":        max(final_scores),
        "lowest":         min(final_scores),
        "pass_rate":      round(sum(s >= pass_threshold for s in final_scores) / len(final_scores) * 100, 1),
        "ai_ta_agreement_rate": round(agreement_count / len(students) * 100, 1) if students else 0.0,
        "flagged_plagiarism":   sum(1 for s in students if s.get("plagiarism_score") is not None),
        "priority_reviews":     sum(1 for s in students if s.get("needs_priority_review")),
    }


def finalize_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.
    Writes gradebook JSON and computes final stats.
    """
    exam_id  = state["exam_id"]
    students = state["students"]
    rubric   = RubricSchema.model_validate(state["rubric"])

    # ── Build gradebook entries ───────────────────────────────────────────────
    gradebook: list[dict] = []
    for s in students:
        grade_output = GradeOutput.model_validate(s["grade_output"]) if s.get("grade_output") else None

        ta = TADecision(
            action=s.get("ta_decision") or "approve",
            final_score=s.get("final_score"),
            comment=s.get("ta_comment") or "",
        )

        final = FinalGrade(
            student_id=s["student_id"],
            exam_id=exam_id,
            ai_grade=grade_output,
            ta_decision=ta,
            final_score=s.get("final_score") or 0.0,
            ocr_confidence=s.get("ocr_confidence") or 1.0,
            needs_priority_review=s.get("needs_priority_review", False),
            plagiarism_score=s.get("plagiarism_score"),
            plagiarism_match=s.get("plagiarism_match"),
        )
        gradebook.append(final.model_dump())

    # ── Compute stats ─────────────────────────────────────────────────────────
    stats = _compute_stats(students, rubric)
    stats["exam_id"]      = exam_id
    stats["finalized_at"] = datetime.now(timezone.utc).isoformat()

    # ── Persist to storage ────────────────────────────────────────────────────
    storage = get_storage()

    gradebook_payload = json.dumps(
        {"exam_id": exam_id, "rubric": state["rubric"], "gradebook": gradebook, "stats": stats},
        indent=2,
        default=str,
    ).encode()

    gradebook_path = storage.write(f"{exam_id}/gradebook.json", gradebook_payload)
    print(f"[finalize] Gradebook written to: {gradebook_path}")
    print(f"[finalize] Stats: {json.dumps(stats, indent=2)}")

    # ── Notify WebSocket (best-effort — server may not be running) ────────────
    try:
        from server.ws import broadcast_stats
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(broadcast_stats(exam_id, stats))
        loop.close()
    except Exception:
        pass  # Server not running in CLI mode — that's fine

    return {"stats": stats}
