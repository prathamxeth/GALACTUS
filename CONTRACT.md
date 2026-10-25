# MEMORAG — Authoritative Backend API Contract

**Product Name:** MEMORAG  
**Hackathon:** Ragnarok Sovereign AI Agent  
**Role:** Member 1 — Agent Architect & Backend Lead  
**Specification Version:** 1.0.0 (OAS 3.1)  
**Host & Port:** `http://127.0.0.1:8000` (Local loopback only)  
**Local Inference Engine:** Ollama (`http://127.0.0.1:11434`, default model `gemma4:e2b`)  
**Zero-Telemetry Guarantee:** Strictly zero outbound external traffic; local loopback execution only.

---

## 1. System Health & Agent Status

### `GET /health` & `GET /api/health`
- **Purpose:** Fast liveness probe for reverse proxies, Docker, and frontend status bars.
- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy"
  }
  ```

### `GET /api/agent/status`
- **Purpose:** Comprehensive sovereign agent runtime status for Member 3's Command Center.
- **Request:** None
- **Response `200 OK`:**
  ```json
  {
    "status": "healthy",
    "service": "MEMORAG / GALACTUS Sovereign Agent",
    "product": "MEMORAG",
    "ollama": "connected",
    "model": "gemma4:e2b",
    "memory_vault": "active_encrypted"
  }
  ```

### `GET /`
- **Purpose:** Root metadata endpoint with CORS and documentation references.
- **Response `200 OK`:**
  ```json
  {
    "service": "MEMORAG / GALACTUS Sovereign Agent Orchestrator",
    "product": "MEMORAG",
    "hackathon": "Ragnarok Sovereign Agent",
    "version": "1.0.0",
    "status": "online",
    "model": "gemma4:e2b",
    "telemetry": "Zero outbound telemetry (Local-First)",
    "cors_origins": ["http://localhost:5173", "http://localhost:3000", "*"],
    "docs_url": "/docs"
  }
  ```

---

## 2. Command Center & Chat Handshake

### `POST /api/agent/chat`
- **Purpose:** Operator prompt ingress. Performs context retrieval with Member 2's vault, classifies intention, and synthesizes task DAG or conversational response.
- **Request:**
  ```json
  {
    "prompt": "Create an automated database backup script and verify files",
    "mode": "task"
  }
  ```
  *(Mode options: `"chat"`, `"task"`, `"memory"`)*
- **Response `200 OK`:**
  ```json
  {
    "id": "msg-a81f3b20",
    "role": "agent",
    "content": "Acknowledged. Synthesized execution DAG with 3 steps (Plan source: deterministic_fallback). Started task task-9c41d08e.",
    "timestamp": "2026-10-25T18:30:00.000Z",
    "thoughtTrace": "Queried memory context (2 items retrieved). Evaluated risk levels with local model gemma4:e2b.",
    "citedMemoryIds": ["mem-01", "mem-02"],
    "relatedTaskId": "task-9c41d08e"
  }
  ```

---

## 3. Autonomous Task Planning & DAG Execution

### `POST /api/tasks`
- **Purpose:** Deconstructs user instruction into a Directed Acyclic Graph (DAG) incorporating verified facts and user preferences via `query_relevant_context()`.
- **Request:**
  ```json
  {
    "goal": "Audit project permissions and deploy contract",
    "priority": "normal"
  }
  ```
- **Response `201 Created` (`TaskDAG`):**
  ```json
  {
    "task_id": "task-b7a48d12",
    "goal": "Audit project permissions and deploy contract",
    "model": "gemma4:e2b",
    "plan_source": "deterministic_fallback",
    "status": "PENDING",
    "created_at": "2026-10-25T18:30:00.000Z",
    "updated_at": "2026-10-25T18:30:00.000Z",
    "steps": [
      {
        "step_id": "step-01",
        "step_number": 1,
        "title": "Analyze Task Goal & Constraints",
        "skill_name": "system.analyze",
        "parameters": {},
        "dependencies": [],
        "risk_level": "LOW",
        "requires_approval": false,
        "status": "PENDING",
        "output": null,
        "approval_id": null
      },
      {
        "step_id": "step-02",
        "step_number": 2,
        "title": "Deploy Updated Contracts",
        "skill_name": "developer.deploy",
        "parameters": {"network": "local"},
        "dependencies": ["step-01"],
        "risk_level": "HIGH",
        "requires_approval": true,
        "status": "PENDING",
        "output": null,
        "approval_id": null
      }
    ]
  }
  ```

### `GET /api/tasks`
- **Purpose:** Returns list of all active, paused, completed, and failed task DAGs.
- **Response `200 OK`:** `List[TaskDAG]`

### `GET /api/tasks/{task_id}`
- **Purpose:** Fetches current state, step outputs, and approval checkpoints for a specific task.
- **Response `200 OK`:** `TaskDAG`
- **Error `404 Not Found`:** If `task_id` does not exist.

---

## 4. Real-Time Telemetry via Server-Sent Events (SSE)

### `GET /api/tasks/{task_id}/events/stream`
- **Response Headers:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no`
- **Event Types Emitted:**
  1. `task_connected`: Emitted upon connection with initial task snapshot.
     ```
     event: task_connected
     data: {"task_id": "task-b7a48d12", "status": "RUNNING", "goal": "...", "step_count": 3}
     ```
  2. `task_status`: Current task execution state.
  3. `step_progress`: Step transition (`RUNNING`).
  4. `approval_required`: Emitted when high-risk step transitions to `PAUSED_APPROVAL`.
     ```
     event: approval_required
     data: {"task_id": "task-b7a48d12", "step_id": "step-02", "approval_id": "apr-c8172dfa", "title": "Deploy Contracts", "action": "developer.deploy", "risk_level": "HIGH", "parameters": {...}}
     ```
  5. `approval_granted`: Emitted when operator submits approval decision.
  6. `approval_rejected`: Emitted when operator rejects high-risk step.
  7. `step_completed`: Output and completion for a DAG step.
  8. `task_completed` / `task_failed`: Terminal execution events.
  9. `: ping\n\n`: Keep-alive heartbeat comments.

