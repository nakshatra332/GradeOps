"""
graph.py — StateGraph assembly. The ONLY file that wires nodes and edges.

To add a new node:
  1. Create agents/my_agent.py with a node function.
  2. Import it here and add .add_node() + .add_edge().
  Nothing else needs to change.

Checkpointer:
  - MemorySaver: in-process, lost on restart (development)
  - SqliteSaver:  persists to disk (single-server production)
  - AsyncPostgresSaver: distributed production

  Change the single `checkpointer=` line in `build_graph()` to upgrade.
"""

from __future__ import annotations

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from pipeline.state import ExamGradingState
from pipeline.agents.ingestion import ingestion_agent
from pipeline.agents.ocr       import ocr_agent
from pipeline.agents.grading   import grading_agent
from pipeline.agents.review    import review_node, route_after_review
from pipeline.agents.finalize  import finalize_agent


def build_graph(checkpointer=None):
    """
    Assemble and compile the ExamGradingState graph.

    Args:
        checkpointer: LangGraph checkpointer instance. Defaults to MemorySaver.
                      Must be provided for interrupt() to work.

    Returns:
        A compiled LangGraph CompiledGraph.
    """
    if checkpointer is None:
        checkpointer = MemorySaver()

    builder = StateGraph(ExamGradingState)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    builder.add_node("ingest",   ingestion_agent)
    builder.add_node("ocr",      ocr_agent)
    builder.add_node("grade",    grading_agent)
    builder.add_node("review",   review_node)    # ← interrupt fires here
    builder.add_node("finalize", finalize_agent)

    # ── Edges ──────────────────────────────────────────────────────────────────
    builder.add_edge(START,     "ingest")
    builder.add_edge("ingest",  "ocr")
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
