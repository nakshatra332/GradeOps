"""
tools/pdf_splitter.py — Split a multi-student PDF into per-student page images.

Uses PyMuPDF (fitz) which renders pages to PNG — suitable for sending
directly to a vision model without an extra OCR pre-processing step.
"""

from __future__ import annotations
from pathlib import Path
import fitz  # PyMuPDF


def convert_pdf_to_images(
    pdf_path: str,
    dpi: int = 150,
) -> list[bytes]:
    """
    Render all pages of a single student's PDF as PNG images.

    Args:
        pdf_path: Path to the PDF file.
        dpi:      Render resolution. 150 dpi is enough for VLM transcription.

    Returns:
        A list of PNG bytes, one per page.
    """
    doc = fitz.open(pdf_path)
    zoom = dpi / 72  # fitz default is 72 dpi
    mat = fitz.Matrix(zoom, zoom)

    pages_png: list[bytes] = []
    for page in doc:
        pixmap = page.get_pixmap(matrix=mat)
        pages_png.append(pixmap.tobytes("png"))

    doc.close()
    return pages_png
