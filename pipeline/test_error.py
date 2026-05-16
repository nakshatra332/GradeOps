import asyncio
from pathlib import Path
from pipeline.graph import graph
import os

os.environ["MOCK_LLM"] = "true"

pdf_path = Path("examples/sample_exam.pdf")
rubric_raw = Path("examples/rubric.json").read_text()

initial_state = {
    "_pdf_path": str(pdf_path),
    "_rubric_raw": rubric_raw,
    "exam_id": "test_error_123",
    "students": [],
    "current_review_idx": 0,
    "stats": {},
    "error": None,
    "rubric": {},
}

try:
    result = graph.invoke(initial_state, config={"configurable": {"thread_id": "test_error_123"}})
    print("Result:", result)
except Exception as e:
    import traceback
    traceback.print_exc()