---

## 5. Zero-Trust Approval Gatekeeper

### `GET /api/approvals`
- **Purpose:** Lists all currently pending human approval requests.
- **Response `200 OK`:**
  ```json
  [
    {
      "approval_id": "apr-c8172dfa",
      "task_id": "task-b7a48d12",
      "step_id": "step-02",
      "title": "Deploy Contracts",
      "action": "developer.deploy",
      "risk_level": "HIGH",
      "parameters": {"network": "local"},
      "created_at": "2026-10-25T18:30:00.000Z"
    }
  ]
  ```

### `POST /api/approvals/{approval_id}`
- **Purpose:** Submits human authorization decision (`"approved"` or `"rejected"`).
- **Request:**
  ```json
  {
    "decision": "approved",
    "notes": "Verified by lead engineer"
  }
  ```
- **Response `200 OK` (Approved):**
  ```json
  {
    "success": true,
    "approval_id": "apr-c8172dfa",
    "status": "approved",
    "resumed_task_id": "task-b7a48d12",
    "step_id": "step-02",
    "task_status": "RUNNING"
  }
  ```
- **Response `200 OK` (Rejected):**
  ```json
  {
    "success": true,
    "approval_id": "apr-c8172dfa",
    "status": "rejected",
    "task_id": "task-b7a48d12",
    "step_id": "step-02",
    "task_status": "FAILED"
  }
  ```
- **Error `404 Not Found`:** If approval ID is unknown or already resolved.

### `POST /api/permissions/approve`
- **Purpose:** Front-end compatibility alias accepting `{ "approval_id": "...", "decision": "..." }` or `{ "requestId": "..." }`.

---

## 6. Skill Discovery

### `GET /api/skills`
- **Purpose:** Discover registered tools, capabilities, execution counts, risk levels, and schemas.
- **Response `200 OK`:**
  ```json
  [
    {
      "id": "skill-fs",
      "name": "filesystem.operations",
      "displayName": "Shielded Filesystem Controller",
      "description": "Read, inspect, and safely stage files inside approved project directories with atomic rollback safety.",
      "category": "filesystem",
      "isSandboxed": true,
      "requiresApproval": true,
      "riskLevel": "medium",
      "parameters": [
        {"name": "path", "type": "string", "description": "Target filesystem path", "required": true},
        {"name": "action", "type": "enum(read|write|list)", "description": "Operation type", "required": true}
      ],
      "executionCount": 142,
      "enabled": true
    },
    {
      "id": "skill-term",
      "name": "terminal.sandboxed_exec",
      "displayName": "Isolated Terminal Runner",
      "description": "Execute build tools, linters, and python scripts behind an isolated subprocess shield wall.",
      "category": "developer",
      "isSandboxed": true,
      "requiresApproval": true,
      "riskLevel": "high",
      "parameters": [
        {"name": "command", "type": "string", "description": "Command line string to evaluate", "required": true},
        {"name": "timeoutSec", "type": "number", "description": "Execution timeout limit", "required": false, "default": 30}
      ],
      "executionCount": 88,
      "enabled": true
    },
    {
      "id": "skill-mem",
      "name": "memory.recall_and_weave",
      "displayName": "Mimir Memory Engine",
      "description": "Query episodic saga logs and semantic knowledge nodes via local embeddings vector similarity.",
      "category": "system",
      "isSandboxed": true,
      "requiresApproval": false,
      "riskLevel": "low",
      "parameters": [
        {"name": "query", "type": "string", "description": "Semantic search text", "required": true},
        {"name": "type", "type": "enum(all|episodic|semantic)", "description": "Memory domain filter", "required": false}
      ],
      "executionCount": 512,
      "enabled": true
    }
  ]
  ```

