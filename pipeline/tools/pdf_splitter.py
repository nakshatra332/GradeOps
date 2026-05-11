"""
tools/pdf_splitter.py — Split a multi-student PDF into per-student page images.

Uses PyMuPDF (fitz) which renders pages to PNG — suitable for sending
directly to a vision model without an extra OCR pre-processing step.
"""

from __future__ import annotations
from pathlib import Path
import fitz  # PyMuPDF


def split_pdf_to_images(
    pdf_path: str,
    pages_per_student: int,
    dpi: int = 150,
) -> list[list[bytes]]:
    """
    Split a PDF into groups of `pages_per_student` pages and render each
    page as a PNG image.

    Args:
        pdf_path:          Path to the PDF file.
        pages_per_student: Number of consecutive pages that belong to one student.
        dpi:               Render resolution. 150 dpi is enough for VLM transcription.

    Returns:
        A list of student page-groups. Each group is a list of PNG bytes,
        one per page.

        e.g. for a 6-page PDF with pages_per_student=2:
            [[page0_png, page1_png],   # student 0
             [page2_png, page3_png],   # student 1
             [page4_png, page5_png]]   # student 2
    """
    doc = fitz.open(pdf_path)
    total_pages = len(doc)

    if total_pages % pages_per_student != 0:
        raise ValueError(
            f"PDF has {total_pages} pages, which is not divisible by "
            f"pages_per_student={pages_per_student}. "
            "Check that the PDF is complete and the rubric value is correct."
        )

    zoom = dpi / 72  # fitz default is 72 dpi
    mat = fitz.Matrix(zoom, zoom)

    student_groups: list[list[bytes]] = []
    for start in range(0, total_pages, pages_per_student):
        pages_png: list[bytes] = []
        for page_num in range(start, start + pages_per_student):
            page = doc[page_num]
            pixmap = page.get_pixmap(matrix=mat)
            pages_png.append(pixmap.tobytes("png"))
        student_groups.append(pages_png)

    doc.close()
    return student_groups


def count_students_in_pdf(pdf_path: str, pages_per_student: int) -> int:
    """Return how many students are in the PDF without rendering any pages."""
    doc = fitz.open(pdf_path)
    n = len(doc)
    doc.close()
    if n % pages_per_student != 0:
        raise ValueError(f"PDF page count {n} not divisible by {pages_per_student}")
    return n // pages_per_student
