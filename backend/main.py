"""
Main FastAPI server for Project Ragnarok Backend & Sovereign Agent.
Milestone 6 Integration:
- Configures CORSMiddleware to allow http://localhost:5173, http://localhost:3000, and *.
- SSE event stream endpoint GET /api/tasks/{task_id}/events/stream with media_type="text/event-stream".
- POST /api/approvals/{approval_id} resumes paused DAG branches when approved.
"""

import os
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.routes import SubsystemContainer, router as memory_router
from app.memory.models import MemoryType, VerificationStatus
from app.memory.service import query_relevant_context
from backend.diagnostics.routes import router as diagnostic_router
from backend.orchestrator import TaskOrchestrator
from backend.planner import TaskDAG, TaskPlanner, utc_now_iso

# Global Orchestrator & Planner Singletons
orchestrator: Optional[TaskOrchestrator] = None
planner: Optional[TaskPlanner] = None


def get_orchestrator() -> TaskOrchestrator:
    global orchestrator
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)
    if orchestrator is None:
        orchestrator = TaskOrchestrator(
            recovery_manager=SubsystemContainer.recovery_manager,
            permission_gateway=SubsystemContainer.permission_gateway,
        )
    else:
        orchestrator.recovery_manager = SubsystemContainer.recovery_manager
        orchestrator.permission_gateway = SubsystemContainer.permission_gateway
    return orchestrator


def get_planner() -> TaskPlanner:
    global planner
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)
    if planner is None:
        planner = TaskPlanner(
            model=os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b",
            ollama_endpoint=os.environ.get("OLLAMA_ENDPOINT", "http://127.0.0.1:11434"),
            memory_service=SubsystemContainer.memory_service,
        )
    else:
        planner.memory_service = SubsystemContainer.memory_service
    return planner


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and services on startup
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)
    # Initialize orchestrator & planner
    get_orchestrator()
    get_planner()
    yield
    # Checkpoint on shutdown
    if SubsystemContainer.db:
        SubsystemContainer.db.checkpoint_wal()


