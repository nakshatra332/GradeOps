/**
 * api/ws.js — WebSocket client for real-time pipeline stat updates.
 *
 * The FastAPI backend broadcasts stats to ws://localhost:8000/ws/{exam_id}
 * whenever the finalize agent completes. This module manages a single
 * connection per exam and exposes a simple callback API.
 *
 * Usage:
 *   import { watchExam, stopWatching } from '../api/ws.js';
 *
 *   const unsub = watchExam(examId, (stats) => {
 *     console.log('Live stats:', stats);
 *   });
 *
 *   // Later — clean up before navigating away:
 *   unsub();
 */

// Use the current origin for WebSockets if we're not on the default dev port (3000)
const WS_BASE = window.location.port === '3000'
  ? 'ws://localhost:8000'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

/** Active WebSocket connections keyed by examId */
const _sockets = new Map();

/** Listeners keyed by examId: Set<function> */
const _listeners = new Map();


/**
 * Start watching live stats for an exam.
 *
 * If a connection for this examId already exists it is reused.
 * Multiple callers can watch the same exam safely.
 *
 * @param {string}   examId   - The exam to watch
 * @param {function} callback - Called with the stats object whenever
 *                              the backend pushes an update
 * @returns {function} unsub  - Call this to stop watching
 */
export function watchExam(examId, callback) {
  if (!_listeners.has(examId)) {
    _listeners.set(examId, new Set());
  }
  _listeners.get(examId).add(callback);

  // Open socket if not already open
  if (!_sockets.has(examId)) {
    _openSocket(examId);
  }

  // Return unsubscribe function
  return () => {
    const listeners = _listeners.get(examId);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        stopWatching(examId);
      }
    }
  };
}


/**
 * Close the WebSocket for an exam and remove all listeners.
 * Called automatically when the last listener unsubscribes.
 *
 * @param {string} examId
 */
export function stopWatching(examId) {
  const ws = _sockets.get(examId);
  if (ws) {
    ws.close();
    _sockets.delete(examId);
  }
  _listeners.delete(examId);
}


/**
 * Check if a live connection is open for an exam.
 * @param {string} examId
 * @returns {boolean}
 */
export function isWatching(examId) {
  const ws = _sockets.get(examId);
  return !!ws && ws.readyState === WebSocket.OPEN;
}


// ── Internal helpers ───────────────────────────────────────────────────────────

function _openSocket(examId) {
  let ws;
  try {
    ws = new WebSocket(`${WS_BASE}/ws/${examId}`);
  } catch (err) {
    console.warn(`[ws] Could not connect for exam ${examId}:`, err);
    return;
  }

  _sockets.set(examId, ws);

  ws.addEventListener('open', () => {
    console.log(`[ws] Connected — exam ${examId}`);
  });

  ws.addEventListener('message', event => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'stats_update' && payload.exam_id === examId) {
        const listeners = _listeners.get(examId) ?? new Set();
        listeners.forEach(cb => {
          try { cb(payload.data); } catch (e) { console.error('[ws] Listener error:', e); }
        });
      }
    } catch (err) {
      console.warn('[ws] Failed to parse message:', err);
    }
  });

  ws.addEventListener('close', event => {
    console.log(`[ws] Closed — exam ${examId} (code ${event.code})`);
    _sockets.delete(examId);

    // Auto-reconnect after 3 s if listeners still exist and it wasn't a clean close
    if (_listeners.has(examId) && _listeners.get(examId).size > 0 && event.code !== 1000) {
      setTimeout(() => {
        if (_listeners.has(examId) && _listeners.get(examId).size > 0) {
          console.log(`[ws] Reconnecting — exam ${examId}`);
          _openSocket(examId);
        }
      }, 3000);
    }
  });

  ws.addEventListener('error', err => {
    // Errors fire before close — the close handler does the reconnect
    console.warn(`[ws] Error — exam ${examId}:`, err);
  });
}
