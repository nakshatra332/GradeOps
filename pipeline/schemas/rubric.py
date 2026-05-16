"""
schemas/rubric.py — Pydantic schema for the grading rubric JSON.

The ingestion agent validates every uploaded rubric against this schema
before the pipeline starts. A rubric that fails validation is rejected
immediately with a clear error message.

Example rubric JSON:
    {
      "exam": "Midterm — CS 301",
      "course": "CS 301",
      "pages_per_student": 4,
      "questions": [
        {
          "id": "q1",
          "text": "Explain QuickSort time complexity",
          "max_marks": 10,
          "criteria": [
            {"text": "Correct average case O(n log n)", "marks": 3},
            {"text": "Worst case O(n²) mentioned",      "marks": 3},
            {"text": "Partition step explained",        "marks": 2},
            {"text": "Recurrence T(n)=2T(n/2)+O(n)",   "marks": 2}
          ],
          "acceptable_patterns": ["O(n log n)", "nlogn", "n log n"]
        }
      ]
    }
"""

from pydantic import BaseModel, Field, model_validator


class CriterionSchema(BaseModel):
    text: str  = Field(..., description="Human-readable criterion description")
    marks: float = Field(..., gt=0, description="Points awarded for meeting this criterion")


class QuestionSchema(BaseModel):
    id: str         = Field(..., description="Unique question identifier, e.g. 'q1'")
    text: str       = Field(..., description="Full question text shown to the grading model")
    max_marks: float = Field(..., gt=0, description="Maximum marks for this question")
    criteria: list[CriterionSchema] = Field(
        ..., min_length=1, description="Rubric criteria — each is worth partial credit"
    )
    acceptable_patterns: list[str] = Field(
        default_factory=list,
        description="Optional keyword patterns that strongly indicate a correct answer",
    )

    @model_validator(mode="after")
    def criteria_sum_matches_max(self) -> "QuestionSchema":
        total = sum(c.marks for c in self.criteria)
        if abs(total - self.max_marks) > 0.01:
            raise ValueError(
                f"Question '{self.id}': criteria marks sum ({total}) "
                f"≠ max_marks ({self.max_marks})"
            )
        return self


class RubricSchema(BaseModel):
    exam: str             = Field(..., description="Exam name")
    course: str           = Field(..., description="Course code, e.g. 'CS 301'")
    pages_per_student: int | None = Field(default=None, description="How many PDF pages belong to one student")
    questions: list[QuestionSchema] = Field(..., min_length=1)

    @property
    def total_marks(self) -> float:
        return sum(q.max_marks for q in self.questions)