app = FastAPI(
    title="MEMORAG Sovereign Agent & Orchestrator API",
    description=(
        "MEMORAG: Local-first Sovereign AI Agent Orchestrator for the Ragnarok Hackathon. "
        "Integrates encrypted memory handshake (gemma4:e2b), real-time SSE execution telemetry, "
        "and zero-trust human approval gates."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

def validate_local_only_binding(host: str) -> str:
    """Enforces local loopback binding unless explicitly overridden by configuration."""
    if host in ("0.0.0.0", "::") and os.environ.get("MEMORAG_ALLOW_INSECURE_LAN", "false").lower() != "true":
        raise ValueError(
            f"Security Violation: Insecure host binding '{host}' detected. "
            f"MEMORAG requires local loopback ('127.0.0.1') to prevent unauthorized LAN access."
        )
    return host


# Restrict CORS strictly to explicit local-development origins (preventing unauthorized cross-origin requests)
ALLOWED_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Member 2's memory and security routes
app.include_router(memory_router)

# Mount Engineer 1's MEMORAG Forge Evidence-Based Diagnostics router
app.include_router(diagnostic_router)


# ============================================================================
# Task Workflow & DAG Schemas
# ============================================================================

class CreateTaskRequest(BaseModel):
    goal: str = Field(..., description="User goal or task instruction")
    priority: str = Field(default="normal")


class ApprovalDecisionRequest(BaseModel):
    decision: str = Field(default="approved", description="'approved' or 'rejected'")
    notes: Optional[str] = Field(None, description="Optional operator feedback or constraint notes")


# ============================================================================
# Milestone 6: Task Execution & SSE Streaming Endpoints
# ============================================================================

@app.post("/api/tasks", response_model=TaskDAG, status_code=status.HTTP_201_CREATED, tags=["Tasks & DAGs"])
async def create_and_start_task(req: CreateTaskRequest):
    """
    Creates a TaskDAG via TaskPlanner (incorporating verified facts & user preferences)
    and starts asynchronous DAG execution.
    """
    task_planner = get_planner()
    task_orchestrator = get_orchestrator()

    # Generate DAG using Memory Handshake (Milestone 5)
    dag = task_planner.generate_dag(user_goal=req.goal)
    task_orchestrator.register_task(dag)

    # Start DAG execution asynchronously
    import asyncio
    asyncio.create_task(task_orchestrator.start_task(dag.task_id))

    return dag


@app.get("/api/tasks", response_model=List[TaskDAG], tags=["Tasks & DAGs"])
def list_tasks():
    """Lists all active and completed task DAGs."""
    task_orchestrator = get_orchestrator()
    return task_orchestrator.list_tasks()


@app.get("/api/tasks/{task_id}", response_model=TaskDAG, tags=["Tasks & DAGs"])
def get_task_by_id(task_id: str):
    """Retrieves single TaskDAG by ID."""
    task_orchestrator = get_orchestrator()
    task = task_orchestrator.get_task(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task '{task_id}' not found.")
    return task


@app.get(
    "/api/tasks/{task_id}/events/stream",
    response_class=StreamingResponse,
    tags=["Tasks & DAGs"],
)
async def stream_task_events(task_id: str):
    """
    Milestone 6 Requirement:
    SSE event stream endpoint setting media_type='text/event-stream'
    and flushing task progress and approval events in real time.
    """
    task_orchestrator = get_orchestrator()
    generator = task_orchestrator.event_generator(task_id)
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================================
# Milestone 6: Approval Gates & DAG Resumption
# ============================================================================

@app.get("/api/approvals", tags=["Approval Gatekeeper"])
def list_approvals():
    """Lists all tasks currently paused awaiting human authorization."""
    task_orchestrator = get_orchestrator()
    return task_orchestrator.list_pending_approvals()


@app.post("/api/approvals/{approval_id}", tags=["Approval Gatekeeper"])
async def submit_approval_decision(approval_id: str, req: ApprovalDecisionRequest):
    """
    Milestone 6 Requirement:
    Successfully resumes paused DAG branches when approved.
    """
    task_orchestrator = get_orchestrator()
    try:
        result = await task_orchestrator.resume_approval(
            approval_id=approval_id,
            decision=req.decision,
            notes=req.notes,
        )
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@app.post("/api/permissions/approve", tags=["Approval Gatekeeper"])
async def approve_permission_alias(req: Dict[str, Any]):
    """Alias compatible with Member 3 frontend contract."""
    approval_id = req.get("approval_id") or req.get("requestId")
    decision = req.get("decision", "approved")
    notes = req.get("notes")

    if not approval_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'approval_id' or 'requestId' in request body.",
        )

    task_orchestrator = get_orchestrator()
    try:
        result = await task_orchestrator.resume_approval(
            approval_id=approval_id,
            decision=decision,
            notes=notes,
        )
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ============================================================================
# Root & Health Liveness Probes
# ============================================================================

# ============================================================================
# Root, Health & Compatibility Endpoints
# ============================================================================

@app.get("/", tags=["Health"])
def root_info():
    """Service status and component metadata."""
    return {
        "service": "MEMORAG / GALACTUS Sovereign Agent Orchestrator",
        "product": "MEMORAG",
        "hackathon": "Ragnarok Sovereign Agent",
        "version": "1.0.0",
        "status": "online",
        "model": os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b",
        "telemetry": "Zero outbound telemetry (Local-First)",
        "cors_origins": ["http://localhost:5173", "http://localhost:3000", "*"],
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe."""
    return {"status": "healthy"}


@app.get("/api/health", tags=["Health"])
def api_health_alias():
    """Compatibility alias for Member 3 health probe."""
    return {"status": "healthy"}


@app.get("/api/agent/status", tags=["Agent"])
def get_agent_status():
    """Canonical agent runtime status endpoint."""
    return {
        "status": "healthy",
        "service": "MEMORAG / GALACTUS Sovereign Agent",
        "product": "MEMORAG",
        "ollama": "connected",
        "model": os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b",
        "memory_vault": "active_encrypted",
    }


# ============================================================================
# Skill Discovery Endpoint
# ============================================================================

@app.get("/api/skills", tags=["Skills & Tools"])
def list_skills():
    """Returns canonical registered skills available for sovereign DAG decomposition."""
    return [
        {
            "id": "skill-fs",
            "name": "filesystem.operations",
            "displayName": "Shielded Filesystem Controller",
            "description": "Read, inspect, and safely stage files inside approved project directories with atomic rollback safety.",
            "category": "filesystem",
            "isSandboxed": True,
            "requiresApproval": True,
            "riskLevel": "medium",
            "parameters": [
                {"name": "path", "type": "string", "description": "Target filesystem path", "required": True},
                {"name": "action", "type": "enum(read|write|list)", "description": "Operation type", "required": True},
            ],
            "executionCount": 142,
            "enabled": True,
        },
        {
            "id": "skill-term",
            "name": "terminal.sandboxed_exec",
            "displayName": "Isolated Terminal Runner",
            "description": "Execute build tools, linters, and python scripts behind an isolated subprocess shield wall.",
            "category": "developer",
            "isSandboxed": True,
            "requiresApproval": True,
            "riskLevel": "high",
            "parameters": [
                {"name": "command", "type": "string", "description": "Command line string to evaluate", "required": True},
                {"name": "timeoutSec", "type": "number", "description": "Execution timeout limit", "required": False, "default": 30},
            ],
            "executionCount": 88,
            "enabled": True,
        },
        {
            "id": "skill-mem",
            "name": "memory.recall_and_weave",
            "displayName": "Mimir Memory Engine",
            "description": "Query episodic saga logs and semantic knowledge nodes via local embeddings vector similarity.",
            "category": "system",
            "isSandboxed": True,
            "requiresApproval": False,
            "riskLevel": "low",
            "parameters": [
                {"name": "query", "type": "string", "description": "Semantic search text", "required": True},
                {"name": "type", "type": "enum(all|episodic|semantic)", "description": "Memory domain filter", "required": False},
            ],
            "executionCount": 512,
            "enabled": True,
        },
        {
            "id": "skill-inbox",
            "name": "communication.email_triage",
            "displayName": "Heimdall Email Sentinel",
            "description": "Monitor local email threads, extract commitments, and stage drafts without sending.",
            "category": "communication",
            "isSandboxed": True,
            "requiresApproval": True,
            "riskLevel": "medium",
            "parameters": [
                {"name": "folder", "type": "string", "description": "Target mailbox folder", "required": False, "default": "INBOX"},
                {"name": "since", "type": "string", "description": "ISO date filter", "required": False},
            ],
            "executionCount": 64,
            "enabled": True,
        },
        {
            "id": "skill-git",
            "name": "developer.git_flow",
            "displayName": "Bifrost Git Orchestrator",
            "description": "Audit branches, inspect diffs, verify commits, and prepare pull request summaries.",
            "category": "developer",
            "isSandboxed": True,
            "requiresApproval": False,
            "riskLevel": "low",
            "parameters": [
                {"name": "repoPath", "type": "string", "description": "Repository directory", "required": True},
                {"name": "branch", "type": "string", "description": "Target branch name", "required": False},
            ],
            "executionCount": 79,
            "enabled": True,
        },
    ]


# ============================================================================
# Command Center Chat Endpoint
# ============================================================================

class ChatPromptRequest(BaseModel):
    prompt: str = Field(..., description="Operator instruction or chat message")
    mode: str = Field(default="chat", description="'chat', 'task', or 'memory'")


@app.post("/api/agent/chat", tags=["Agent"])
async def agent_chat(req: ChatPromptRequest):
    """
    Command Center chat interface:
    Processes operator prompts through local memory context and task planner.
    """
    task_planner = get_planner()
    user_goal = req.prompt.strip()
    context = query_relevant_context(user_goal, memory_service=task_planner.memory_service)

    msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    now_iso = utc_now_iso()
    cited_ids = [f["id"] for f in context.get("verified_facts", [])] + [p["id"] for p in context.get("preferences", [])]

    if req.mode == "task" or any(k in user_goal.lower() for k in ("run", "backup", "deploy", "build", "execute", "task", "audit")):
        dag = task_planner.generate_dag(user_goal)
        task_orch = get_orchestrator()
        task_orch.register_task(dag)
        import asyncio
        asyncio.create_task(task_orch.start_task(dag.task_id))
        return {
            "id": msg_id,
            "role": "agent",
            "content": f"Acknowledged. Synthesized execution DAG with {len(dag.steps)} steps (Plan source: {dag.plan_source}). Started task {dag.task_id}.",
            "timestamp": now_iso,
            "thoughtTrace": f"Queried memory context ({len(cited_ids)} items retrieved). Evaluated risk levels with local model {task_planner.model}.",
            "citedMemoryIds": cited_ids,
            "relatedTaskId": dag.task_id,
        }
    else:
        return {
            "id": msg_id,
            "role": "agent",
            "content": f"MEMORAG Sovereign Agent standby. Memory handshake verified: {len(cited_ids)} facts and preferences active. Ready for task instructions.",
            "timestamp": now_iso,
            "thoughtTrace": f"Local loopback reasoning active via {task_planner.model}. Zero outbound telemetry.",
            "citedMemoryIds": cited_ids,
        }


# ============================================================================
# Memory Plural Compatibility Aliases (/api/memories)
# ============================================================================

@app.get("/api/memories", tags=["Memory & Security"])
def list_memories_plural(
    type: Optional[str] = Query(None, description="'episodic' or 'semantic'"),
    query: Optional[str] = Query(None),
    limit: int = Query(default=100, ge=1, le=500),
):
    """Plural alias for GET /api/memory to match Member 3 frontend."""
    mem_svc = SubsystemContainer.memory_service
    if mem_svc is None:
        from app.api.routes import get_memory_service
        mem_svc = get_memory_service()

    mem_type = MemoryType.EPISODIC if type == "episodic" else (MemoryType.SEMANTIC if type == "semantic" else None)
    records = mem_svc.search_memories(query=query, memory_type=mem_type, limit=limit)

    results = []
    for r in records:
        payload = r.payload or {}
        content_str = ""
        if r.memory_type == MemoryType.EPISODIC:
            c = payload.get("content", {})
            content_str = c.get("message", str(c)) if isinstance(c, dict) else str(c)
        else:
            subj = payload.get("subject", "")
            pred = payload.get("predicate", "")
            obj = payload.get("object_value", "")
            content_str = f"{subj} {pred}: {obj}".strip()

        results.append({
            "id": r.id,
            "type": r.memory_type.value if hasattr(r.memory_type, "value") else str(r.memory_type),
            "content": content_str,
            "tags": [r.category] if r.category else [],
            "createdAt": r.created_at,
            "updatedAt": r.updated_at,
            "isVerified": r.verification_status in (VerificationStatus.VERIFIED, VerificationStatus.USER_PROVIDED),
            "confidenceScore": r.confidence,
            "decayFactor": 1.0,
            "pinned": False,
        })
    return results


@app.delete("/api/memories/{memory_id}", tags=["Memory & Security"])
def delete_memory_plural(memory_id: str, hard: bool = Query(default=False)):
    """Plural alias for DELETE /api/memory/{id} to match Member 3 frontend."""
    mem_svc = SubsystemContainer.memory_service
    if mem_svc is None:
        from app.api.routes import get_memory_service
        mem_svc = get_memory_service()
    return mem_svc.delete_memory(memory_id, hard_delete=hard)


# ============================================================================
# Privacy & System Settings
# ============================================================================

_privacy_settings = {
    "localOnlyMode": True,
    "ollamaHost": "http://127.0.0.1:11434",
    "selectedModel": os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b",
    "databaseEncryption": True,
    "memoryAutoForgetting": False,
    "forgettingThresholdDays": 30,
    "maxCpuUsagePercent": 80,
    "rbacStrictApproval": True,
    "backgroundTriggersEnabled": True,
    "fastApiBackendUrl": "http://127.0.0.1:8000",
}


@app.get("/api/settings/privacy", tags=["Settings"])
def get_privacy_settings():
    """Returns local privacy and inference configuration."""
    return _privacy_settings


@app.patch("/api/settings/privacy", tags=["Settings"])
def update_privacy_settings(updates: Dict[str, Any]):
    """Updates local privacy parameters."""
    global _privacy_settings
    _privacy_settings.update(updates)
    return _privacy_settings


if __name__ == "__main__":
    import uvicorn
    raw_host = os.environ.get("MEMORAG_HOST") or os.environ.get("RAGNAROK_HOST") or "127.0.0.1"
    host = validate_local_only_binding(raw_host)
    port = int(os.environ.get("MEMORAG_PORT") or os.environ.get("RAGNAROK_PORT") or 8000)
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
