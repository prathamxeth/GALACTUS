# ⚡ MEMORAG
### Sovereign, Always-On Personal AI Agent
*Architecting Privacy-Preserving Autonomous Workflows with Persistent Memory on a Fully Local, Ollama-Based Stack.*

Official submission for the **Ragnarok Hackathon 2026** (Problem Statement 1).

---

## 🏛️ System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        MEMORAG COMMAND CENTER                          │
│     Next.js 16 (App Router) • TypeScript • Restrained Dark Theme       │
├────────────────────────────────────────────────────────────────────────┤
│  [ Command Center ]  [ Task Timeline ]  [ Memory Vault ]  [ Skills ]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON (127.0.0.1:8000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    FASTAPI ORCHESTRATOR (:8000)                        │
│  - Task Graph Planner (gemma4:e2b)  - Gjallarhorn Approval Gate (FR4.3)│
│  - Mimir Memory Vector Store (FR1)  - Dwarves' Forge Sandboxing (FR2)  │
│  - Heimdall Sentinel Daemons (FR4)  - Norns Forgetting Engine (FR1.3)  │
└───────────────────┬──────────────────────────────────┬─────────────────┘
                    │                                  │
                    ▼                                  ▼
      ┌───────────────────────────┐      ┌───────────────────────────┐
      │   LOCAL OLLAMA INFERENCE  │      │  ENCRYPTED VAULT AT REST  │
      │      (127.0.0.1:11434)    │      │  (AES-256-GCM / SQLCipher)│
      │   • gemma4:e2b (default)  │      │  • Episodic Saga Logs     │
      │   • nomic-embed-text      │      │  • Semantic Facts & Rules │
      └───────────────────────────┘      └───────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.12+
- Node.js 20+ and npm 10+
- Ollama running locally (`http://127.0.0.1:11434`) with model `gemma4:e2b`

### 2. Launch Backend (Port 8000)
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs)
- Health Check: [`http://127.0.0.1:8000/health`](http://127.0.0.1:8000/health)

### 3. Launch Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
The command center will be available at [`http://localhost:3000`](http://localhost:3000).

### Offline Staging Preview
If the FastAPI backend at `http://127.0.0.1:8000` is offline or starting up, the frontend automatically falls back to isolated demonstration fixtures with an honest, prominent status banner. You can inspect all screens, audit memory runes, and interact with approval gates without crashes.

---

## 📂 Repository Structure

- `backend/` — Member 1 Task Orchestrator, DAG Planner, and execution engine
- `app/` — Member 2 SQLite encrypted memory vault, crypto provider, and permission gateway
- `frontend/` — Member 3 Next.js 16 Command Center
- `tests/` — Full automated test suite (27 passing tests across all modules)
- `CONTRACT.md` — Canonical backend API contract and schema specification
- `HANDOFF.md` — Integration handoff document for Members 2 and 3

---

## 🛡️ Sovereign Invariants (NFR1 - NFR4)

- **Local Inference**: 100% of LLM tokens generated on localhost via Ollama (`gemma4:e2b`).
- **Zero Cloud Leak**: 0 KB outbound telemetry. No external API keys.
- **Encrypted Memory**: AES-256-GCM sealed memory store with user control and forgetting capabilities.
- **Human Approval Gates**: Granular RBAC ensuring high-risk actions cannot proceed without user consent.
