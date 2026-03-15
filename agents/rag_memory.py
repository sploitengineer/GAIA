"""
FAISS-based RAG Memory for GAIA.
Indexes generated project briefs and PRDs locally.
Used to enrich future requirement generation with similar past projects.
"""

import os
import pickle
from typing import List

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

# Path to persist the FAISS index
INDEX_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "rag_index")

# Load a small, fast local embedding model (no API key needed)
_embeddings = None

def _get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
    return _embeddings


def save_to_rag(text: str, metadata: dict = None) -> None:
    """Save a document (brief, PRD, etc.) to the FAISS vector store."""
    if not text or len(text.strip()) < 50:
        return

    embeddings = _get_embeddings()
    doc = Document(page_content=text, metadata=metadata or {})

    os.makedirs(INDEX_PATH, exist_ok=True)
    index_file = os.path.join(INDEX_PATH, "index.faiss")

    if os.path.exists(index_file):
        try:
            store = FAISS.load_local(INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
            store.add_documents([doc])
        except Exception:
            store = FAISS.from_documents([doc], embeddings)
    else:
        store = FAISS.from_documents([doc], embeddings)

    store.save_local(INDEX_PATH)
    print(f"[RAG] Saved document to FAISS index ({len(text)} chars).")


def query_rag(query: str, k: int = 2) -> str:
    """Query the FAISS store and return relevant past project snippets."""
    embeddings = _get_embeddings()
    index_file = os.path.join(INDEX_PATH, "index.faiss")

    if not os.path.exists(index_file):
        return ""

    try:
        store = FAISS.load_local(INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
        docs = store.similarity_search(query, k=k)
        if not docs:
            return ""
        snippets = []
        for i, d in enumerate(docs, 1):
            snippets.append(f"--- Past Project {i} ---\n{d.page_content[:800]}")
        return "\n\n".join(snippets)
    except Exception as e:
        print(f"[RAG] Query failed: {e}")
        return ""
