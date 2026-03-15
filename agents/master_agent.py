import os
import json
import time
from dotenv import load_dotenv
from groq import RateLimitError

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, START, END

from agents.state import AgentState
from agents.prompts import (
    CLARIFICATION_PROMPT,
    SUFFICIENCY_CHECKER_PROMPT,
    CONTEXT_SYNTHESIZER_PROMPT,
    REQUIREMENT_AGENT_PROMPT,
    PM_AGENT_PROMPT,
    SCRUM_AGENT_PROMPT,
    TASK_AGENT_PROMPT,
    REVIEWER_PROMPT
)
from agents.utils import save_artifact
from agents.market_scout import market_scout_node
from agents.rag_memory import save_to_rag, query_rag
from agents.mem0_memory import save_user_memory, get_user_memory

load_dotenv()

# ── Key Rotation Pool ──────────────────────────────────────────────────────────
# Tries each key in order; skips keys that hit rate limits.
GROQ_KEYS = [
    k for k in [
        os.getenv("GROQ_API_KEY"),
        os.getenv("GROQ_API_KEY_2"),
        os.getenv("GROQ_API_KEY_PREVIOUS"),
    ] if k
]

def _make_llm(key: str, model: str, temperature: float, json_mode: bool = False):
    client = ChatGroq(temperature=temperature, model_name=model, api_key=key, max_retries=2)
    return client.bind(response_format={"type": "json_object"}) if json_mode else client

def invoke_with_rotation(messages, model="llama-3.3-70b-versatile", temperature=0.7, json_mode=False):
    """Try each Groq key in rotation; move to next on 429."""
    for i, key in enumerate(GROQ_KEYS):
        try:
            client = _make_llm(key, model, temperature, json_mode)
            return client.invoke(messages)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower():
                print(f"[Key Rotation] Key {i+1} rate-limited. Trying next key...")
                if i == len(GROQ_KEYS) - 1:
                    print("[Key Rotation] All keys exhausted. Waiting 60s before retry...")
                    time.sleep(60)
                    return invoke_with_rotation(messages, model, temperature, json_mode)
                continue
            raise
    raise RuntimeError("All Groq API keys failed.")

def format_q_and_a(questions, answers):
    if not questions:
        return "None"
    formatted = []
    for q in questions:
        ans = answers.get(q, "Not answered yet")
        formatted.append(f"Q: {q}\nA: {ans}")
    return "\n".join(formatted)

def sufficiency_node(state: AgentState):
    """Evaluates the Information Density."""
    print("--- SUFFICIENCY CHECKER ---")
    start_time = time.perf_counter()
    q_and_a = format_q_and_a(state.get("clarification_questions", []), state.get("user_answers", {}))
    prompt = SUFFICIENCY_CHECKER_PROMPT.format(
        initial_idea=state.get("initial_idea", ""),
        user_answers=q_and_a
    )
    
    # Use fast 8b model for JSON classification — saves ~10x tokens
    response = invoke_with_rotation([HumanMessage(content=prompt)], model="llama-3.1-8b-instant", temperature=0.1, json_mode=True)
    try:
        data = json.loads(response.content)
        score = data.get("score", 0.0)
        is_suff = data.get("is_sufficient", False)
    except Exception:
        score = 0.0
        is_suff = False
        
    latency = round(time.perf_counter() - start_time, 2)
    telemetry = state.get("telemetry", {})
    telemetry["sufficiency_node"] = {"latency": latency, "confidence": score}

    return {"info_density_score": score, "is_sufficient": is_suff, "current_phase": "clarification", "telemetry": telemetry}

