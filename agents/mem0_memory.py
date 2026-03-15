"""
Mem0-based personalized agent memory for GAIA.
Stores and retrieves user preferences across sessions.
Similar to ChatGPT's "memory" feature — agents remember user's preferences.
"""

import os

try:
    from mem0 import Memory
    _mem0_available = True
except ImportError:
    _mem0_available = False
    print("[Mem0] mem0ai not installed. Personalized memory disabled.")

# Mem0 in-process local config (no server required)
MEM0_CONFIG = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "gaia_user_memory",
            "path": os.path.join(os.path.dirname(os.path.dirname(__file__)), "mem0_db"),
        }
    }
}

_memory_instance = None

def _get_memory():
    global _memory_instance
    if _memory_instance is None and _mem0_available:
        try:
            _memory_instance = Memory.from_config(MEM0_CONFIG)
        except Exception as e:
            print(f"[Mem0] Failed to initialize: {e}")
    return _memory_instance


def save_user_memory(user_id: str, facts: str) -> None:
    """
    Save a fact or preference about the user to Mem0.
    Called after context synthesis to capture user's preferences.
    E.g.: "User prefers React for frontend and Postgres for database."
    """
    m = _get_memory()
    if not m or not facts.strip():
        return
    try:
        m.add(facts, user_id=user_id)
        print(f"[Mem0] Saved memory for user '{user_id}'.")
    except Exception as e:
        print(f"[Mem0] Save failed: {e}")


def get_user_memory(user_id: str, query: str = "user preferences and past decisions") -> str:
    """
    Retrieve relevant memories for a user.
    Called at the start of clarification to pre-fill known preferences.
    Returns a formatted string of past memories, or empty string if none.
    """
    m = _get_memory()
    if not m:
        return ""
    try:
        results = m.search(query, user_id=user_id, limit=5)
        if not results:
            return ""
        memories = results.get("results", results) if isinstance(results, dict) else results
        lines = []
        for mem in memories:
            text = mem.get("memory", str(mem))
            lines.append(f"- {text}")
        return "Previously known about this user:\n" + "\n".join(lines)
    except Exception as e:
        print(f"[Mem0] Recall failed: {e}")
        return ""
