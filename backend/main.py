import json
import os
from fastapi import FastAPI, Response, WebSocket, WebSocketDisconnect
from backend.models import ChatRequest, ChatResponse
from agents.master_agent import agent_app as uncompiled_app
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.runnables import RunnableConfig

app = FastAPI(title="AI Multi-Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/workflow_graph.png")
async def get_workflow_graph_png():
    try:
        png_data = uncompiled_app.compile().get_graph().draw_mermaid_png()
        return Response(content=png_data, media_type="image/png")
    except Exception as e:
        return Response(content=str(e), status_code=500)

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    pass

@app.websocket("/ws/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    await websocket.accept()
    config = {"configurable": {"thread_id": thread_id}}
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "checkpoints.sqlite")
    
    try:
        async with AsyncSqliteSaver.from_conn_string(db_path) as memory:
            agent_app = uncompiled_app.compile(checkpointer=memory, interrupt_before=["requirement_node", "scrum_node"])
            
            while True:
                data = await websocket.receive_text()
                payload = json.loads(data)
                user_input = payload.get("user_input", "")
                action = payload.get("action", "chat")  # "chat", "resume", "feature_select"
                
                current_state = await agent_app.aget_state(config)
                
                # ── Handle HITL Resume (scrum_node interrupt) ─────────────────
                if action == "resume":
                    await websocket.send_json({"type": "status", "message": "Resuming from interrupt..."})
                    async for event in agent_app.astream(None, config, stream_mode="updates"):
                        await websocket.send_json({"type": "node_update", "data": event})
                    continue
                
                # ── Handle Market Scout Feature Selection ─────────────────────
                if action == "feature_select":
                    selected_features = payload.get("selected_features", [])
                    await websocket.send_json({
                        "type": "status", 
                        "message": f"Proceeding with {len(selected_features)} selected features..."
                    })
                    # Inject selected features, then resume execution from requirement_node
                    await agent_app.aupdate_state(
                        config,
                        {"preferred_features": selected_features}
                    )
                    # astream(None) resumes from the interrupt point (requirement_node)
                    async for event in agent_app.astream(None, config, stream_mode="updates"):
                        await websocket.send_json({"type": "node_update", "data": event})
                    # After resume, re-check for HITL pause (scrum_node)
                    final_state_after = await agent_app.aget_state(config)
                    if final_state_after.next:
                        await websocket.send_json({
                            "type": "interrupt",
                            "message": f"Graph paused before: {final_state_after.next[0]}. Waiting for Review."
                        })
                    continue
                
                # ── Standard Chat ─────────────────────────────────────────────
                input_dict = {}
                if not current_state.values:
                    # First turn — include user_id (use thread_id as proxy for now)
                    input_dict = {
                        "initial_idea": user_input,
                        "user_id": thread_id,
                        "user_answers": {},
                        "clarification_questions": [],
                        "preferred_features": [],
                        "awaiting_feature_selection": False,
                        "qa_iterations": 0
                    }
                else:
                    state_values = current_state.values
                    latest_question = state_values.get("latest_message", "")
                    answers = state_values.get("user_answers", {})
                    
                    if latest_question and "Context Sufficient" not in latest_question and "Workflow Complete" not in latest_question:
                        answers = answers.copy()
                        answers[latest_question] = user_input
                        
                    input_dict = {"user_answers": answers}
                
                # Stream graph execution events
                async for event in agent_app.astream(input_dict, config, stream_mode="updates"):
                    await websocket.send_json({"type": "node_update", "data": event})
                
                # Check for interrupt (HITL or Market Scout)
                final_state = await agent_app.aget_state(config)
                
                if final_state.next:
                    next_node = final_state.next[0]
                    state_vals = final_state.values
                    
                    # Market Scout pause — before requirement_node with market_research data
                    if next_node == "requirement_node" and state_vals.get("market_research"):
                        market_data = state_vals.get("market_research", {})
                        await websocket.send_json({
                            "type": "market_research",
                            "data": market_data
                        })
                    else:
                        # Normal HITL pause (before scrum_node)
                        await websocket.send_json({
                            "type": "interrupt",
                            "message": f"Graph paused before: {next_node}. Waiting for Review."
                        })

    except WebSocketDisconnect:
        print(f"Client disconnected: {thread_id}")
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})

@app.get("/history/{thread_id}")
async def get_history(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    history = []
    
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "checkpoints.sqlite")
    async with AsyncSqliteSaver.from_conn_string(db_path) as memory:
        agent_app = uncompiled_app.compile(checkpointer=memory)
        async for state in agent_app.aget_state_history(config):
            history.append({
                "config": state.config,
                "values": state.values,
                "next_nodes": state.next
            })
            
    return {"history": history}