def clarification_node(state: AgentState):
    """Asks clarification questions if info is missing.
    Also injects Mem0 personalized memory if user has past sessions."""
    print("--- CLARIFICATION AGENT ---")
    q_and_a = format_q_and_a(state.get("clarification_questions", []), state.get("user_answers", {}))
    
    # Inject personalized memory from Mem0
    user_id = state.get("user_id", "default_user")
    past_memory = get_user_memory(user_id)
    memory_context = f"\n\n{past_memory}" if past_memory else ""
    
    prompt = CLARIFICATION_PROMPT.format(
        initial_idea=state.get("initial_idea", ""),
        clarification_questions=state.get("clarification_questions", []),
        user_answers=q_and_a
    ) + memory_context
    
    start_time = time.perf_counter()
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    content = response.content.strip()
    
    questions = state.get("clarification_questions", [])
    if "Context Sufficient" not in content:
        questions = questions.copy()
        questions.append(content)
        
    latency = round(time.perf_counter() - start_time, 2)
    telemetry = state.get("telemetry", {})
    telemetry["clarification_node"] = {"latency": latency, "confidence": 0.9}

    return {"latest_message": content, "clarification_questions": questions, "telemetry": telemetry}

def context_synthesizer_node(state: AgentState):
    print("--- CONTEXT SYNTHESIZER ---")
    q_and_a = format_q_and_a(state.get("clarification_questions", []), state.get("user_answers", {}))
    prompt = CONTEXT_SYNTHESIZER_PROMPT.format(
        initial_idea=state.get("initial_idea", ""),
        user_answers=q_and_a
    )
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    synthesized = response.content

    # Save user preferences to Mem0 for future sessions
    user_id = state.get("user_id", "default_user")
    save_user_memory(user_id, f"User's project context: {synthesized[:500]}")
    
    return {"formatted_context": synthesized, "current_phase": "synthesis"}

def requirement_node(state: AgentState):
    """Generates the Project Brief, enriched by RAG context + user-selected features."""
    print("--- REQUIREMENT AGENT ---")
    
    # Query RAG for similar past projects
    rag_context = query_rag(state.get("formatted_context", ""))
    rag_section = f"\n\n## Similar Past Projects for Reference:\n{rag_context}" if rag_context else ""
    
    # Inject user-selected features from Market Scout
    preferred = state.get("preferred_features", [])
    features_section = ""
    if preferred:
        features_section = "\n\n## User-Selected Differentiating Features (MUST include in brief):\n" + "\n".join(f"- {f}" for f in preferred)
    
    prompt = REQUIREMENT_AGENT_PROMPT.format(
        formatted_context=state.get("formatted_context", "") + rag_section + features_section
    )
    
    start_time = time.perf_counter()
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    brief = response.content
    save_artifact("project_brief.md", brief)
    
    # Save brief to FAISS RAG for future projects
    save_to_rag(brief, metadata={"type": "project_brief", "phase": "requirement"})

    latency = round(time.perf_counter() - start_time, 2)
    telemetry = state.get("telemetry", {})
    telemetry["requirement_node"] = {"latency": latency, "confidence": 0.85}

    return {"project_brief": brief, "current_phase": "brief_generation", "telemetry": telemetry}

def pm_node(state: AgentState):
    """Generates the PRD based on Brief."""
    print("--- PM AGENT ---")
    prompt = PM_AGENT_PROMPT.format(project_brief=state.get("project_brief", ""))
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    prd = response.content
    save_artifact("prd.md", prd)
    
    # Save PRD to FAISS RAG
    save_to_rag(prd, metadata={"type": "prd", "phase": "pm"})
    
    return {"prd": prd, "current_phase": "prd_generation"}

def scrum_node(state: AgentState):
    """Generates Epics and Stories based on PRD."""
    print("--- SCRUM AGENT ---")
    prompt = SCRUM_AGENT_PROMPT.format(prd=state.get("prd", ""))
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    content = response.content
    save_artifact("epics.md", content)
    save_artifact("stories.md", content)
    return {"epics": content, "stories": content, "current_phase": "scrum_generation"}

