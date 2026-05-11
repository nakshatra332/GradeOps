/**
 * state.js — Central in-memory data store.
 *
 * This is the ONLY place where raw data lives.
 * Pages interact with data exclusively through js/api/* functions.
 * When you connect a real backend, replace the api/* internals — this file stays.
 */

export const store = {
  role: 'instructor',
  page: 'dashboard',

  course: { code: 'CS 301', name: 'Algorithms' },

  users: [
    { id: 1, name: 'Prof. Rajesh Kumar',  email: 'rk@cs.edu', role: 'instructor', avatar: 'RK', color: '#E1F5EE', tc: '#0F6E56' },
    { id: 2, name: 'Ankita Sharma',       email: 'as@cs.edu', role: 'ta',         avatar: 'AS', color: '#E6F1FB', tc: '#185FA5' },
    { id: 3, name: 'Nakshatra Bora',      email: 'nb@cs.edu', role: 'ta',         avatar: 'NB', color: '#EEEDFE', tc: '#534AB7' },
    { id: 4, name: 'Priya Nath',          email: 'pn@cs.edu', role: 'ta',         avatar: 'PN', color: '#E1F5EE', tc: '#0F6E56' },
  ],

  exams: [
    { id: 1, name: 'Midterm Exam — Section A',    course: 'CS 301', pages: 28, uploaded: 'May 8, 2026',  status: 'graded',     rubric: 'midterm_rubric.json', students: 28, reviewed: 22, pending: 6  },
    { id: 2, name: 'Quiz 3 — Sorting Algorithms', course: 'CS 301', pages: 15, uploaded: 'May 9, 2026',  status: 'processing', rubric: 'quiz3_rubric.json',   students: 15, reviewed: 0,  pending: 15 },
    { id: 3, name: 'Assignment 2 Submission',     course: 'CS 301', pages: 34, uploaded: 'May 10, 2026', status: 'pending',    rubric: null,                  students: 34, reviewed: 0,  pending: 34 },
  ],

  rubrics: [
    { id: 1, name: 'midterm_rubric.json', questions: 5, totalMarks: 50, created: 'May 7, 2026'  },
    { id: 2, name: 'quiz3_rubric.json',   questions: 3, totalMarks: 15, created: 'May 9, 2026'  },
  ],

  pendingReviews: [
    { id: 1, exam: 'Midterm — Section A', student: 'Student 23', q: 'Q1: Explain time complexity of QuickSort',  ai_score: 7, max: 10, confidence: 'high',   status: 'pending'    },
    { id: 2, exam: 'Midterm — Section A', student: 'Student 14', q: 'Q2: Describe Dijkstra\'s Algorithm',        ai_score: 4, max: 10, confidence: 'low',    status: 'pending'    },
    { id: 3, exam: 'Midterm — Section A', student: 'Student 07', q: 'Q3: Prove correctness of BFS',              ai_score: 9, max: 10, confidence: 'high',   status: 'pending'    },
    { id: 4, exam: 'Midterm — Section A', student: 'Student 19', q: 'Q4: Analyze Merge Sort space complexity',   ai_score: 5, max: 10, confidence: 'medium', status: 'pending'    },
    { id: 5, exam: 'Midterm — Section A', student: 'Student 02', q: 'Q1: Explain time complexity of QuickSort',  ai_score: 8, max: 10, confidence: 'high',   status: 'approved'   },
    { id: 6, exam: 'Quiz 3',              student: 'Student 11', q: 'Q2: Describe Dijkstra\'s Algorithm',        ai_score: 3, max: 5,  confidence: 'medium', status: 'overridden' },
  ],
};

/** Simulates network latency. Replace with real fetch() in api/* files when deploying. */
export const delay = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
