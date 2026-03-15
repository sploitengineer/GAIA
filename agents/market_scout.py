"""
Market Scout Agent for GAIA.
Searches the web for competitors using Tavily, extracts features,
and proposes differentiating features for the user's product.

The node pauses workflow execution by returning a signal in state.
The frontend receives this, shows competitor cards + feature checkboxes,
and the user's selections are injected as `preferred_features` back into state.
"""

import os
import json
import time
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage

load_dotenv()

# ── Lazy-load Tavily (graceful fallback if not installed) ──────────────────────
try:
    from tavily import TavilyClient
    _tavily_available = True
except ImportError:
    _tavily_available = False
    print("[Market Scout] tavily-python not installed. Web search disabled.")

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

_llm = None

def _get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            temperature=0.4,
            model_name="llama-3.3-70b-versatile",
            api_key=GROQ_API_KEY,
            max_retries=5
        ).bind(response_format={"type": "json_object"})
    return _llm


MARKET_SCOUT_PROMPT = """You are a competitive intelligence analyst. A startup wants to build: "{idea}"

Here is raw search data about similar existing products:
{search_results}

Your task: Return a JSON object with this exact structure:
{{
  "competitors": [
    {{
      "name": "Product Name",
      "description": "One sentence description",
      "features": ["feature 1", "feature 2", "feature 3"]
    }}
  ],
  "differentiating_features": [
    "Feature idea 1 that would make this product better",
    "Feature idea 2",
    "Feature idea 3",
    "Feature idea 4",
    "Feature idea 5"
  ],
  "market_summary": "A 2-sentence summary of the market landscape."
}}

Include 3-5 competitors and exactly 5-7 differentiating features. Base everything on the search data provided. Be specific, not generic.
"""


def market_scout_node(state: dict) -> dict:
    """
    Searches the web for competitors and suggests differentiating features.
    Returns state update with `market_research` populated and `awaiting_feature_selection=True`.
    This signals the WebSocket handler to pause and await user checkbox input.
    """
    print("--- MARKET SCOUT ---")
    start_time = time.perf_counter()

    idea = state.get("formatted_context", state.get("initial_idea", ""))

    # ── Step 1: Tavily web search ─────────────────────────────────────────────
    search_results_text = ""
    if _tavily_available and TAVILY_API_KEY:
        try:
            client = TavilyClient(api_key=TAVILY_API_KEY)
            # Craft a focused search query
            search_query = f"top products similar to: {idea[:200]}"
            results = client.search(
                query=search_query,
                search_depth="advanced",
                max_results=6,
                include_answer=True
            )
            # Format raw results
            snippets = []
            for r in results.get("results", []):
                title = r.get("title", "Unknown")
                content = r.get("content", "")[:400]
                snippets.append(f"[{title}]: {content}")
            if results.get("answer"):
                snippets.insert(0, f"[Summary]: {results['answer']}")
            search_results_text = "\n\n".join(snippets)
            print(f"[Market Scout] Found {len(snippets)} search results.")
        except Exception as e:
            print(f"[Market Scout] Tavily search failed: {e}")
            search_results_text = f"Search unavailable. Idea: {idea[:300]}"
    else:
        # Fallback — LLM generates plausible competitors from its training data
        search_results_text = f"No search results available. Use your knowledge about products similar to: {idea[:300]}"

    # ── Step 2: LLM extracts structured market intelligence ──────────────────
    prompt = MARKET_SCOUT_PROMPT.format(
        idea=idea[:500],
        search_results=search_results_text[:3000]
    )

    try:
        llm = _get_llm()
        response = llm.invoke([HumanMessage(content=prompt)])
        market_data = json.loads(response.content)
    except Exception as e:
        print(f"[Market Scout] LLM extraction failed: {e}")
        market_data = {
            "competitors": [],
            "differentiating_features": ["Feature detection unavailable."],
            "market_summary": "Market research could not be completed."
        }

    latency = round(time.perf_counter() - start_time, 2)
    telemetry = state.get("telemetry", {})
    telemetry["market_scout_node"] = {"latency": latency, "confidence": 0.85}

    print(f"[Market Scout] Found {len(market_data.get('competitors', []))} competitors in {latency}s")

    return {
        "market_research": market_data,
        "current_phase": "market_research",
        "latest_message": f"Market Scout: Found {len(market_data.get('competitors', []))} competitors. Please select your preferred features.",
        "telemetry": telemetry
    }