---

## 7. Persistent Memory Vault & Handshake

### `GET /api/memory` & `GET /api/memories`
- **Purpose:** Search and inspect decrypted memory records in process memory with pagination.
- **Parameters:**
  - `query`: Keyword filter.
  - `type` / `memory_type`: `"episodic"` or `"semantic"`.
  - `limit`: Number of records (1 to 500).
- **Response `200 OK`:** List of decrypted memory records matching the respective frontend and backend formats.

### `POST /api/memory/events`
- **Purpose:** Stores an episodic event (user message, agent thought, tool execution).
- **Response `201 Created`:** `EpisodicEvent`

### `POST /api/memory/semantic`
- **Purpose:** Stores structured semantic fact or preference with deterministic SHA-256 deduplication.
- **Response `201 Created`:** `SemanticMemory`

### `DELETE /api/memory/{id}` & `DELETE /api/memories/{id}`
- **Purpose:** Deletes memory record. Soft deletion preserves tombstone for audits; hard deletion (`?hard=true`) cryptographically erases the ciphertext payload.
- **Response `200 OK`:** `{"success": true, "deleted_id": "...", "deletion_type": "soft"|"hard"}`

### `POST /api/memory/consolidate`
- **Purpose:** Triggers semantic consolidation engine to promote recurring episodic interactions into verified semantic facts.
- **Response `200 OK`:** `{"promoted_count": 1, "scanned_events": 15}`

---

## 8. Privacy & Configuration Settings

### `GET /api/settings/privacy`
- **Purpose:** Inspects sovereign execution parameters.
- **Response `200 OK`:**
  ```json
  {
    "localOnlyMode": true,
    "ollamaHost": "http://127.0.0.1:11434",
    "selectedModel": "gemma4:e2b",
    "databaseEncryption": true,
    "memoryAutoForgetting": false,
    "forgettingThresholdDays": 30,
    "maxCpuUsagePercent": 80,
    "rbacStrictApproval": true,
    "backgroundTriggersEnabled": true,
    "fastApiBackendUrl": "http://127.0.0.1:8000"
  }
  ```

### `PATCH /api/settings/privacy`
- **Purpose:** Updates local privacy options.
- **Request:** Partial JSON dictionary of settings.
- **Response `200 OK`:** Updated `PrivacySettings`.

---

## 9. MEMORAG Forge — Evidence-Based Diagnostics & Recovery

### `POST /api/diagnostics/analyze`
- **Purpose:** Initiates local project diagnosis. Inspects project root, toolchains, git status, and executes constrained read-only verification checks. Produces structured observed facts, correlated hypotheses, and an approval-gated minimal repair proposal.
- **Request:**
  ```json
  {
    "project_root": "/absolute/path/to/project",
    "user_request": "Find why project stopped building"
  }
  ```
- **Response `200 OK`:** `DiagnosticReport` (schema with `task_id`, `observed_facts`, `relevant_memory`, `hypotheses`, `proposed_repair`, `approval_requirements`, `recovery_options`, `status`)

### `GET /api/diagnostics/{task_id}`
- **Purpose:** Retrieves existing diagnostic task report and post-action verification state.
- **Response `200 OK`:** `DiagnosticReport`

### `POST /api/diagnostics/{task_id}/repair`
- **Purpose:** Applies human-approved repair patch inside project sandbox and reruns post-action verification checks. Rejects mismatched, stale, or expired approvals.
- **Request:**
  ```json
  {
    "approval_id": "apr-diag-12345678",
    "decision": "approved",
    "notes": "Verified safe syntax patch"
  }
  ```
- **Response `200 OK`:** `VerificationResult` (`passed`, `commands_executed`, `exit_codes`, `outputs`, `summary`)

### `POST /api/diagnostics/{task_id}/recover`
- **Purpose:** Triggers safe rollback recovery to restore pre-repair backup if verification failed.
- **Response `200 OK`:** `{"success": true, "restored_files": ["..."], "status": "RECOVERED"}`

### `GET /api/diagnostics/{task_id}/events`
- **Purpose:** Returns chronological durable Project Flight Recorder events emitted during the diagnostic task lifecycle.
- **Response `200 OK`:** `List[FlightRecorderEvent]`

### `GET /api/diagnostics/{task_id}/events/stream`
- **Purpose:** Real-time Server-Sent Events (SSE) stream (`media_type="text/event-stream"`) broadcasting diagnostic lifecycle events (`diagnostic_task_created`, `project_inspection_started`, `command_started`, `check_passed/failed`, `hypothesis_produced`, `repair_proposed`, `approval_requested/granted/rejected`, `repair_execution_started/completed`, `verification_completed`, `recovery_completed`).
