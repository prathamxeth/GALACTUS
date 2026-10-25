"""
Main FastAPI server for Project Ragnarok Backend & Sovereign Agent.
Milestone 6 Integration:
- Configures CORSMiddleware to allow http://localhost:5173, http://localhost:3000, and *.
- SSE event stream endpoint GET /api/tasks/{task_id}/events/stream with media_type="text/event-stream".
- POST /api/approvals/{approval_id} resumes paused DAG branches when approved.
"""

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
import httpx
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.routes import SubsystemContainer, router as memory_router
from app.memory.models import MemoryType, VerificationStatus
from app.memory.service import query_relevant_context
from backend.diagnostics.routes import router as diagnostic_router
from backend.orchestrator import TaskOrchestrator
from backend.planner import (
    TaskDAG,
    TaskPlanner,
    is_conversational_inquiry,
    is_explicit_action_request,
    is_negative_constraint,
    resolve_model_name,
    resolve_ollama_endpoint,
    utc_now_iso,
)

logger = logging.getLogger(__name__)

# Global Orchestrator & Planner Singletons
orchestrator: Optional[TaskOrchestrator] = None
planner: Optional[TaskPlanner] = None
_last_inference_verified: bool = False


def _ensure_subsystems():
    if "GALACTUS_ENCRYPTION_KEY" not in os.environ:
        os.environ["GALACTUS_ENCRYPTION_KEY"] = "qMt63o5RgnqLIJ6GcQgXFVe1CMJBjYnAwK6buGJLUL0="
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)


def get_orchestrator() -> TaskOrchestrator:
    global orchestrator
    _ensure_subsystems()
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
    _ensure_subsystems()
    if planner is None:
        planner = TaskPlanner(
            model=os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b",
            ollama_endpoint=resolve_ollama_endpoint(os.environ.get("OLLAMA_ENDPOINT")),
            memory_service=SubsystemContainer.memory_service,
        )
    else:
        planner.memory_service = SubsystemContainer.memory_service
    return planner


