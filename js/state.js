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

  // Tracks the exam currently being graded by the live pipeline.
  // Set by upload.js after POST /pipeline/start, read by ta-review.js.
  activeExamId: null,

<<<<<<< HEAD
  course: { code: 'CS 301', name: 'Algorithms' },
=======
  // The currently active course context
  selectedCourseId: null,
>>>>>>> 63e8a80e29fe3b5f4b16edbf8eb97b77e87ee3c0

  users: [
    { id: 1, name: 'Prof. Rajesh Kumar',  email: 'rk@cs.edu', role: 'instructor', avatar: 'RK', color: '#E1F5EE', tc: '#0F6E56' },
    { id: 2, name: 'Ankita Sharma',       email: 'as@cs.edu', role: 'ta',         avatar: 'AS', color: '#E6F1FB', tc: '#185FA5' },
    { id: 3, name: 'Nakshatra Bora',      email: 'nb@cs.edu', role: 'ta',         avatar: 'NB', color: '#EEEDFE', tc: '#534AB7' },
    { id: 4, name: 'Priya Nath',          email: 'pn@cs.edu', role: 'ta',         avatar: 'PN', color: '#E1F5EE', tc: '#0F6E56' },
  ],

  exams: [],
  rubrics: [],
  pendingReviews: [],
};

/** Simulates network latency. Replace with real fetch() in api/* files when deploying. */
export const delay = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
