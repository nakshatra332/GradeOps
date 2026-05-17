"""
graph.py — StateGraph assembly. The ONLY file that wires nodes and edges.

To add a new node:
  1. Create agents/my_agent.py with a node function.
  2. Import it here and add .add_node() + .add_edge().
  Nothing else needs to change.

Checkpointer:
<<<<<<< HEAD
  - MongoDBSaver: persists to MongoDB Atlas (default, production-ready)
  - MemorySaver:  in-process, lost on restart (fallback if MongoDB unavailable)

  The database.connection module handles the connection automatically.
=======
  - MemorySaver: in-process, lost on restart (development)
  - SqliteSaver:  persists to disk (single-server production)
  - AsyncPostgresSaver: distributed production

  Change the single `checkpointer=` line in `build_graph()` to upgrade.
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
"""

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
<<<<<<< HEAD

from database.connection import get_checkpointer

from state import ExamGradingState
from agents.rubric_extractor import extract_rubric_agent
from agents.ingestion import ingestion_agent
from agents.ocr       import ocr_agent
from agents.grading   import grading_agent
from agents.review    import review_node, route_after_review
from agents.finalize  import finalize_agent
=======
from langgraph.checkpoint.memory import MemorySaver

from pipeline.state import ExamGradingState
from pipeline.agents.ingestion import ingestion_agent
from pipeline.agents.ocr       import ocr_agent
from pipeline.agents.grading   import grading_agent
from pipeline.agents.review    import review_node, route_after_review
from pipeline.agents.finalize  import finalize_agent
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


def build_graph(checkpointer=None):
    """
    Assemble and compile the ExamGradingState graph.

    Args:
<<<<<<< HEAD
        checkpointer: LangGraph checkpointer instance.
                      Defaults to MongoDBSaver (falls back to MemorySaver).
=======
        checkpointer: LangGraph checkpointer instance. Defaults to MemorySaver.
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
                      Must be provided for interrupt() to work.

    Returns:
        A compiled LangGraph CompiledGraph.
    """
    if checkpointer is None:
<<<<<<< HEAD
        checkpointer = get_checkpointer()
=======
        checkpointer = MemorySaver()
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

    builder = StateGraph(ExamGradingState)

    # ── Nodes ──────────────────────────────────────────────────────────────────
<<<<<<< HEAD
    builder.add_node("extract_rubric", extract_rubric_agent)
=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    builder.add_node("ingest",   ingestion_agent)
    builder.add_node("ocr",      ocr_agent)
    builder.add_node("grade",    grading_agent)
    builder.add_node("review",   review_node)    # ← interrupt fires here
    builder.add_node("finalize", finalize_agent)

    # ── Edges ──────────────────────────────────────────────────────────────────
<<<<<<< HEAD
    builder.add_edge(START,            "extract_rubric")
    builder.add_edge("extract_rubric", "ingest")
    builder.add_edge("ingest",         "ocr")
=======
    builder.add_edge(START,     "ingest")
    builder.add_edge("ingest",  "ocr")
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
    builder.add_edge("ocr",     "grade")
    builder.add_edge("grade",   "review")

    # After each TA decision: loop back to review the next student, or finish
    builder.add_conditional_edges(
        "review",
        route_after_review,
        {
            "continue": "review",   # next student → interrupt again
            "done":     "finalize", # all students reviewed
        },
    )

    builder.add_edge("finalize", END)

    return builder.compile(checkpointer=checkpointer)


# Module-level default graph instance (used by main.py and the FastAPI server)
graph = build_graph()
