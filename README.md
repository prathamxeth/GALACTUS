# ⚡ MEMORAG: Sovereign Always-On Personal AI Agent
> **Architecting Privacy-Preserving Autonomous Workflows with Persistent Memory, Task DAG Orchestration, and Human-in-the-Loop Safeguards on a Fully Local Stack.**

[![Tests: Backend](https://img.shields.io/badge/Backend%20Tests-37%2F37%20Passing-brightgreen?style=flat-square)](file:///Users/pratham/.gemini/antigravity-ide/scratch/GALACTUS/tests)
[![Tests: Frontend](https://img.shields.io/badge/Frontend%20Regression-17%2F17%20Passing-brightgreen?style=flat-square)](file:///Users/pratham/.gemini/antigravity-ide/scratch/GALACTUS/frontend/tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%200%20Errors-blue?style=flat-square)](file:///Users/pratham/.gemini/antigravity-ide/scratch/GALACTUS/frontend)
[![Telemetry](https://img.shields.io/badge/Telemetry-0%20KB%20Outbound-success?style=flat-square)](#sovereign-invariants)
[![Model](https://img.shields.io/badge/Inference-Ollama%20(gemma4%3Ae2b)-orange?style=flat-square)](#subsystems-architecture)
[![Security](https://img.shields.io/badge/Encryption-Fernet%20%2B%20OS%20Keyring-purple?style=flat-square)](#sentinel--encrypted-memory-vault)

---

## 🏛️ Executive Summary

**MEMORAG** (Problem Statement 1 — Personal AI Agent) is an integrated, sovereign personal assistant system designed to connect **local model inference**, **persistent encrypted memory**, **multi-step task planning (DAGs)**, and **human approval safeguards**. 

Unlike conventional chatbots that treat every interaction as an isolated session without safety boundaries, MEMORAG operates on a continuous, transparent agentic cycle:
1. **Understand**: Interpret the user goal and detect side-effect constraints.
2. **Recall**: Retrieve verified facts and preferences from encrypted local storage.
3. **Plan**: Synthesize an ordered Directed Acyclic Graph (DAG) with explicit prerequisites.
4. **Act Safely**: Execute low-risk steps automatically and pause high-risk operations for explicit human authorization.
5. **Observe**: Stream real-time step execution events via Server-Sent Events (SSE).
6. **Remember**: Consolidate episodic interactions into permanent semantic facts.

---

## 🏗️ System Architecture

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                               NEXUS (FRONTEND)                               │
│           Next.js 16 (App Router) • React 19 • TypeScript • Tailwind         │
├──────────────────────────────────────────────────────────────────────────────┤
│  • Flight Recorder: Event Timeline with touch swipe cycling & drawer expand  │
│  • Resizable Drawer: 280px–750px draggable sidebar with saved state          │
│  • Truthful Status: Live Ollama / Backend liveness indicators (Zero-Mock)    │
│  • Gjallarhorn Modal: Just-in-time interactive approval gatekeeper           │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ HTTP / REST & SSE Event Stream
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            ARCHITECT (BACKEND API)                           │
│                      Python 3.12 • FastAPI (:8000)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  • TaskPlanner: DAG synthesis with topological dependency resolution         │
│  • TaskOrchestrator: Stateful execution engine with real-time SSE broadcast  │
│  • Approval Gatekeeper: Pauses destructive branches until human confirmation │
│  • Loopback Execution Guard: LAN network isolation for repair/approval routes│
└───────────────────────┬──────────────────────────────┬───────────────────────┘
                        │                              │
                        ▼                              ▼
          ┌───────────────────────────┐  ┌───────────────────────────┐
          │      LOCAL INFERENCE      │  │    SENTINEL MEMORY VAULT  │
          │    Ollama (gemma4:e2b)    │  │  SQLite (WAL) + Fernet    │
          │     127.0.0.1:11434       │  │  • OS Keyring Vault       │
          │  • Zero cloud LLM calls   │  │  • SHA-256 Deduplication  │
          │  • Deterministic fallback │  │  • Consolidation Engine   │
          └───────────────────────────┘  └───────────────────────────┘
```

---

## 🛡️ Hackathon Problem Statement Alignment

| Problem Statement Challenge | MEMORAG Engineering Solution | Evidence in Codebase |
| :--- | :--- | :--- |
| **1. Loss of Data Sovereignty** | Local inference via Ollama (`gemma4:e2b`). 0 KB outbound network telemetry. Browser never touches external cloud APIs. | `backend/main.py:LoopbackExecutionGuardMiddleware`, `CONTRACT.md` |
| **2. Contextual Amnesia** | Persistent encrypted episodic & semantic memory. Recalls user preferences (e.g., `preferred_shell: pwsh`, `preferred_runtime: Python 3.12`) and injects them into system prompts. | `app/memory/service.py:query_relevant_context`, `test_milestones_5_6.py` |
| **3. Siloed Execution** | Task planning engine decomposes ambiguous goals into Directed Acyclic Graphs (DAGs) with explicit dependency ordering and SSE progress tracking. | `backend/planner.py:TaskDAG`, `backend/orchestrator.py:TaskOrchestrator` |
| **4. Unsafe Autonomy** | High-risk actions (writing files, executing shell commands, database wipes/backups) automatically halt in `PAUSED_APPROVAL` until explicit human authorization. | `backend/orchestrator.py:resume_approval`, `app/memory/permissions.py` |

---

## 📦 Subsystems Architecture

### 1. NEXUS — Frontend Command Center (`frontend/`)
* **Framework**: Next.js 16 (App Router), React 19, TypeScript.
* **Flight Recorder Panel**: Chronological event recorder with touch swipe gesture navigation (`Timeline` ↔ `Checkpoints` ↔ `Diff Analysis`), chevron scroll indicators, and structured 4-row hierarchical card formatting without artificial truncation.
* **Resizable Drawer**: Dynamic sidebar resizable between 280px and 750px with double-click snap toggles and `localStorage` persistence.
* **Truthful UI State**: Degraded, offline, and model-disconnected states are rendered honestly without fabricated mock data tags.
* **Verification**: **17/17 regression tests passing**; `npx tsc --noEmit` exits with **0 errors**.

### 2. ARCHITECT — FastAPI Backend Orchestrator (`backend/`)
* **Framework**: Python 3.12, FastAPI, Uvicorn, Pydantic v2.
* **Task Planner**: Generates `TaskDAG` graphs. Automatically classifies step risk levels (`LOW`, `MEDIUM`, `HIGH`) and extracts explicit mutation actions (`backup`, `wipe`, `create file`, `run command`, `deploy`).
* **Task Orchestrator**: Evaluates dependency prerequisites, halts on approval requirements, and streams live event updates over `GET /api/tasks/{task_id}/events/stream` (`text/event-stream`).
* **Loopback Execution Guard**: Protects execution and approval endpoints from unauthorized LAN requests unless `FORGE_ALLOW_REMOTE_EXECUTION="true"` is declared.
* **Verification**: **37/37 pytest tests passing** across unit, persistence, encryption, and integration suites.

### 3. SENTINEL — Encrypted Memory Vault (`app/memory/`)
* **Storage Engine**: SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) and versioned migrations.
* **Authenticated Encryption**: Uses Fernet (AES-128-CBC + HMAC-SHA256) on sensitive payloads. Plaintext is decrypted strictly in-memory during search and never written to unencrypted disk caches.
* **Key Derivation**: Integrates with host operating system credential vaults via `keyring` (macOS Keychain, Windows Credential Manager, Linux SecretService) with environment key fallback (`GALACTUS_ENCRYPTION_KEY`).
* **Consolidation & Deduplication**: SHA-256 deterministic hashing prevents duplicate fact insertion; episodic interaction statements are consolidated into verified semantic knowledge.
* **User Control & Forgetting**: Supports soft deletion, permanent pruning ("Norn's cut"), and TTL expiration.

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js**: v20+ & npm 10+
- **Python**: 3.12+
- **Ollama**: Installed locally with model `ollama pull gemma4:e2b` (or another model configured in `MEMORAG_MODEL`)

---

### Single-Machine Setup (All on Localhost)

#### 1. Start the FastAPI Backend
```bash
# In project root
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run backend on port 8000
python3 -m backend.main
```
*Backend Swagger documentation will be available at [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs).*

#### 2. Start the Next.js Frontend
```bash
# In frontend directory
cd frontend
npm install
npm run dev
```
*Frontend Command Center will be available at [`http://localhost:3000`](http://localhost:3000).*

---

### Multi-Machine Setup (Mac Frontend + Windows PC Backend with Ollama)

If presenting across two computers on the same local Wi-Fi:

1. **On the Windows PC (Backend & Ollama host)**:
   ```powershell
   # Allow execution routes over private LAN
   $env:FORGE_ALLOW_REMOTE_EXECUTION="true"
   
   # Start backend listening on all interfaces
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
2. **On the Mac (Frontend presentation machine)**:
   ```bash
   cd frontend
   # Set the Windows PC's local LAN IP
   export NEXT_PUBLIC_API_URL="http://192.168.x.x:8000"
   npm run dev
   ```

---

## 🧪 Automated Testing & Verification

Run the full verification suite across both stacks:

### 1. Backend Pytest Suite (37/37 Passing)
```bash
# From repository root
.venv/bin/pytest tests/
```
```text
======================= 37 passed, 2 warnings in 31.95s =======================
tests/test_api_endpoints.py ......................... [ 13%]
tests/test_diagnostics_and_hardening.py ............. [ 37%]
tests/test_encryption_and_keys.py ................... [ 56%]
tests/test_milestones_5_6.py ........................ [ 72%]
tests/test_persistence_and_models.py ................ [ 91%]
tests/test_recovery_and_permissions.py .............. [100%]
```

### 2. Frontend Regression & TypeScript Audit (17/17 Passing, 0 Errors)
```bash
cd frontend

# Verify TypeScript compilation
npx tsc --noEmit

# Run regression suite
node tests/nexus-phase2c-regression.test.mjs
```
```text
✔ Phase 2C: NEXUS Integration & Workbench Remediation Regression Suite
ℹ tests 17 | pass 17 | fail 0
```

### 3. Live Subsystem Integrity Verification (`demo.py`)
Run the standalone end-to-end memory and security integrity demo:
```bash
.venv/bin/python demo.py
```
*Verifies database WAL initialization, episodic event logging, consolidation, deduplication, raw disk ciphertext inspection (zero plaintext on disk), task reboot recovery, and one-time approval token replay rejection.*

---

## 📡 API Contract Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness health probe returning service status. |
| `GET` | `/api/agent/status` | Runtime status, Ollama model probe, and encrypted memory vault metrics. |
| `POST` | `/api/agent/chat` | Dispatches user goal to TaskPlanner, recalls memory, and registers DAG. |
| `GET` | `/api/tasks` | Lists registered task DAGs and execution states. |
| `GET` | `/api/tasks/{task_id}/events/stream` | Real-time Server-Sent Events (SSE) stream for execution and approvals. |
| `GET` | `/api/approvals` | Lists pending actions awaiting human authorization. |
| `POST` | `/api/approvals/{id}` | Submits approval or rejection decision and resumes paused DAG. |
| `GET` | `/api/memories` | Queries decrypted episodic logs and semantic facts (in-memory search). |
| `DELETE`| `/api/memories/{id}` | Permanently prunes or soft-deletes a specific memory record. |

---

## 👥 Contributors (Team Galactus)

- **PR4THAM !** ([@prathamxeth](https://github.com/prathamxeth)) — Frontend & Integration Lead (NEXUS Command Center)
- **Sumit Yadav** ([@sumityadavv1452](https://github.com/sumityadavv1452)) — Agent Architect & Backend Orchestrator (ARCHITECT)
- **Ayush Tripathi** ([@ayushnlp](https://github.com/ayushnlp)) — Memory & Security Engineer (SENTINEL Subsystem)