def task_node(state: AgentState):
    """Generates Tasks and Subtasks."""
    print("--- TASK AGENT ---")
    prompt = TASK_AGENT_PROMPT.format(
        stories=state.get("stories", ""),
        review_feedback=state.get("review_feedback", "None")
    )
    start_time = time.perf_counter()
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    tasks = response.content
    save_artifact("tasks.md", tasks)

    latency = round(time.perf_counter() - start_time, 2)
    telemetry = state.get("telemetry", {})
    telemetry["task_node"] = {"latency": latency, "confidence": 0.9}

    return {"tasks": tasks, "current_phase": "task_generation", "telemetry": telemetry}

def reviewer_node(state: AgentState):
    print("--- QA REVIEWER ---")
    current_iterations = state.get("qa_iterations", 0)
    
    # QA Token Optimization: Hard limit to 2 rejection loops
    if current_iterations >= 2:
        print("QA Loop Limit Reached. Forcing Approval to save tokens.")
        return {
            "current_phase": "completed", 
            "latest_message": "Workflow Complete! QA Limit reached, bypassing strict checks.",
            "qa_iterations": current_iterations + 1
        }
        
    prompt = REVIEWER_PROMPT.format(
        stories=state.get("stories", ""),
        tasks=state.get("tasks", "")
    )
    time.sleep(1)
    response = invoke_with_rotation([HumanMessage(content=prompt)])
    content = response.content.strip()
    
    if "APPROVE" in content:
        return {
            "current_phase": "completed", 
            "latest_message": "Workflow Complete! QA Passed and Documentation generated.",
            "qa_iterations": current_iterations + 1
        }
    else:
        print("QA Failed. Returning to Task Agent.")
        return {
            "review_feedback": content, 
            "current_phase": "task_revision",
            "qa_iterations": current_iterations + 1
        }

# ROUTING FUNCTIONS
def route_after_sufficiency(state: AgentState):
    if state.get("is_sufficient", False):
        return "context_synthesizer_node"
    return "clarification_node"

def route_after_clarification(state: AgentState):
    content = state.get("latest_message", "")
    if "Context Sufficient" in content:
        return "context_synthesizer_node"
    return END

def route_after_reviewer(state: AgentState):
    if state.get("current_phase") == "completed":
        return END
    return "task_node"

def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("sufficiency_node", sufficiency_node)
    workflow.add_node("clarification_node", clarification_node)
    workflow.add_node("context_synthesizer_node", context_synthesizer_node)
    workflow.add_node("market_scout_node", market_scout_node)  # NEW
    workflow.add_node("requirement_node", requirement_node)
    workflow.add_node("pm_node", pm_node)
    workflow.add_node("scrum_node", scrum_node)
    workflow.add_node("task_node", task_node)
    workflow.add_node("reviewer_node", reviewer_node)
    
    workflow.add_edge(START, "sufficiency_node")
    
    workflow.add_conditional_edges(
        "sufficiency_node",
        route_after_sufficiency,
        {
            "context_synthesizer_node": "context_synthesizer_node",
            "clarification_node": "clarification_node"
        }
    )
    
    workflow.add_conditional_edges(
        "clarification_node",
        route_after_clarification,
        {
            "context_synthesizer_node": "context_synthesizer_node",
            END: END
        }
    )
    
    # After context synthesis → Market Scout → Requirements (pause handled by interrupt_before)
    workflow.add_edge("context_synthesizer_node", "market_scout_node")
    workflow.add_edge("market_scout_node", "requirement_node")

    workflow.add_edge("requirement_node", "pm_node")
    workflow.add_edge("pm_node", "scrum_node")
    workflow.add_edge("scrum_node", "task_node")
    workflow.add_edge("task_node", "reviewer_node")

    workflow.add_conditional_edges(
        "reviewer_node",
        route_after_reviewer,
        {
            "task_node": "task_node",
            END: END
        }
    )
    
    return workflow

agent_app = build_graph()
