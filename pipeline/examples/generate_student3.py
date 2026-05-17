from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from pathlib import Path

def generate_s003():
    output_dir = "examples/submissions"
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    output_path = f"{output_dir}/S003.pdf"
    c = canvas.Canvas(output_path, pagesize=A4)
    w, h = A4

    q1_ans = "QuickSort uses a divide-and-conquer approach. In the average case, it takes O(n log n) time because the pivot splits the array into two roughly equal halves. The worst case happens when the pivot is always the maximum or minimum element, giving O(n^2) time complexity. The partition step takes O(n) time."
    q2_ans = "BFS stands for Breadth First Search. It explores the graph layer by layer using a queue. DFS stands for Depth First Search and uses a stack or recursion. BFS is great for shortest path problems. They both take O(V + E) time."

    for page_num, (q_key, q_label, ans) in enumerate([("q1", "Question 1", q1_ans), ("q2", "Question 2", q2_ans)]):
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, h - 50, f"CS 301 Midterm — S003 — {q_label}")
        c.setFont("Helvetica", 11)

        text = c.beginText(50, h - 100)
        text.setFont("Courier", 10)
        text.setLeading(16)
        
        for line in ans.split(". "):
            text.textLine(line.strip() + ("." if not line.endswith(".") else ""))
            
        c.drawText(text)
        c.showPage()

    c.save()
    print(f"Created new sample student PDF: {output_path}")

if __name__ == "__main__":
    generate_s003()
