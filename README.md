<div align="center">

# 🤖 GAIA — AI Agent Office

### *Generative AI Infrastructure for Agile*

**A multi-agent LangGraph system that transforms a raw product idea into a complete, review-ready PRD, Epic, Story, and Task breakdown — orchestrated by specialized AI agents with a real-time RTS-style War Room UI.**

[![MIT License](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://python.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent-purple.svg)](https://langchain-ai.github.io/langgraph/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_15-black.svg)](https://nextjs.org)

</div>

---

## 📋 Table of Contents

- [System Overview](#-system-overview)
- [System Architecture](#-system-architecture)
- [Agent Design](#-agent-design)
- [Prompt Design](#-prompt-design)
- [Workflow Explanation](#-workflow-explanation)
- [Bonus Features](#-bonus-features)
- [AI Tools Used](#-ai-tools-used)
- [Setup Instructions](#-setup-instructions)
- [Example Run](#-example-run)

---

## 🌐 System Overview

GAIA is a **multi-agent AI orchestration system** that takes a single user idea (e.g. *"I want to build a marketplace for freelancers"*) and autonomously delegates work across 10 specialized agents to produce a full software planning suite:

- ✅ Project Brief
- ✅ Product Requirements Document (PRD)
- ✅ Agile Epics & User Stories (with Acceptance Criteria)
- ✅ Developer Task Breakdown
- ✅ QA-reviewed and self-correcting output

All agents are visualized in a **real-time RTS-style "AI War Room"** UI with live status updates, thought bubbles, and agent animations.

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          GAIA System Architecture                        │
│                                                                         │
│  ┌──────────┐     WebSocket      ┌─────────────────────────────────────┐│
│  │ Next.js  │ ◄───────────────── │ FastAPI + LangGraph Backend          ││
│  │ War Room │ ──────────────────►│                                      ││
│  │   UI     │   JSON events      │  ┌─────────────────────────────────┐ ││
│  └──────────┘                    │  │     LangGraph StateGraph         │ ││
│                                  │  │                                  │ ││
│  Components:                     │  │  sufficiency → clarification     │ ││
│  ├─ WarRoomMap (SVG graph)       │  │       ↓                          │ ││
│  ├─ Agent Pods (animated)        │  │  context_synthesizer             │ ││
│  ├─ System Logs Terminal         │  │       ↓                          │ ││
│  ├─ MarketScoutModal             │  │  market_scout ──► [HITL pause]   │ ││
│  └─ DocumentHub (Artifacts)      │  │       ↓                          │ ││
│                                  │  │  requirement → pm → scrum        │ ││
│                                  │  │       ↓         [HITL pause]     │ ││
│                                  │  │  task_node ◄──── reviewer_node   │ ││
│                                  │  │       └──────────────────────────┘ ││
│                                  │  └─────────────────────────────────┘ ││
│                                  │                                      ││
│                                  │  Memory Layer:                       ││
│                                  │  ├─ SQLite (session checkpoints)     ││
│                                  │  ├─ FAISS (RAG project memory)       ││
│                                  │  └─ Mem0 (user preferences)          ││
│                                  └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Tech Stack:**

| Layer | Technology |
|---|---|
| **AI Framework** | LangGraph (StateGraph), LangChain |
| **LLM Provider** | Groq (llama-3.3-70b-versatile, llama-3.1-8b-instant) |
| **Web Search** | Tavily API |
| **RAG Memory** | FAISS + HuggingFace sentence-transformers |
| **Agent Memory** | Mem0 (local mode) |
| **Backend** | FastAPI + WebSockets |
| **Session Memory** | LangGraph SQLite Checkpointer |
| **Frontend** | Next.js 15 + Framer Motion + Tailwind CSS |

---

## 🤖 Agent Design

The system uses **10 specialized agents**, each with a single, well-defined responsibility:

| Agent | Node ID | Model | Role |
|---|---|---|---|
| 🔒 **Gatekeeper** | `sufficiency_node` | llama-3.1-8b | Scores information density (0.0–1.0). Routes to Clarifier if score < 0.7 |
| 💬 **Clarifier** | `clarification_node` | llama-3.3-70b | Business Analyst. Asks probing questions using Negative Constraint analysis |
| 🔮 **Oracle** | `context_synthesizer_node` | llama-3.3-70b | Synthesizes all Q&A into a structured System Context document |
| 🕵️ **Market Scout** | `market_scout_node` | llama-3.3-70b | Searches the web (Tavily) for competitors, extracts features, proposes differentiators |
| 📝 **Scribe** | `requirement_node` | llama-3.3-70b | Creates the Project Brief using strict anti-hallucination templates |
| 📊 **Strategist** | `pm_node` | llama-3.3-70b | Generates the full PRD from the Project Brief |
| 🏗 **Architect** | `scrum_node` | llama-3.3-70b | Breaks PRD into Epics & User Stories with Acceptance Criteria |
| 🔨 **Builder** | `task_node` | llama-3.3-70b | Translates stories into actionable developer tasks |
| ✅ **Auditor** | `reviewer_node` | llama-3.3-70b | QA review gate: approves or sends feedback back to Builder (max 2 loops) |
| 🗄 **Archivist** | `archivist` (UI only) | — | Saves all artifacts to `docs/` on workflow completion |

### Master Orchestrator

The **LangGraph StateGraph** acts as the Master Orchestrator. It:
- Maintains a typed `AgentState` shared across all agents
- Routes conditionally based on state fields (e.g. `is_sufficient`, `current_phase`)
- Implements **Human-in-the-Loop (HITL)** checkpoints via `interrupt_before`
- Persists session state to SQLite for resumable workflows

---

## 🎨 Prompt Design

All prompts follow a **role → context → policy → template** structure:

### Anti-Hallucination Policy
Every generation prompt includes:
```
STRICT ANTI-HALLUCINATION POLICY: Do not invent features, integrations, or 
requirements not explicitly discussed in the Context. If missing, make the 
most logical minimal assumption and note it.
```

### Sufficiency Scorer (JSON-mode, 8b model)
Structured JSON output with `score`, `is_sufficient`, `reasoning`. Uses the lightweight 8b model to minimize token spend on classification tasks.

### Clarification Agent (Negative Constraints)
Explicitly instructed to identify **what is NOT there** — target audience gaps, missing monetization strategy, unspecified technical requirements — rather than asking about what's already known.

### Context Synthesizer
Produces a single structured Markdown "System Context" that becomes the ground truth for all downstream agents, preventing context drift.

### Template-Enforced Outputs
`REQUIREMENT_AGENT`, `PM_AGENT`, `SCRUM_AGENT`, and `TASK_AGENT` all render outputs against **predefined Markdown templates** (in `agents/templates.py`), ensuring consistent artifact structure.

---

## 🔄 Workflow Explanation

Loom Video : https://www.loom.com/share/8ed17b0ec0dd481d8dac5cb29f351683

```
User submits idea
        │
        ▼
[Gatekeeper] ──score < 0.7──► [Clarifier] ──► waits for user answer
        │                          │
   score ≥ 0.7                returns to Gatekeeper
        │
        ▼
[Oracle / Context Synthesizer]
        │
        ▼
[Market Scout] ──► Tavily web search ──► LLM extracts competitors + features
        │
        ▼ interrupt_before: requirement_node
── PAUSE ── MarketScoutModal opens in UI ──► user selects preferred features
        │
[user clicks Proceed]
        │
        ▼
[Scribe / Requirement Agent] ──► project_brief.md (+ RAG indexed)
        │
        ▼
[Strategist / PM Agent] ──► prd.md (+ RAG indexed)
        │
        ▼ interrupt_before: scrum_node
── HUMAN REVIEW PAUSE ── DocumentHub opens ──► user reviews & approves
        │
[user clicks Resume]
        │
        ▼
[Architect / Scrum Agent] ──► epics.md + stories.md
        │
        ▼
[Builder / Task Agent] ──► tasks.md
        │
        ▼
[Auditor / QA Reviewer]
        │
    APPROVE ──────────────────────► Workflow Complete! Artifacts saved.
        │
    REJECT (max 2x) ──────────────► [Builder] re-drafts with feedback
```

**Key design properties:**
- **Zero hallucination** — each agent only sees the output of the previous agent
- **Resumable** — SQLite checkpointer persists state; users can refresh and continue
- **Self-correcting** — QA loop catches gaps in task coverage (max 2 iterations to save tokens)
- **Human-in-the-loop** — two natural pause points for human oversight

---

## ⭐ Bonus Features

| Feature | Implementation | Details |
|---|---|---|
| **Visual Workflow Graph** | `WarRoomMap.tsx` | Real-time RTS-style animated agent map with live status, thought bubbles, and arrow connections |
| **RAG Knowledge Retrieval** | `agents/rag_memory.py` | FAISS + HuggingFace embeddings index every generated brief/PRD; future projects get relevant past context |
| **Memory System (Session)** | LangGraph SQLite Checkpointer | Full thread resumption across disconnects |
| **Memory System (Personalized)** | `agents/mem0_memory.py` | Mem0 stores user preferences (tech stack, budget, etc.) across sessions |
| **Document Versioning** | QA loop counter in state | Each QA rejection bumps `qa_iterations`; artifacts are overwritten with improved versions |
| **Agent Debugging Logs** | `telemetry` dict in state | Each node records `latency` and `confidence`; visible in the War Room HUD |
| **Market Scout Agent** | `agents/market_scout.py` | Tavily web search → competitor analysis → feature checkbox selection UI |
| **Groq Key Rotation** | `invoke_with_rotation()` | Automatic fallback across 3 API keys on 429 rate limit errors |
| **Human-in-the-Loop (HITL)** | `interrupt_before` in LangGraph | Two review checkpoints with dedicated UI panels |

---

## 🛠 AI Tools Used

| Tool | Purpose | How It Helped |
|---|---|---|
| **Google Gemini (Antigravity)** | Agentic development assistant | Designed system architecture, wrote all agent code, built the Next.js War Room UI, debugged WebSocket flows, and iteratively refined the LangGraph pipeline based on live test results |
| **Groq + Llama 3** | LLM runtime | Provided fast, low-latency inference for all 9 LLM-powered agent nodes |
| **Tavily** | Web search API | Powers the Market Scout Agent's competitor research |

The AI assistant was used throughout the development cycle for: architecture planning, code generation, bug diagnosis, prompt engineering, and UI design. All architecture decisions, agent role definitions, and prompt structures were reviewed and refined through iterative human-AI collaboration.

---

## ⚙️ Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Groq API Key](https://console.groq.com) (free tier: 100k tokens/day)
- A [Tavily API Key](https://tavily.com) (free tier: 1000 searches/month)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/GAIA.git
cd GAIA
```

### 2. Backend Setup
```bash
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_primary_groq_key
GROQ_API_KEY_2=your_backup_groq_key        # optional, for key rotation
TAVILY_API_KEY=your_tavily_key
```

### 4. Frontend Setup
```bash
cd frontend_next
npm install
```

### 5. Run the Application
**Terminal 1 — Backend:**
```bash
uvicorn backend.main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend_next
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** The FAISS (`rag_index/`) and Mem0 (`mem0_db/`) memory stores are created automatically on first run.

---

## 🚀 Example Run

1. **Open the AI War Room** at `http://localhost:3000`

2. **Submit your idea** in the terminal at the bottom:
   ```
   I want to build a marketplace for freelancers.
   ```

3. **Gatekeeper evaluates** → scores information density → routes to **Clarifier**

4. **Clarifier asks** 3–5 targeted questions about target audience, monetization, tech stack, etc.

5. **Answer each question** — as you type responses, the agents animate and update in real-time

6. **Oracle synthesizes** everything into a structured System Context

7. **Market Scout searches** the web → finds Upwork, Fiverr, Toptal → proposes differentiating features

8. **Feature Selection Modal** pops up → tick the features you want → click **Proceed**

9. **Scribe, Strategist, Architect, Builder** each run sequentially — watch them activate in the War Room

10. **HITL Review** — the Architect pauses and opens the **Artifacts Vault** for your review

11. **Resume** → Builder generates tasks → **Auditor** reviews → approves (or loops back once/twice)

12. **Workflow Complete!** — Artifacts Vault auto-opens with:
    - `project_brief.md`
    - `prd.md`
    - `epics.md` / `stories.md`
    - `tasks.md`

All artifacts are also saved to the `docs/` directory.

---

## 📁 Project Structure

```
GAIA/
├── agents/
│   ├── state.py            # LangGraph AgentState TypedDict
│   ├── master_agent.py     # LangGraph StateGraph + all agent nodes
│   ├── prompts.py          # All LLM prompt templates
│   ├── templates.py        # Markdown output templates
│   ├── market_scout.py     # Market Scout agent (Tavily web search)
│   ├── rag_memory.py       # FAISS RAG memory module
│   ├── mem0_memory.py      # Mem0 personalized memory module
│   └── utils.py            # Artifact save utility
├── backend/
│   ├── main.py             # FastAPI app + WebSocket endpoint
│   └── models.py           # Pydantic request/response models
├── frontend_next/          # Next.js 15 frontend
│   └── src/
│       ├── app/
│       │   └── page.tsx    # Main page + WebSocket client
│       └── components/
│           ├── WarRoomMap.tsx       # RTS-style agent visualization
│           ├── MarketScoutModal.tsx # Competitor analysis + feature selection
│           └── DocumentHub.tsx      # Artifacts viewer
├── docs/                   # Generated project artifacts (sample output)
├── requirements.txt        # Python dependencies
├── .gitignore
└── LICENSE                 # MIT
```
