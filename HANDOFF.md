# MEMORAG — Integration Handoff for Member 2 and Member 3

**From:** Member 1 (Agent Architect & Backend Lead)  
**To:** Member 2 (Persistent Memory & Security Lead), Member 3 (Frontend Lead)  
**Product Title:** MEMORAG  
**Hackathon:** Ragnarok Sovereign Agent  
**Date:** October 25, 2026  
**Status:** All 27 Integration Tests Passing (100% Green)

---

## 1. Quick Reference: Canonical Endpoint Routing Matrix

| Resource / Capability | Canonical Endpoint | Method | Consumer | Key Notes / Schemas |
| :--- | :--- | :--- | :--- | :--- |
| **Liveness Check** | `/health` & `/api/health` | `GET` | M3 / Ingress | Returns `{"status": "healthy"}` |
| **Agent Status** | `/api/agent/status` | `GET` | M3 Command Bar | Returns status, model `gemma4:e2b`, ollama `connected` |
| **Root Metadata** | `/` | `GET` | All | Service name `MEMORAG / GALACTUS`, CORS list |
| **Command Center Chat** | `/api/agent/chat` | `POST` | M3 Chat Panel | Accepts `{ prompt, mode }`, returns `ChatMessage` with memory citations |
| **Task Creation & DAG** | `/api/tasks` | `POST` | M3 Tasks | Invokes M2 `query_relevant_context()`, synthesizes DAG (`TaskDAG`) |
| **Task List** | `/api/tasks` | `GET` | M3 Tasks | Lists active & finished `TaskDAG` records |
| **Task Details** | `/api/tasks/{task_id}` | `GET` | M3 Tasks | Step execution states, parameters, and outputs |
| **Real-Time Telemetry** | `/api/tasks/{task_id}/events/stream` | `GET` | M3 SSE Client | SSE stream (`text/event-stream`), keep-alive pings |
| **Pending Approvals** | `/api/approvals` | `GET` | M3 Approvals | Lists pending approvals (`PAUSED_APPROVAL` steps) |
| **Submit Approval** | `/api/approvals/{approval_id}` | `POST` | M3 Approvals | `{ decision: "approved" \| "rejected", notes?: string }` |
| **Approval Alias** | `/api/permissions/approve` | `POST` | M3 Approvals | `{ approval_id / requestId, decision }` |
| **Skill Discovery** | `/api/skills` | `GET` | M3 Skills Page | Returns registered skills, categories, and risk levels |
| **Memory Search (Plural)**| `/api/memories` | `GET` | M3 Memories | Returns frontend-compatible `MemoryRecord[]` |
| **Memory Delete (Plural)**| `/api/memories/{id}` | `DELETE`| M3 Memories | Soft/hard delete via M2 vault |
| **Memory Search (Singular)**| `/api/memory` | `GET` | M2 / Internal | Subsystem native `MemoryRecord[]` |
| **Episodic Event Ingress**| `/api/memory/events` | `POST` | M2 / Sagas | Stores episodic saga event with AES-256-GCM |
| **Semantic Fact Ingress**| `/api/memory/semantic` | `POST` | M2 / Knowledge| Stores semantic node with SHA-256 dedup |
| **Privacy Settings** | `/api/settings/privacy` | `GET`/`PATCH` | M3 Settings | Read and update local sovereign configuration |

---

## 2. Canonical Task Statuses & Step Lifecycles

The backend guarantees strict adherence to the following lifecycle states:

```
[ PENDING ] -> [ RUNNING ] -> [ PAUSED_APPROVAL ] (if step risk == HIGH)
                                    |                |
                          ("approved")        ("rejected")
                                    v                v
                               [ RUNNING ]      [ FAILED ]
                                    |
                                    v
                              [ COMPLETED ]
```

### Valid Task Status Values:
- `PENDING`: Initial state upon DAG synthesis.
- `RUNNING`: Actively advancing runnable steps.
- `PAUSED_APPROVAL`: Execution halted on a high-risk step awaiting human authorization.
- `COMPLETED`: All DAG steps executed successfully.
- `FAILED`: Aborted due to step error or operator rejection.

