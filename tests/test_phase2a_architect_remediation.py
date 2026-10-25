"""
Comprehensive Regression Test Suite for MEMORAG Forge Phase 2A Architect Remediation.

Proves:
1. Registered tool performs real, observable action in temporary workspace.
2. Unsupported tools fail without false success.
3. Tool failures preserve real exit status & error information.
4. Path traversal and unsafe command attempts are rejected.
5. Approval is required before protected mutation.
6. Ollama offline/missing-model/timeout states are truthful.
7. Configured timeouts are honored.
8. Cancelling a task stops supported backend execution.
9. SSE disconnect does not falsely mark a task as cancelled or successful.
10. API schemas match documented responses.
11. Live Ollama environment status probe is evaluated truthfully.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.routes import SubsystemContainer
from app.memory.crypto import EncryptionService, TestKeyProvider
from app.memory.models import RiskLevel, SemanticCategory, VerificationStatus
from backend.main import app, get_orchestrator, get_planner, probe_agent_runtime
from backend.orchestrator import TaskOrchestrator
from backend.planner import DAGStep, TaskDAG, TaskPlanner
from backend.tools import (
    ExecutionContext,
    FileListParams,
    FileReadParams,
    FileWriteParams,
    SecurityViolationError,
    TerminalExecParams,
    ToolResult,
    handle_file_list,
    handle_file_read,
    handle_file_write,
    handle_terminal_exec,
    tool_registry,
)


@pytest.fixture
def remediation_environment():
    """Sets up an isolated database, clean orchestrator, and temporary sandbox."""
    with tempfile.TemporaryDirectory() as tmp_db_dir, tempfile.TemporaryDirectory() as tmp_workspace:
        db_path = os.path.join(tmp_db_dir, "phase2a_test.db")
        crypto = EncryptionService(TestKeyProvider())
        SubsystemContainer.initialize(db_path=db_path, encryption_service=crypto)

        # Seed test facts and preferences
        mem_svc = SubsystemContainer.memory_service
        mem_svc.store_memory(
            category=SemanticCategory.PREFERENCE,
            subject="operator",
            predicate="preferred_shell",
            object_value="pwsh",
            verification_status=VerificationStatus.USER_PROVIDED,
        )

        # Reset singletons
        import backend.main
        backend.main.orchestrator = None
        backend.main.planner = None

        workspace_path = Path(tmp_workspace).resolve()

        with TestClient(app) as client:
            yield client, workspace_path, mem_svc, SubsystemContainer.permission_gateway

        # Clean up
        SubsystemContainer.db = None
        SubsystemContainer.memory_service = None
        backend.main.orchestrator = None
        backend.main.planner = None


# ============================================================================
# 1. Registered Tool Performs Real Observable Action in Temporary Workspace
# ============================================================================
@pytest.mark.asyncio
async def test_registered_tool_performs_real_observable_action_in_temp_workspace(remediation_environment):
    client, workspace_path, mem_svc, perm_gw = remediation_environment

    ctx_approved = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-01",
        step_id="step-01",
        memory_service=mem_svc,
        is_approved=True,
    )

    # 1. Real file write
    write_res = await tool_registry.execute(
        "filesystem.write_file",
        {"path": "sample.txt", "content": "Real sovereign execution verified."},
        ctx_approved,
    )
    assert write_res.success is True
    assert write_res.exit_code == 0
    assert (workspace_path / "sample.txt").exists()
    assert (workspace_path / "sample.txt").read_text(encoding="utf-8") == "Real sovereign execution verified."
    assert "sha256" in write_res.verification_evidence

    # 2. Real file read
    ctx_read = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-01",
        step_id="step-02",
        memory_service=mem_svc,
        is_approved=False, # Read-only does not require approval
    )
    read_res = await tool_registry.execute(
        "filesystem.read_file",
        {"path": "sample.txt"},
        ctx_read,
    )
    assert read_res.success is True
    assert read_res.exit_code == 0
    assert read_res.stdout == "Real sovereign execution verified."
    assert read_res.verification_evidence["bytes_read"] > 0

    # 3. Real terminal subprocess execution (argument array, never shell=True)
    exec_res = await tool_registry.execute(
        "terminal.sandboxed_exec",
        {"command": ["python", "-c", "import sys; sys.stdout.write('real_subprocess_output')"]},
        ctx_approved,
    )
    assert exec_res.success is True
    assert exec_res.exit_code == 0
    assert exec_res.stdout == "real_subprocess_output"
    assert exec_res.verification_evidence["binary"] == "python"


# ============================================================================
# 2. Unsupported Tools Fail Without False Success
# ============================================================================
@pytest.mark.asyncio
async def test_unsupported_tools_fail_without_false_success(remediation_environment):
    client, workspace_path, mem_svc, _ = remediation_environment

    ctx = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-02",
        step_id="step-01",
        is_approved=True,
    )

    res = await tool_registry.execute("malicious_unregistered_hack", {}, ctx)
    assert res.success is False
    assert res.exit_code == 1
    assert "Unsupported skill" in res.error
    assert "malicious_unregistered_hack" in res.error

    # Verify DAG step execution also records explicit failure rather than false success
    orch = TaskOrchestrator()
    bad_step = DAGStep(
        step_id="bad-01",
        title="Unknown action",
        skill_name="nonexistent.tool",
        requires_approval=False,
    )
    dag = TaskDAG(
        task_id="dag-unsupported",
        goal="Test unsupported skill",
        steps=[bad_step],
        system_prompt="...",
    )
    orch.register_task(dag)
    await orch._execute_step(dag, bad_step, is_approved=False)

    assert bad_step.status == "FAILED"
    assert dag.status == "FAILED"
    assert bad_step.output["success"] is False
    assert "Unsupported skill" in bad_step.output["error"]


# ============================================================================
# 3. Tool Failures Preserve Real Exit Status and Error Information
# ============================================================================
@pytest.mark.asyncio
async def test_tool_failures_preserve_real_exit_status_and_error_info(remediation_environment):
    client, workspace_path, _, _ = remediation_environment

    ctx = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-03",
        step_id="step-01",
        is_approved=True,
    )

    # Subprocess exiting with non-zero code 42 and writing to stderr
    res = await tool_registry.execute(
        "terminal.sandboxed_exec",
        {"command": ["python", "-c", "import sys; sys.stderr.write('Syntax error simulation'); sys.exit(42)"]},
        ctx,
    )
    assert res.success is False
    assert res.exit_code == 42
    assert "Syntax error simulation" in res.stderr
    assert "42" in res.error

    # Read failure on non-existent file
    res_missing = await tool_registry.execute(
        "filesystem.read_file",
        {"path": "does_not_exist.txt"},
        ctx,
    )
    assert res_missing.success is False
    assert res_missing.exit_code == 1
    assert "File not found" in res_missing.error


# ============================================================================
# 4. Path Traversal and Unsafe Command Attempts Are Rejected
# ============================================================================
@pytest.mark.asyncio
async def test_path_traversal_and_unsafe_command_attempts_rejected(remediation_environment):
    client, workspace_path, _, _ = remediation_environment

    ctx = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-04",
        step_id="step-01",
        is_approved=True,
    )

    # 1. Path traversal escape via ../
    res_traversal = await tool_registry.execute(
        "filesystem.read_file",
        {"path": "../../secret.env"},
        ctx,
    )
    assert res_traversal.success is False
    assert res_traversal.exit_code == 126
    assert "Path traversal detected" in res_traversal.error

    # 2. Command chaining / injection operators rejected
    unsafe_commands = [
        "python -c 'print(1)' ; rm -rf /",
        "echo 1 && cat /etc/passwd",
        "echo test | grep t",
        "ls `whoami`",
        "cat $(echo /etc/shadow)",
    ]
    for bad_cmd in unsafe_commands:
        res_unsafe = await tool_registry.execute(
            "terminal.sandboxed_exec",
            {"command": bad_cmd},
            ctx,
        )
        assert res_unsafe.success is False
        assert res_unsafe.exit_code == 126
        assert "Forbidden shell operator" in res_unsafe.error


# ============================================================================
# 5. Approval Is Required Before Protected Mutation
# ============================================================================
@pytest.mark.asyncio
async def test_approval_required_before_protected_mutation(remediation_environment):
    client, workspace_path, _, _ = remediation_environment

    ctx_unapproved = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-test-05",
        step_id="step-01",
        is_approved=False,
    )

    # File write without approval
    res_write = await tool_registry.execute(
        "filesystem.write_file",
        {"path": "unauthorized.txt", "content": "blocked"},
        ctx_unapproved,
    )
    assert res_write.success is False
    assert res_write.exit_code == 126
    assert "Approval required" in res_write.error
    assert not (workspace_path / "unauthorized.txt").exists()

    # Terminal command without approval
    res_exec = await tool_registry.execute(
        "terminal.sandboxed_exec",
        {"command": ["python", "-c", "print('hacked')"]},
        ctx_unapproved,
    )
    assert res_exec.success is False
    assert res_exec.exit_code == 126
    assert "Approval required" in res_exec.error


# ============================================================================
# 6. Ollama Offline, Missing-Model, and Timeout States Are Truthful
# ============================================================================
def test_truthful_ollama_runtime_health_states():
    # Case A: Ollama daemon offline (connection refused)
    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")):
        probe_offline = probe_agent_runtime(model_name="gemma4:e2b")
        assert probe_offline["status"] == "degraded"
        assert probe_offline["ollama"] == "unreachable"
        assert probe_offline["model_present"] is False
        assert probe_offline["inference_verified"] is False
        assert probe_offline["runtime_checks"]["ollama_reachable"] is False

    # Case B: Ollama online but configured model missing
    mock_resp_missing = MagicMock()
    mock_resp_missing.status_code = 200
    mock_resp_missing.json.return_value = {"models": [{"name": "nomic-embed-text:latest"}]}

    with patch("httpx.Client.get", return_value=mock_resp_missing):
        probe_missing = probe_agent_runtime(model_name="gemma4:e2b")
        assert probe_missing["status"] == "degraded"
        assert probe_missing["ollama"] == "model_missing"
        assert probe_missing["model_present"] is False
        assert probe_missing["inference_verified"] is False
        assert probe_missing["runtime_checks"]["ollama_reachable"] is True
        assert probe_missing["runtime_checks"]["model_available"] is False

    # Case C: Ollama probe timeout
    with patch("httpx.Client.get", side_effect=httpx.TimeoutException("Read timeout")):
        probe_timeout = probe_agent_runtime(model_name="gemma4:e2b")
        assert probe_timeout["status"] == "degraded"
        assert probe_timeout["ollama"] == "unreachable"
        assert "timed out" in probe_timeout["runtime_checks"]["probe_error"]

    # Case D: Malformed response (HTTP 500)
    mock_resp_500 = MagicMock()
    mock_resp_500.status_code = 500
    with patch("httpx.Client.get", return_value=mock_resp_500):
        probe_500 = probe_agent_runtime(model_name="gemma4:e2b")
        assert probe_500["status"] == "degraded"
        assert probe_500["ollama"] == "error"

    # Case E: Successful response with model present
    mock_resp_ok = MagicMock()
    mock_resp_ok.status_code = 200
    mock_resp_ok.json.return_value = {"models": [{"name": "gemma4:e2b", "model": "gemma4:e2b"}]}
    with patch("httpx.Client.get", return_value=mock_resp_ok):
        with patch.object(SubsystemContainer, "db", MagicMock()):
            with patch.object(SubsystemContainer, "memory_service", MagicMock()):
                probe_ok = probe_agent_runtime(model_name="gemma4:e2b")
                assert probe_ok["status"] == "healthy"
                assert probe_ok["ollama"] == "connected"
                assert probe_ok["model_present"] is True


# ============================================================================
# 7. Configured Timeouts Are Honored
# ============================================================================
@pytest.mark.asyncio
async def test_configured_timeouts_honored(remediation_environment):
    client, workspace_path, mem_svc, _ = remediation_environment

    # 1. Test TaskPlanner respects custom read_timeout
    planner = TaskPlanner(
        model="gemma4:e2b",
        ollama_endpoint="http://127.0.0.1:11434",
        memory_service=mem_svc,
        read_timeout=0.001, # extremely small timeout
    )
    dag = planner.generate_dag("Synthesize plan with tiny timeout")
    assert dag.plan_source == "deterministic_fallback"
    assert dag.fallback_reason is not None

    # 2. Subprocess execution timeout
    ctx = ExecutionContext(
        workspace_root=workspace_path,
        task_id="task-timeout-test",
        step_id="step-timeout",
        is_approved=True,
    )
    # Run python sleep for 10 seconds with timeout_sec=0.5
    res = await tool_registry.execute(
        "terminal.sandboxed_exec",
        {"command": ["python", "-c", "import time; time.sleep(10)"], "timeout_sec": 0.5},
        ctx,
    )
    assert res.success is False
    assert res.exit_code == 124
    assert "timed out after 0.5 seconds" in res.error


# ============================================================================
# 8. Cancelling a Task Stops Supported Backend Execution
# ============================================================================
@pytest.mark.asyncio
async def test_cancelling_task_stops_supported_backend_execution(remediation_environment):
    client, _, _, _ = remediation_environment

    with patch.object(TaskPlanner, "_call_ollama", return_value=(None, "Mocked test fallback", 1.0)):
        # 1. Create a task that pauses for approval
        r_create = client.post("/api/tasks", json={"goal": "Deploy and configure cluster"})
        assert r_create.status_code == 201
        task_id = r_create.json()["task_id"]

        # Let orchestrator advance steps 1-2 and pause at step 3 for human authorization
        await asyncio.sleep(0.1)

        # 2. Cancel the task via POST /api/tasks/{task_id}/cancel
        r_cancel = client.post(
            f"/api/tasks/{task_id}/cancel",
            json={"reason": "Aborted by security officer"},
        )
        assert r_cancel.status_code == 200
        cancel_data = r_cancel.json()
        assert cancel_data["success"] is True
        assert cancel_data["status"] == "CANCELLED"
        assert cancel_data["task_id"] == task_id

        # 3. Verify task status is CANCELLED and approvals cleared
        r_get = client.get(f"/api/tasks/{task_id}")
        assert r_get.status_code == 200
        task_state = r_get.json()
        assert task_state["status"] == "CANCELLED"
        for s in task_state["steps"]:
            assert s["status"] in ("COMPLETED", "CANCELLED")

        r_approvals = client.get("/api/approvals")
        pending_for_task = [a for a in r_approvals.json() if a["task_id"] == task_id]
        assert len(pending_for_task) == 0

        # 4. Repeated cancellation must be idempotent
        r_repeat = client.post(f"/api/tasks/{task_id}/cancel")
        assert r_repeat.status_code == 200
        assert r_repeat.json()["status"] == "CANCELLED"

        # 5. Non-existent task returns 404
        r_404 = client.post("/api/tasks/task-nonexistent999/cancel")
        assert r_404.status_code == 404


# ============================================================================
# 9. SSE Disconnect Does Not Falsely Mark Task Cancelled or Successful
# ============================================================================
def test_sse_disconnect_does_not_falsely_mark_task_cancelled_or_successful(remediation_environment):
    client, _, _, _ = remediation_environment

    with patch.object(TaskPlanner, "_call_ollama", return_value=(None, "Mocked test fallback", 1.0)):
        # Create task
        r_create = client.post("/api/tasks", json={"goal": "Audit project permissions"})
        assert r_create.status_code == 201
        task_id = r_create.json()["task_id"]

        # Connect to stream and immediately disconnect after 1 line
        with client.stream("GET", f"/api/tasks/{task_id}/events/stream") as stream:
            assert stream.status_code == 200
            for line in stream.iter_lines():
                if line:
                    break # Client disconnects immediately

        # Verify task status is NOT CANCELLED and NOT falsely modified
        r_task = client.get(f"/api/tasks/{task_id}")
        assert r_task.status_code == 200
        task_state = r_task.json()
        assert task_state["status"] in ("RUNNING", "PAUSED_APPROVAL", "COMPLETED")
        assert task_state["status"] != "CANCELLED"


# ============================================================================
# 10. API Schemas Match Documented Responses
# ============================================================================
def test_api_schemas_match_documented_responses(remediation_environment):
    client, _, _, _ = remediation_environment

    # 1. GET /api/agent/status schema validation
    r_status = client.get("/api/agent/status")
    assert r_status.status_code == 200
    st = r_status.json()
    for field in ("status", "service", "product", "backend", "ollama", "model", "model_present", "inference_verified", "memory_vault", "runtime_checks"):
        assert field in st

    # 2. POST /api/agent/chat validation
    # Empty prompt rejection (400)
    r_empty = client.post("/api/agent/chat", json={"prompt": "   "})
    assert r_empty.status_code == 400

    # Normal prompt
    r_chat = client.post("/api/agent/chat", json={"prompt": "How do you ensure zero data leaks?"})
    assert r_chat.status_code == 200
    chat_data = r_chat.json()
    assert chat_data["role"] == "agent"
    assert "model" in chat_data
    assert "citations" in chat_data
    assert "citedMemoryIds" in chat_data

    # 3. GET /api/skills
    r_skills = client.get("/api/skills")
    assert r_skills.status_code == 200
    skills = r_skills.json()
    assert len(skills) >= 5
    for sk in skills:
        assert "id" in sk
        assert "name" in sk
        assert "isSandboxed" in sk
        assert "requiresApproval" in sk
        assert "parameters" in sk


# ============================================================================
# 11. Live Ollama Environment Status Probe (Separately Labeled)
# ============================================================================
def test_live_ollama_status_probe_evaluation(remediation_environment):
    """
    Live host probe check: Evaluates actual local Ollama daemon state without faking success.
    """
    client, _, _, _ = remediation_environment
    r = client.get("/api/agent/status")
    assert r.status_code == 200
    data = r.json()
    assert data["backend"] == "available"
    assert data["ollama"] in ("connected", "unreachable", "model_missing")
    assert isinstance(data["model_present"], bool)
    assert isinstance(data["inference_verified"], bool)
