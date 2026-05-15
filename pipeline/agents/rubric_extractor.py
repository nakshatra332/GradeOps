"""
agents/rubric_extractor.py — Optional Agent for extracting rubric from a PDF.

Responsibilities:
  1. If `_rubric_pdf_path` is present, read its text using PyMuPDF.
  2. Use Groq LLM to extract a structured RubricSchema JSON.
  3. Return `{"_rubric_raw": extracted_dict}`.
"""

from __future__ import annotations
import fitz
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from schemas.rubric import RubricSchema
from state import ExamGradingState

def extract_rubric_agent(state: ExamGradingState) -> dict:
    """Extract rubric from PDF if _rubric_pdf_path is set."""
    pdf_path = state.get("_rubric_pdf_path")
    if not pdf_path:
        # Pass-through if no PDF was provided (i.e. using raw JSON directly)
        return {}

    # Extract text using PyMuPDF
    try:
        doc = fitz.open(pdf_path)
        text_content = ""
        for page in doc:
            text_content += page.get_text("text") + "\n\n"
        doc.close()
    except Exception as exc:
        return {"error": f"Failed to read marking scheme PDF: {exc}"}

    if not text_content.strip():
        return {"error": "Marking scheme PDF appears to be empty or unreadable."}

    if settings.mock_llm:
        import json
        from pathlib import Path
        try:
            mock_rubric_path = Path("examples/rubric.json")
            return {"_rubric_raw": json.loads(mock_rubric_path.read_text())}
        except Exception as e:
            return {"error": f"Mock rubric failed: {e}"}

    # Initialize Groq LLM
    try:
        llm = ChatGroq(
            api_key=settings.groq_api_key,
            model_name=settings.grading_model,
            max_retries=settings.llm_max_retries,
        )
        # Bind the schema to guarantee JSON output matching our RubricSchema
        structured_llm = llm.with_structured_output(RubricSchema)
        
        system_msg = SystemMessage(content="You are an expert grading assistant. Your task is to extract a structured rubric from the provided marking scheme text. Follow the exact schema required.")
        human_msg = HumanMessage(content=f"Here is the text of the marking scheme document:\n\n{text_content}\n\nExtract and return the structured rubric.")
        
        # Invoke LLM
        rubric_response = structured_llm.invoke([system_msg, human_msg])
        
        # Return the dumped dict for the ingestion agent to process
        return {"_rubric_raw": rubric_response.model_dump()}
    except Exception as exc:
        return {"error": f"Rubric extraction LLM failed: {exc}"}