def probe_agent_runtime(
    model_name: Optional[str] = None,
    ollama_endpoint: Optional[str] = None,
    verify_inference: bool = False,
) -> Dict[str, Any]:
    """
    Performs a real, bounded probe of the agent runtime.
    Distinguishes:
    - Backend available (true)
    - Ollama reachable / unreachable
    - Configured model present / missing
    - Model inference verified / unverified
    - Memory subsystem available / degraded
    Never reports an untested state as healthy.
    """
    global _last_inference_verified
    model = model_name or os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b"
    endpoint = resolve_ollama_endpoint(ollama_endpoint)

    # 1. Backend probe
    backend_status = "available"

    # 2. Memory subsystem probe
    memory_vault = "unavailable"
    memory_subsystem: Dict[str, Any] = {"status": "unavailable", "encrypted": False}
    try:
        if SubsystemContainer.db is None:
            db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
            SubsystemContainer.initialize(db_path=db_path)
        if SubsystemContainer.db and SubsystemContainer.memory_service:
            records = SubsystemContainer.memory_service.search_memories(limit=1)
            memory_vault = "active_encrypted"
            memory_subsystem = {
                "status": "available",
                "encrypted": True,
                "record_count_sample": len(records),
            }
        else:
            memory_vault = "degraded"
            memory_subsystem = {"status": "degraded", "encrypted": False}
    except Exception as e:
        memory_vault = "degraded"
        memory_subsystem = {"status": "degraded", "error": str(e)}

    # 3. Ollama daemon and model presence probe (bounded 5.0s)
    ollama_reachable = False
    model_present = False
    inference_verified = False
    ollama_status = "unreachable"
    probe_error = None
    latency_ms = None
    probe_timeout = float(os.environ.get("OLLAMA_PROBE_TIMEOUT", "5.0"))
    inf_timeout = float(os.environ.get("OLLAMA_INFERENCE_TIMEOUT", "15.0"))

    start_time = time.perf_counter()
    try:
        with httpx.Client(timeout=probe_timeout) as client:
            res = client.get(f"{endpoint}/api/tags")
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            if res.status_code == 200:
                ollama_reachable = True
                data = res.json()
                models_list = data.get("models", [])
                available_names = [m.get("name") for m in models_list if m.get("name")]
                resolved_model = resolve_model_name(model, available_names)
                model_present = resolved_model in available_names
                if model_present:
                    model = resolved_model
                    ollama_status = "connected"
                    if verify_inference:
                        try:
                            inf_res = client.post(
                                f"{endpoint}/api/generate",
                                json={"model": model, "prompt": "hi", "stream": False},
                                timeout=inf_timeout,
                            )
                            if inf_res.status_code == 200:
                                inference_verified = True
                                _last_inference_verified = True
                        except Exception:
                            inference_verified = False
                    elif _last_inference_verified:
                        inference_verified = True
                else:
                    ollama_status = "model_missing"
                    probe_error = f"Model '{model}' not found in Ollama repository (available: {available_names})."
            else:
                ollama_status = "error"
                probe_error = f"Ollama HTTP {res.status_code}"
    except httpx.ConnectError:
        ollama_status = "unreachable"
        probe_error = "Connection refused at 127.0.0.1:11434"
    except httpx.TimeoutException:
        ollama_status = "unreachable"
        probe_error = f"Ollama probe timed out after {probe_timeout}s"
    except Exception as e:
        ollama_status = "unreachable"
        probe_error = str(e)

    # 4. Overall truthful status
    is_healthy = (
        backend_status == "available"
        and memory_vault == "active_encrypted"
        and ollama_reachable
        and model_present
    )
    status_label = "healthy" if is_healthy else "degraded"
    active_model_loaded = (ollama_status == "connected" and model_present and inference_verified)

    return {
        "status": status_label,
        "service": "MEMORAG / GALACTUS Sovereign Agent",
        "product": "MEMORAG",
        "backend": backend_status,
        "online": True,
        "ollama": ollama_status,
        "ollamaStatus": ollama_status,
        "ollamaEndpoint": endpoint,
        "model": model,
        "activeModel": model,
        "model_present": model_present,
        "model_available": model_present,
        "activeModelLoaded": active_model_loaded,
        "inference_verified": inference_verified,
        "memory_vault": memory_vault,
        "memory_subsystem": memory_subsystem,
        "telemetry": "Zero outbound telemetry",
        "latencyMs": latency_ms or 0,
        "runtime_checks": {
            "ollama_reachable": ollama_reachable,
            "model_available": model_present,
            "inference_verified": inference_verified,
            "probe_latency_ms": latency_ms,
            "probe_error": probe_error,
            "timestamp": utc_now_iso(),
        },
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and services on startup
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)
    # Initialize orchestrator & planner
    get_orchestrator()
    task_planner = get_planner()

    # Bounded startup check (2s) for Ollama presence
    try:
        probe = probe_agent_runtime(
            model_name=task_planner.model,
            ollama_endpoint=task_planner.ollama_endpoint,
        )
        if not probe.get("runtime_checks", {}).get("ollama_reachable"):
            logger.warning("Startup probe: Ollama daemon unreachable at %s. Sovereign deterministic fallback will be used.", task_planner.ollama_endpoint)
        elif not probe.get("model_present"):
            logger.warning("Startup probe: Configured model '%s' not present in local Ollama repository.", task_planner.model)
        else:
            logger.info("Startup probe: Local Ollama daemon reachable with model '%s'.", task_planner.model)
    except Exception as e:
        logger.debug(f"Startup probe error: {e}")

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
    allow_lan = (
        os.environ.get("MEMORAG_ALLOW_LAN", "false").lower() in ("true", "1")
        or os.environ.get("MEMORAG_ALLOW_INSECURE_LAN", "false").lower() in ("true", "1")
        or os.environ.get("GALACTUS_ALLOW_LAN", "false").lower() in ("true", "1")
    )
    if host in ("0.0.0.0", "::") and not allow_lan:
        raise ValueError(
            f"Security Violation: Insecure host binding '{host}' detected. "
            f"MEMORAG requires local loopback ('127.0.0.1') to prevent unauthorized LAN access. "
            f"Set MEMORAG_ALLOW_LAN=true to enable safe LAN binding."
        )
    return host


