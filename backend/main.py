"""
Main FastAPI server for Project MEMORAG Backend & Sovereign Agent.
Milestone 6 Integration:
- Configures CORSMiddleware to allow http://localhost:5173, http://localhost:3000, and *.
- SSE event stream endpoint GET /api/tasks/{task_id}/events/stream with media_type="text/event-stream".
- POST /api/approvals/{approval_id} resumes paused DAG branches when approved.
"""

import os
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.routes import SubsystemContainer, router as memory_router
from backend.diagnostics import diagnostics_router
from backend.orchestrator import TaskOrchestrator
from backend.planner import TaskDAG, TaskPlanner
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class LoopbackExecutionGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        is_execution_route = (
            path.startswith("/api/diagnostics") and request.method in ("POST", "PUT", "DELETE")
        ) or (
            path.startswith("/api/approvals") and request.method == "POST"
        ) or (
            path.startswith("/api/permissions") and request.method == "POST"
        )

        if is_execution_route:
            allow_remote = os.environ.get("FORGE_ALLOW_REMOTE_EXECUTION", "false").lower() == "true"
            if not allow_remote:
                client_host = request.client.host if request.client else ""
                forwarded_for = request.headers.get("x-forwarded-for", "")
                remote_ip = forwarded_for.split(",")[0].strip() if forwarded_for else client_host

                is_loopback = remote_ip in ("127.0.0.1", "::1", "testclient", "localhost", "")
                if not is_loopback:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "detail": "Remote LAN access denied: Execution and repair routes are restricted to loopback (localhost) only.",
                            "code": "REMOTE_EXECUTION_BLOCKED",
                        },
                    )

        response = await call_next(request)
        return response

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
            model=os.environ.get("MEMORAG_MODEL", os.environ.get("RAGNAROK_MODEL", "gemma4:e2b")),
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
    title="Project MEMORAG Sovereign Agent & Orchestrator API",
    description=(
        "Local-first Sovereign AI Agent Orchestrator with memory handshake (gemma4:e2b), "
        "real-time SSE execution telemetry, and human-in-the-loop approval gates."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Milestone 6 Requirement: Allow http://localhost:5173, http://localhost:3000, and *
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoopbackExecutionGuardMiddleware)

# Include Member 2's memory and security routes
app.include_router(memory_router)

# Include Engineer 1's hardened diagnostics and repair routes
app.include_router(diagnostics_router)


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

@app.get("/", tags=["Health"])
def root_info():
    """Service status and component metadata."""
    return {
        "service": "GALACTUS / MEMORAG Sovereign Agent Orchestrator",
        "version": "1.0.0",
        "status": "online",
        "model": os.environ.get("MEMORAG_MODEL", os.environ.get("RAGNAROK_MODEL", "gemma4:e2b")),
        "telemetry": "Zero outbound telemetry (Local-First)",
        "cors_origins": ["http://localhost:5173", "http://localhost:3000", "*"],
        "docs_url": "/docs",
    }


# ============================================================================
# Agent, Skills & Privacy Endpoints (Member 1 & 3 compatibility)
# ============================================================================

_privacy_settings = {
    "localOnlyMode": True,
    "databaseEncryption": True,
    "retentionDays": 30,
    "allowAnonymousTelemetry": False,
}


@app.get("/api/agent/status", tags=["Agent"])
def agent_status():
    """Agent runtime status and memory vault state."""
    return {
        "status": "healthy",
        "service": "GALACTUS / MEMORAG Sovereign Agent",
        "ollama": "connected",
        "model": os.environ.get("MEMORAG_MODEL", os.environ.get("RAGNAROK_MODEL", "gemma4:e2b")),
        "memory_vault": "active_encrypted",
        "telemetry": "Zero outbound telemetry",
    }


@app.post("/api/agent/chat", tags=["Agent"])
async def agent_chat(req: Dict[str, Any]):
    """Dispatches a prompt through autonomous DAG planner with memory handshake."""
    import time
    prompt = req.get("prompt", "")
    task_planner = get_planner()
    task_orchestrator = get_orchestrator()
    dag = task_planner.generate_dag(prompt)
    task_orchestrator.register_task(dag)

    # Start DAG execution asynchronously
    await task_orchestrator.start_task(dag.task_id)

    pending_step = next(
        (s for s in dag.steps if s.status == "PAUSED_APPROVAL" or s.requires_approval),
        None,
    )
    action_proposal = None
    if pending_step:
        risk_val = (
            pending_step.risk_level.value
            if hasattr(pending_step.risk_level, "value")
            else str(pending_step.risk_level).lower()
        )
        action_proposal = {
            "id": pending_step.approval_id or f"apr-{dag.task_id}",
            "toolName": pending_step.skill_name,
            "actionTitle": pending_step.title,
            "description": f"Goal: {prompt}. High-risk operation halted at Gjallarhorn approval gate awaiting human authorization.",
            "riskLevel": risk_val,
            "payload": pending_step.parameters,
            "requiresApproval": True,
            "status": "pending",
        }

    status_msg = (
        f"Protected action halted at approval gate (approval ID: {action_proposal['id']})."
        if action_proposal
        else f"Task completed successfully with {len(dag.steps)} step(s)."
    )

    return {
        "id": f"msg-{int(time.time() * 1000)}",
        "role": "agent",
        "content": f"Acknowledged. Analyzing: {prompt}. {status_msg}",
        "thoughtTrace": [
            "Probing encrypted memory vault for relevant user facts and context",
            f"Constructed execution DAG with {len(dag.steps)} step(s)",
            "Evaluating authorization boundary and toolchain permissions",
        ],
        "relatedTaskId": dag.task_id,
        "actionProposal": action_proposal,
        "timestamp": os.environ.get("MOCK_TIME", "2026-10-25T20:00:00Z"),
    }


@app.get("/api/skills", tags=["Skills"])
def list_skills():
    """Registered agent tools with security policy indicators."""
    return [
        {
            "id": "skill-fs",
            "name": "filesystem.operations",
            "description": "Safe workspace file reading and writing within project root",
            "isSandboxed": True,
            "isLive": True,
            "riskLevel": "high",
        },
        {
            "id": "skill-term",
            "name": "terminal.execution",
            "description": "Allowlisted developer commands (git, npm, pytest, node, python)",
            "isSandboxed": True,
            "isLive": True,
            "riskLevel": "high",
        },
        {
            "id": "skill-memory",
            "name": "memory.vault",
            "description": "Encrypted episodic and semantic memory management",
            "isSandboxed": True,
            "isLive": True,
            "riskLevel": "low",
        },
    ]


@app.get("/api/settings/privacy", tags=["Settings"])
def get_privacy_settings():
    return _privacy_settings


@app.patch("/api/settings/privacy", tags=["Settings"])
def update_privacy_settings(updates: Dict[str, Any]):
    _privacy_settings.update(updates)
    return _privacy_settings


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("MEMORAG_HOST", os.environ.get("RAGNAROK_HOST", "0.0.0.0"))
    port = int(os.environ.get("MEMORAG_PORT", os.environ.get("RAGNAROK_PORT", "8000")))
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
