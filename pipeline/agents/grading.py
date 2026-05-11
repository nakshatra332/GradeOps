"""
agents/grading.py — Agent 3: Structured grading + plagiarism detection.

Sub-step A: For each student, send their transcript + rubric to Gemini
            and get back a structured GradeOutput via .with_structured_output().

Sub-step B: Embed all transcripts and run cosine-similarity sweep to
            detect suspiciously similar answers.
"""

from __future__ import annotations
import asyncio
from typing import Any

from config import settings
from schemas.rubric import RubricSchema
from schemas.outputs import GradeOutput, QuestionGrade
from state import ExamGradingState, StudentRecord
from tools.similarity import find_suspicious_pairs, build_student_flag_map


# ── Prompt builders ───────────────────────────────────────────────────────────

def _build_grading_prompt(rubric: RubricSchema, transcript: str) -> str:
    criteria_text = ""
    for q in rubric.questions:
        criteria_text += f"\n\nQuestion {q.id}: {q.text} (max {q.max_marks} marks)\n"
        for c in q.criteria:
            criteria_text += f"  • [{c.marks} pts] {c.text}\n"

    return (
        "You are a strict but fair exam grader. "
        "Grade the following student answer according to the rubric below.\n\n"
        f"RUBRIC:{criteria_text}\n\n"
        f"STUDENT ANSWER:\n{transcript}\n\n"
        "Instructions:\n"
        "- Award marks ONLY for criteria explicitly met in the answer.\n"
        "- For each question, list exactly which criteria the student satisfied.\n"
        "- Justification must reference the rubric criteria by name.\n"
        "- Be consistent: the same answer quality should get the same score.\n"
        "- Return structured JSON matching the GradeOutput schema exactly."
    )


# ── Mock responses ────────────────────────────────────────────────────────────

def _mock_grade(rubric: RubricSchema, student_id: str) -> GradeOutput:
    """Deterministic mock grade — incrementally varies score per student."""
    import hashlib
    seed = int(hashlib.md5(student_id.encode()).hexdigest()[:4], 16)

    question_grades = []
    for q in rubric.questions:
        # Award 60–90% of marks based on a hash of student_id + question_id
        ratio = 0.6 + (seed % 30) / 100
        awarded = round(q.max_marks * ratio, 1)
        met = [c.text for c in q.criteria[:max(1, len(q.criteria) - 1)]]
        question_grades.append(QuestionGrade(
            question_id=q.id,
            score=awarded,
            max_score=q.max_marks,
            criteria_met=met,
            justification=(
                f"[MOCK] Student demonstrated understanding of {q.text}. "
                f"Most criteria were met ({len(met)}/{len(q.criteria)})."
            ),
        ))

    return GradeOutput(
        question_grades=question_grades,
        overall_justification=f"[MOCK] {student_id} shows solid understanding overall.",
    )


def _mock_embeddings(transcripts: list[str]) -> list[list[float]]:
    """Return pseudo-random embeddings. Two identical transcripts will be identical vectors."""
    import hashlib, math
    vectors = []
    for t in transcripts:
        h = hashlib.md5(t.encode()).digest()
        vec = [(b - 128) / 128 for b in h] * 24  # 384-dim pseudo-random
        norm = math.sqrt(sum(x * x for x in vec)) or 1
        vectors.append([x / norm for x in vec])
    return vectors


# ── Real Gemini grading ───────────────────────────────────────────────────────

async def _grade_student_async(
    student: StudentRecord,
    rubric: RubricSchema,
    grading_chain,
) -> GradeOutput:
    prompt = _build_grading_prompt(rubric, student["transcript"] or "")
    return await grading_chain.ainvoke(prompt)


async def _run_all_grading(
    students: list[StudentRecord],
    rubric: RubricSchema,
    grading_chain,
) -> list[GradeOutput]:
    tasks = [_grade_student_async(s, rubric, grading_chain) for s in students]
    return await asyncio.gather(*tasks)


# ── Agent node ────────────────────────────────────────────────────────────────

def grading_agent(state: ExamGradingState) -> dict:
    """
    LangGraph node function.

    Sub-step A — Structured grading for every student.
    Sub-step B — Plagiarism detection across all transcripts.
    """
    if state.get("error"):
        return {}

    rubric_dict = state["rubric"]
    rubric      = RubricSchema.model_validate(rubric_dict)
    students: list[StudentRecord] = list(state["students"])

    # ── Sub-step A: Grade each student ───────────────────────────────────────
    if settings.mock_llm:
        grade_results = [_mock_grade(rubric, s["student_id"]) for s in students]
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model=settings.grading_model,
            google_api_key=settings.google_api_key,
            temperature=0,
        )
        grading_chain = llm.with_structured_output(GradeOutput)

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        grade_results = loop.run_until_complete(
            _run_all_grading(students, rubric, grading_chain)
        )

    # Write grade_output into each student record
    for student, grade in zip(students, grade_results):
        student["grade_output"] = grade.model_dump()

    # ── Sub-step B: Plagiarism detection ─────────────────────────────────────
    transcripts = [s["transcript"] or "" for s in students]
    student_ids = [s["student_id"] for s in students]

    if settings.mock_llm:
        embeddings = _mock_embeddings(transcripts)
    else:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        embed_model = GoogleGenerativeAIEmbeddings(
            model=settings.embedding_model,
            google_api_key=settings.google_api_key,
        )
        embeddings = embed_model.embed_documents(transcripts)

    flags     = find_suspicious_pairs(student_ids, embeddings, settings.plagiarism_threshold)
    flag_map  = build_student_flag_map(flags)

    for student in students:
        sid = student["student_id"]
        if sid in flag_map:
            score, match = flag_map[sid]
            student["plagiarism_score"] = score
            student["plagiarism_match"] = match

    return {"students": students}