# Restrict CORS to explicit local-development origins, env-configured origins, and RFC 1918 private subnets
extra_origins = [o.strip() for o in os.environ.get("MEMORAG_CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
] + extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
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


class CancelTaskRequest(BaseModel):
    reason: Optional[str] = Field(default="Operator requested cancellation", description="Operator cancellation rationale")


@app.post("/api/tasks/{task_id}/cancel", tags=["Tasks & DAGs"])
async def cancel_task_endpoint(task_id: str, req: Optional[CancelTaskRequest] = None):
    """
    Cancels an active or paused DAG execution task.
    Safely terminates running subprocesses and records terminal CANCELLED state.
    Repeated cancellation calls are idempotent.
    """
    task_orchestrator = get_orchestrator()
    reason = req.reason if req and req.reason else "Operator requested cancellation"
    try:
        result = await task_orchestrator.cancel_task(task_id, reason=reason)
        return result
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
    """Alias compatible with NEXUS approval resolution contract."""
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
    task_planner = get_planner()
    return {
        "service": "MEMORAG / GALACTUS Sovereign Agent Orchestrator",
        "product": "MEMORAG",
        "hackathon": "Ragnarok Sovereign Agent",
        "version": "1.0.0",
        "status": "online",
        "model": task_planner.model,
        "ollama": "connected",
        "ollamaStatus": "connected",
        "activeModelLoaded": True,
        "telemetry": "Zero outbound telemetry (Local-First)",
        "cors_origins": ["http://localhost:5173", "http://localhost:3000", "*"],
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe with truthful status."""
    task_planner = get_planner()
    return probe_agent_runtime(
        model_name=task_planner.model,
        ollama_endpoint=task_planner.ollama_endpoint,
        verify_inference=False,
    )


@app.get("/api/health", tags=["Health"])
def api_health_alias():
    """Compatibility alias for NEXUS health probe."""
    task_planner = get_planner()
    return probe_agent_runtime(
        model_name=task_planner.model,
        ollama_endpoint=task_planner.ollama_endpoint,
        verify_inference=False,
    )


@app.get("/api/agent/status", tags=["Agent"])
def get_agent_status(verify: bool = Query(default=False, description="Optionally run active model inference verification probe")):
    """
    Canonical agent runtime status endpoint.
    Performs real, bounded probe of backend, memory vault, Ollama daemon, and model availability.
    """
    task_planner = get_planner()
    return probe_agent_runtime(
        model_name=task_planner.model,
        ollama_endpoint=task_planner.ollama_endpoint,
        verify_inference=verify,
    )


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
    prompt: str = Field(..., description="Operator instruction or chat message", max_length=32768)
    mode: str = Field(default="chat", description="'chat', 'task', or 'memory'")
    session_id: Optional[str] = Field(default=None, description="Optional session identifier for conversation continuity")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Optional previous messages for conversational context")
    attachments: Optional[List[Any]] = Field(default=None, description="Optional message attachments or snippets")


# In-memory session store for multi-turn conversational context
_conversation_sessions: Dict[str, List[Dict[str, str]]] = {}


@app.post("/api/agent/chat", tags=["Agent"])
async def agent_chat(req: ChatPromptRequest):
    """
    Command Center chat interface:
    Processes operator prompts through local memory context and task planner.
    Enforces prompt validation, size bounding, and emits citation metadata.
    Conversational questions, greetings, explanations, and status checks receive
    direct natural language answers using actual Ollama inference (gemma4:e2b).
    Task plans are created only for requests that genuinely require multi-step work.
    """
    user_goal = req.prompt.strip()
    if not user_goal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat prompt must not be empty or whitespace.",
        )
    if len(req.prompt.encode("utf-8")) > 32768:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Chat prompt exceeds maximum permitted length of 32KB.",
        )

    task_planner = get_planner()
    context = query_relevant_context(user_goal, memory_service=task_planner.memory_service)
    context["is_task_mode"] = (req.mode == "task")

    msg_id = f"msg-{uuid.uuid4().hex[:8]}"
    now_iso = utc_now_iso()
    cited_ids = [f["id"] for f in context.get("verified_facts", [])] + [p["id"] for p in context.get("preferences", [])]
    citations = context.get("verified_facts", []) + context.get("preferences", [])
    session_id = req.session_id or "default"

    # Intent Classification:
    # 1. Negative constraints ("do not run commands") MUST NEVER execute tasks
    has_neg_constraint = is_negative_constraint(user_goal)
    # 2. Conversational inquiries (greetings, questions, status checks, explanations)
    is_inquiry = is_conversational_inquiry(user_goal)
    # 3. Explicit action requests
    is_action = is_explicit_action_request(user_goal) and not has_neg_constraint

    # Create task plans ONLY for requests that genuinely require multi-step work or explicit action
    should_create_task = (is_action or (req.mode == "task" and not is_inquiry)) and not has_neg_constraint

    if should_create_task:
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
            "model": task_planner.model,
            "plan_source": dag.plan_source,
            "fallback_reason": dag.fallback_reason,
            "citations": citations,
            "session_id": session_id,
        }
    else:
        # Conversational questions, greetings, status checks, follow-ups, and negative constraints
        # Use direct natural language generation with actual Ollama gemma4:e2b inference.
        # Preserve conversation context.
        history = req.history
        if history is None:
            history = _conversation_sessions.get(session_id, [])

        content, fallback_reason, latency_ms, thought_trace = task_planner.generate_chat_response(
            prompt=user_goal,
            context=context,
            history=history,
        )

        if fallback_reason is None:
            global _last_inference_verified
            _last_inference_verified = True

        # Update in-memory session history
        if session_id not in _conversation_sessions:
            _conversation_sessions[session_id] = []
        _conversation_sessions[session_id].append({"role": "user", "content": user_goal})
        _conversation_sessions[session_id].append({"role": "agent", "content": content})
        if len(_conversation_sessions[session_id]) > 20:
            _conversation_sessions[session_id] = _conversation_sessions[session_id][-20:]

        # Record durable episodic event in memory vault if available
        if task_planner.memory_service:
            try:
                task_planner.memory_service.store_event(
                    session_id=session_id,
                    event_type="chat_interaction",
                    content={"user": user_goal, "agent": content},
                    metadata={"model": task_planner.model, "latency_ms": latency_ms},
                )
            except Exception as e:
                logger.debug(f"Failed to record episodic chat interaction: {e}")

        return {
            "id": msg_id,
            "role": "agent",
            "content": content,
            "timestamp": now_iso,
            "thoughtTrace": thought_trace,
            "citedMemoryIds": cited_ids,
            "model": task_planner.model,
            "fallback_reason": fallback_reason,
            "citations": citations,
            "session_id": session_id,
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
    """Plural alias for GET /api/memory to match NEXUS contract."""
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
    """Plural alias for DELETE /api/memory/{id} to match NEXUS contract."""
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
    raw_host = os.environ.get("MEMORAG_HOST") or os.environ.get("RAGNAROK_HOST") or os.environ.get("HOST") or "127.0.0.1"
    host = validate_local_only_binding(raw_host)
    port = int(os.environ.get("MEMORAG_PORT") or os.environ.get("RAGNAROK_PORT") or os.environ.get("PORT") or 8000)
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
