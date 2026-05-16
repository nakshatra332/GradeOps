"""
server/routes/metadata.py — Persistent storage for Courses, Rubrics, and Exams.
"""

from __future__ import annotations
import json
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pipeline.config import settings

router = APIRouter(prefix="/metadata", tags=["metadata"])

# Storage paths
METADATA_DIR = Path(settings.local_storage_path) / "metadata"
COURSES_FILE = METADATA_DIR / "courses.json"
EXAMS_FILE   = METADATA_DIR / "exams.json"
RUBRICS_DIR  = METADATA_DIR / "rubrics"

METADATA_DIR.mkdir(parents=True, exist_ok=True)
RUBRICS_DIR.mkdir(parents=True, exist_ok=True)

# ── Schemas ───────────────────────────────────────────────────────────────────

class Course(BaseModel):
    id: str = Field(default_factory=lambda: f"course_{uuid.uuid4().hex[:8]}")
    name: str
    code: str

class RubricMetadata(BaseModel):
    id: str = Field(default_factory=lambda: f"rubric_{uuid.uuid4().hex[:8]}")
    name: str
    questions: int = 0
    total_marks: float = 0
    created_at: str
    course_id: str | None = None

class ExamMetadata(BaseModel):
    id: str
    name: str
    course: str
    courseId: str | None = Field(default=None) # CamelCase to match frontend expectations
    rubric: str | None = None
    uploaded: str
    status: str = "processing"
    students: int = 0
    reviewed: int = 0

class SaveRubricRequest(BaseModel):
    rubric_meta: RubricMetadata
    rubric_json: dict

# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except Exception:
        return []

def _save_json(path: Path, data: list[dict]):
    path.write_text(json.dumps(data, indent=2))

# ── Routes: Courses ───────────────────────────────────────────────────────────

@router.get("/courses")
async def get_courses():
    return _load_json(COURSES_FILE)

@router.post("/courses")
async def create_course(course: Course):
    courses = _load_json(COURSES_FILE)
    courses.append(course.model_dump())
    _save_json(COURSES_FILE, courses)
    return course

# ── Routes: Rubrics ───────────────────────────────────────────────────────────

@router.get("/rubrics")
async def get_rubrics():
    meta_file = METADATA_DIR / "rubrics_index.json"
    return _load_json(meta_file)

@router.post("/rubrics")
async def save_rubric(req: SaveRubricRequest):
    rubric_meta = req.rubric_meta
    rubric_json = req.rubric_json

    # Save the actual JSON content
    rubric_file = RUBRICS_DIR / f"{rubric_meta.id}.json"
    rubric_file.write_text(json.dumps(rubric_json, indent=2))

    # Update index
    meta_file = METADATA_DIR / "rubrics_index.json"
    meta = _load_json(meta_file)
    meta.append(rubric_meta.model_dump())
    _save_json(meta_file, meta)
    
    return rubric_meta

@router.get("/rubrics/{rubric_id}")
async def get_rubric(rubric_id: str):
    rubric_file = RUBRICS_DIR / f"{rubric_id}.json"
    if not rubric_file.exists():
        raise HTTPException(status_code=404, detail="Rubric not found")
    return json.loads(rubric_file.read_text())

# ── Routes: Exams ─────────────────────────────────────────────────────────────

@router.get("/exams")
async def get_exams():
    return _load_json(EXAMS_FILE)

@router.post("/exams")
async def register_exam(exam: ExamMetadata):
    exams = _load_json(EXAMS_FILE)
    # Update if exists, else append
    for i, e in enumerate(exams):
        if e["id"] == exam.id:
            exams[i] = exam.model_dump()
            break
    else:
        exams.insert(0, exam.model_dump())
    
    _save_json(EXAMS_FILE, exams)
    return exam

@router.delete("/exams/{exam_id}")
async def delete_exam(exam_id: str):
    exams = _load_json(EXAMS_FILE)
    exams = [e for e in exams if e["id"] != exam_id]
    _save_json(EXAMS_FILE, exams)
    return {"status": "deleted"}
