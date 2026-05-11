"""
server/ws.py — WebSocket channel for real-time stat push.

The finalize agent calls broadcast_stats() after every exam completes.
The GradeOps frontend connects to ws://localhost:8000/ws/{exam_id}
and receives live stat updates.
"""

from __future__ import annotations
import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

# In-memory map: exam_id → set of connected WebSocket clients
_connections: dict[str, set[WebSocket]] = defaultdict(set)


async def connect(exam_id: str, ws: WebSocket):
    await ws.accept()
    _connections[exam_id].add(ws)


def disconnect(exam_id: str, ws: WebSocket):
    _connections[exam_id].discard(ws)
    if not _connections[exam_id]:
        del _connections[exam_id]


async def broadcast_stats(exam_id: str, stats: dict[str, Any]):
    """Send stats to all connected clients for this exam."""
    if exam_id not in _connections:
        return
    payload = json.dumps({"type": "stats_update", "exam_id": exam_id, "data": stats})
    dead: set[WebSocket] = set()
    for ws in _connections[exam_id]:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _connections[exam_id].discard(ws)
