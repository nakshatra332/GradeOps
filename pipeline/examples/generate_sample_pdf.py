#!/usr/bin/env python3
"""
examples/generate_sample_pdf.py — Create a minimal test PDF for the pipeline.

Usage:
    cd pipeline
    pip install reportlab   # one-time
    python examples/generate_sample_pdf.py

Generates examples/sample_exam.pdf with 4 pages (2 students × 2 pages each).
"""

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pathlib import Path

STUDENT_ANSWERS = [
    {
        "id": "S001",
        "q1": (
            "QuickSort has an average case time complexity of O(n log n). "
            "This comes from the recurrence T(n) = 2T(n/2) + O(n), where the "
            "partition step takes O(n) and we recurse on two halves. "
            "In the worst case, when the pivot is always the smallest or largest "
            "element (e.g. sorted input), complexity degrades to O(n²)."
        ),
        "q2": (
            "BFS uses a queue and explores level by level. It finds the shortest "
            "path in unweighted graphs. DFS uses a stack (or recursion) and goes "
            "deep first. DFS is useful for topological sort and cycle detection. "
            "Both have time complexity O(V+E)."
        ),
    },
    {
        "id": "S002",
        "q1": (
            "QuickSort divides the array using a pivot. Average is O(n log n) "
            "but the worst case O(n^2) occurs when pivots are poorly chosen. "
            "The partition step is linear O(n)."
        ),
        "q2": (
            "BFS goes broad first, uses a queue. Good for finding shortest path. "
            "DFS goes deep first, uses stack. Useful for cycle detection. "
            "Both run in O(V + E) time."
        ),
    },
]


<<<<<<< HEAD
def generate(output_dir: str = "examples/submissions"):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    for student in STUDENT_ANSWERS:
        output_path = f"{output_dir}/{student['id']}.pdf"
        c = canvas.Canvas(output_path, pagesize=A4)
        w, h = A4

=======
def generate(output_path: str = "examples/sample_exam.pdf"):
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4

    for student in STUDENT_ANSWERS:
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
        for page_num, (q_key, q_label) in enumerate([("q1", "Question 1"), ("q2", "Question 2")]):
            c.setFont("Helvetica-Bold", 14)
            c.drawString(50, h - 50, f"CS 301 Midterm — {student['id']} — {q_label}")
            c.setFont("Helvetica", 11)

            # Simulate handwriting as text blocks
            text = c.beginText(50, h - 100)
            text.setFont("Courier", 10)
            text.setLeading(16)
            for line in student[q_key].split(". "):
                text.textLine(line.strip() + ("." if not line.endswith(".") else ""))
            c.drawText(text)

            c.showPage()

<<<<<<< HEAD
        c.save()
        print(f"Sample PDF written to: {output_path}")


def generate_marking_scheme(output_path: str = "examples/sample_marking_scheme.pdf"):
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, h - 50, "Marking Scheme: CS 301 Midterm")

    text = c.beginText(50, h - 100)
    text.setFont("Helvetica", 12)
    text.setLeading(18)
    
    lines = [
        "Exam: Midterm — Data Structures & Algorithms",
        "Course: CS 301",
        "Pages per student: 2",
        "",
        "Question 1 (10 marks)",
        "Explain the time complexity of QuickSort in average and worst cases. Derive the recurrence.",
        "Criteria:",
        "- Correct average case O(n log n) [3 marks]",
        "- Worst case O(n²) mentioned [3 marks]",
        "- Partition step explained as O(n) [2 marks]",
        "- Recurrence T(n)=2T(n/2)+O(n) stated [2 marks]",
        "Acceptable patterns: O(n log n), nlogn, n log n, O(n^2), O(n²)",
        "",
        "Question 2 (10 marks)",
        "Compare BFS and DFS. When would you use each?",
        "Criteria:",
        "- BFS uses a queue; DFS uses a stack [2 marks]",
        "- BFS finds shortest path in unweighted graphs [3 marks]",
        "- DFS useful for topological sort / cycle detection [3 marks]",
        "- Correct time complexity O(V+E) for both [2 marks]",
        "Acceptable patterns: queue, stack, O(V+E), shortest path, topological"
    ]
    
    for line in lines:
        text.textLine(line)
        
    c.drawText(text)
    c.save()
    print(f"Sample marking scheme PDF written to: {output_path}")
=======
    c.save()
    print(f"Sample PDF written to: {output_path}")
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0


if __name__ == "__main__":
    generate()
<<<<<<< HEAD
    generate_marking_scheme()
=======
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0
