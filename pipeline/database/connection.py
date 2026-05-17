"""
database/connection.py -- MongoDB connection and LangGraph checkpointer factory.

Reads the MONGODB_URI from Settings (which loads .env) and creates a
MongoDBSaver checkpointer for LangGraph. Falls back to MemorySaver if
the connection fails (wrong password, network error, etc.).
"""

from __future__ import annotations

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.mongodb import MongoDBSaver

from config import settings


def get_checkpointer():
    """Return a LangGraph checkpointer backed by MongoDB Atlas.

    Tries to connect to MongoDB using the URI from ``settings.mongodb_uri``.
    On any connection error falls back to in-memory ``MemorySaver`` and prints
    a clear warning so the developer knows persistence is disabled.
    """
    try:
        client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        # Verify credentials by pinging the server
        client.admin.command("ping")
        print("[database] Connected to MongoDB Atlas successfully.")
        return MongoDBSaver(client)
    except (ConnectionFailure, OperationFailure) as exc:
        print(f"\nWARNING: Could not connect to MongoDB: {exc}")
        print("WARNING: Falling back to MemorySaver (data will be lost on restart).")
        print("TIP: Check your MONGODB_URI and password in pipeline/.env\n")
        return MemorySaver()
    except Exception as exc:
        print(f"\nWARNING: Unexpected error initializing MongoDB checkpointer: {exc}")
        print("WARNING: Falling back to MemorySaver.\n")
        return MemorySaver()


def get_mongo_client():
    """Return a raw MongoClient for direct database queries (e.g. listing exams).

    Returns None if the connection fails.
    """
    try:
        client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return client
    except Exception:
        return None