### Valid Step Status Values:
- `PENDING`: Waiting for prerequisites.
- `RUNNING`: Currently executing.
- `PAUSED_APPROVAL`: Awaiting human approval token.
- `COMPLETED`: Successfully executed with recorded output.
- `FAILED` / `REJECTED`: Aborted.

---

## 3. Real-Time SSE Stream Contract (`/api/tasks/{task_id}/events/stream`)

All events use standard SSE formatting (`event: <name>\ndata: <json>\n\n`).

1. `task_connected`:
   ```json
   {"task_id": "task-xxx", "status": "RUNNING", "goal": "...", "step_count": 3}
   ```
2. `task_status`:
   ```json
   {"task_id": "task-xxx", "status": "RUNNING"}
   ```
3. `step_progress`:
   ```json
   {"task_id": "task-xxx", "step_id": "step-xxx", "status": "RUNNING", "title": "..."}
   ```
4. `approval_required`:
   ```json
   {
     "task_id": "task-xxx",
     "step_id": "step-xxx",
     "approval_id": "apr-xxx",
     "title": "Write Configuration",
     "action": "filesystem.write_file",
     "risk_level": "HIGH",
     "parameters": {"path": "config.yaml"}
   }
   ```
5. `approval_granted`:
   ```json
   {"task_id": "task-xxx", "approval_id": "apr-xxx", "step_id": "step-xxx", "decision": "approved"}
   ```
6. `approval_rejected`:
   ```json
   {"task_id": "task-xxx", "approval_id": "apr-xxx", "step_id": "step-xxx", "notes": "..."}
   ```
7. `step_completed`:
   ```json
   {"task_id": "task-xxx", "step_id": "step-xxx", "status": "COMPLETED", "output": "..."}
   ```
8. `task_completed` / `task_failed`:
   ```json
   {"task_id": "task-xxx", "status": "COMPLETED"}
   ```

---

## 4. Handshake Specifications for Member 2 (Memory Subsystem)

- **Calling Convention:** The planner invokes `query_relevant_context(user_goal)` in `app/memory/service.py` before every DAG generation.
- **Expected Return Schema:**
  ```python
  {
      "user_goal": str,
      "verified_facts": List[Dict[str, Any]],
      "preferences": List[Dict[str, Any]],
      "constraints": List[Dict[str, Any]],
      "formatted_context": str
  }
  ```
- **Security Boundaries:**
  - Retrieved preferences and facts are injected into the system prompt passed to local Ollama (`gemma4:e2b`).
  - **Security Mandate:** User preferences or unverified memories **never** override security boundaries. High-risk actions (`filesystem.write_file`, `terminal.sandboxed_exec`, `delete`) unconditionally mandate human approval (`requires_approval=True`).

---

## 5. Handshake Specifications for Member 3 (Frontend / Command Center)

- **CORS Configured:** `http://localhost:3000` (Next.js), `http://localhost:5173` (Vite), and `*`.
- **Zero Direct Ollama Access:** All AI reasoning and planning routes exclusively through the FastAPI backend (`http://127.0.0.1:8000`). Direct browser requests to port 11434 are forbidden.
- **Offline / Staging Degradation:** When the backend is offline, frontend correctly displays `OfflineBanner` without uncaught crashes or unhandled hydration warnings.
- **Approvals:** Query pending approvals at `GET /api/approvals`, submit resolution at `POST /api/approvals/{approval_id}`.

---

## 6. Known Limitations & Safe Defaults

1. **Local Model Invariant:** Tested and validated on `gemma4:e2b` (5.1B, Q4_K_M). If Ollama is offline or unavailable, the backend gracefully falls back to deterministic rule-based DAG synthesis, explicitly flagged with `"plan_source": "deterministic_fallback"`.
2. **Encrypted Database:** Stored at `galactus_memory.db` (override via `GALACTUS_DB_PATH`). Always verify that user-held AES keys are loaded in process memory.
