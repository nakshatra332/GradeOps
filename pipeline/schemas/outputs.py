"""
schemas/outputs.py — Pydantic output schemas for LLM structured responses.

These are the shapes that the grading model MUST return.
LangChain's .with_structured_output() uses these to enforce the schema.
"""

from pydantic import BaseModel, Field


# ── Agent 2: OCR output ───────────────────────────────────────────────────────

class OCROutput(BaseModel):
    """Structured response from the OCR/Vision model."""
    transcript: str = Field(
        ...,
        description="Verbatim transcription of the handwritten answer",
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0,
        description="Model's confidence in the accuracy of the transcription (0–1)",
    )
    illegible_regions: list[str] = Field(
        default_factory=list,
        description="Descriptions of any regions that could not be read",
    )


# ── Agent 3: Per-question grade ───────────────────────────────────────────────

class QuestionGrade(BaseModel):
    """AI-proposed grade for a single rubric question."""
    question_id: str = Field(..., description="Question ID from the rubric")
    score: float = Field(..., ge=0, description="Points awarded for this question")
    max_score: float = Field(..., gt=0, description="Maximum points for this question")
    criteria_met: list[str] = Field(
        ...,
        description="List of criterion texts that the student satisfied",
    )
    justification: str = Field(
        ...,
        description=(
            "2–3 sentences referencing specific rubric criteria. "
            "Explain what the student got right and what was missing."
        ),
    )


class GradeOutput(BaseModel):
    """Full AI-proposed grade for one student's exam."""
    question_grades: list[QuestionGrade]
    overall_justification: str = Field(
        ...,
        description="1–2 sentence summary of the student's overall performance",
    )

    @property
    def total_score(self) -> float:
        return sum(q.score for q in self.question_grades)

    @property
    def total_max(self) -> float:
        return sum(q.max_score for q in self.question_grades)


# ── Final gradebook entry ─────────────────────────────────────────────────────

class TADecision(BaseModel):
    action: str              # "approve" | "override" | "escalate"
    final_score: float | None = None
    comment: str = ""


class FinalGrade(BaseModel):
    """Complete record for one student after TA review."""
    student_id: str
    exam_id: str
    ai_grade: GradeOutput
    ta_decision: TADecision
    final_score: float
    ocr_confidence: float
    needs_priority_review: bool = False
    plagiarism_score: float | None = None
    plagiarism_match: str | None = None   # student_id of suspected match
