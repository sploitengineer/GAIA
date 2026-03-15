from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    
    # User Context
    initial_idea: str
    user_id: str                       # For Mem0 personalized memory lookup
    clarification_questions: List[str]
    user_answers: Dict[str, str]
    
    # Master Orchestrator Tracking
    info_density_score: float
    is_sufficient: bool
    current_phase: str  # clarification, market_research, brief_generation, completed
    latest_message: str
    formatted_context: str
    review_feedback: str
    qa_iterations: int
    telemetry: Dict[str, Dict[str, float]]
    
    # Market Scout
    market_research: Dict[str, Any]    # competitor data + differentiating features
    preferred_features: List[str]      # user checkbox selections from Market Scout UI
    awaiting_feature_selection: bool   # True = pause for UI interaction
    
    # Generated Artifacts
    project_brief: str
    prd: str
    epics: str
    stories: str
    tasks: str
