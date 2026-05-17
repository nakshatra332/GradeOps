"""
agents/review.py — HITL interrupt node.

This is NOT an LLM call. It pauses the LangGraph execution and hands
control back to the FastAPI server (or CLI), which waits for a TA decision.

The interrupt() call serialises the current state via the checkpointer.
When a TA submits a decision (approve / override / escalate), the server
calls graph.invoke(Command(resume=decision), config=...) and the graph
resumes from the line after interrupt().

Decision payload (what the TA sends back):
    "approve"
        → accept the AI score as-is

    {"action": "override", "score": 8.5, "comment": "Student also mentioned ..."}
        → replace AI score with the TA's score

    "escalate"
        → re-interrupt for the same student (instructor must review)
"""

from __future__ import annotations
from langgraph.types import interrupt

<<<<<<< HEAD
from schemas.outputs import GradeOutput
from state import ExamGradingState, StudentRecord
=======
from pipeline.schemas.outputs import GradeOutput
from pipeline.state import ExamGradingState, StudentRecord
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


def _payload_for_student(student: StudentRecord, exam_id: str) -> dict:
    """Build the data presented to the TA when the graph pauses."""
    grade_dict = student.get("grade_output") or {}

    return {
        "exam_id":             exam_id,
        "student_id":          student["student_id"],
        "transcript":          student.get("transcript", ""),
        "ocr_confidence":      student.get("ocr_confidence", 1.0),
        "needs_priority_review": student.get("needs_priority_review", False),
        "grade":               grade_dict,
        "plagiarism_score":    student.get("plagiarism_score"),
        "plagiarism_match":    student.get("plagiarism_match"),
    }


def review_node(state: ExamGradingState) -> dict:
    """
    LangGraph node function.

    Interrupts once per student. The TA reviews the AI-proposed grade and
    sends back one of: "approve", {"action": "override", ...}, or "escalate".

    Escalation re-interrupts for the same student (instructor must resolve).
    """
    students = list(state.get("students") or [])
    idx      = state.get("current_review_idx", 0)
    exam_id  = state.get("exam_id", "")

    if not students or idx >= len(students):
        # Nothing to review — advance index to trigger the 'done' edge
        return {"current_review_idx": len(students)}

    student = dict(students[idx])

    while True:
        # ── Pause here — hand control to the TA ──────────────────────────────
        decision = interrupt(_payload_for_student(student, exam_id))
        # ─────────────────────────────────────────────────────────────────────
        # Execution resumes here when Command(resume=decision) is called.

        if decision == "approve":
            grade = GradeOutput.model_validate(student["grade_output"])
            student["ta_decision"]     = "approve"
            student["final_score"]     = grade.total_score
            student["ta_override_score"] = None
            student["ta_comment"]      = ""
            break

        elif isinstance(decision, dict) and decision.get("action") == "override":
            student["ta_decision"]       = "override"
            student["ta_override_score"] = float(decision.get("score", 0))
            student["ta_comment"]        = decision.get("comment", "")
            student["final_score"]       = student["ta_override_score"]
            break

        elif decision == "escalate":
            # Stay in the loop — re-interrupt for the same student.
            # The next interrupt payload signals it's an escalation.
            student["ta_decision"] = "escalate"
            # Loop back → interrupt fires again for the same student

        else:
            # Unknown decision — treat as approve to avoid infinite loop
            grade = GradeOutput.model_validate(student["grade_output"])
            student["ta_decision"] = "approve"
            student["final_score"] = grade.total_score
            break

    students[idx] = student

    return {
        "students":           students,
        "current_review_idx": idx + 1,
    }


def route_after_review(state: ExamGradingState) -> str:
    """
    Conditional edge after the review node.
    Returns "continue" to loop back for the next student, or "done" when all are reviewed.
    """
    idx   = state["current_review_idx"]
    total = len(state["students"])
    return "done" if idx >= total else "continue"
