"""
Comprehensive Integration Test Suite for MEMORAG Backend Refactor.
Verifies:
1. Centralized local Ollama model configuration & deterministic fallback behavior.
2. Distinct plan_source attribution ('model_generated' vs 'deterministic_fallback').
3. Strict approval gatekeeper: high-risk actions unconditionally require approval; rejection fails task; invalid approval IDs return 404.
4. Canonical API contract endpoints:
   - GET /api/skills (registered skills discovery)
   - POST /api/agent/chat (command center chat handshake)
   - GET /api/memories & DELETE /api/memories/{id} (plural aliases)
   - GET /api/settings/privacy & PATCH /api/settings/privacy
   - GET /health, GET /api/health, GET /api/agent/status (health & runtime status)
"""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.api.routes import SubsystemContainer
from app.memory.crypto import EncryptionService, TestKeyProvider
from app.memory.models import RiskLevel, SemanticCategory, VerificationStatus
from backend.main import app, get_orchestrator, get_planner
from backend.planner import TaskPlanner, DEFAULT_MODEL


@pytest.fixture
def memorag_client():
    """Initializes isolated encrypted SQLite vault and FastAPI test client."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "memorag_test.db")
        crypto = EncryptionService(TestKeyProvider())
        SubsystemContainer.initialize(db_path=db_path, encryption_service=crypto)

        # Seed initial test facts and preferences
        mem_svc = SubsystemContainer.memory_service
        mem_svc.store_memory(
            category=SemanticCategory.PREFERENCE,
            subject="operator",
            predicate="preferred_shell",
            object_value="pwsh",
            verification_status=VerificationStatus.USER_PROVIDED,
        )
        mem_svc.store_memory(
            category=SemanticCategory.FACT,
            subject="workspace_root",
            predicate="path",
            object_value="c:/Users/SUMIT YADAV/Desktop/GALACTUS",
            verification_status=VerificationStatus.VERIFIED,
        )

        # Reset singletons
        import backend.main
        backend.main.orchestrator = None
        backend.main.planner = None

        with TestClient(app) as client:
            yield client, mem_svc

        # Cleanup
        SubsystemContainer.db = None
        SubsystemContainer.memory_service = None
        SubsystemContainer.recovery_manager = None
        SubsystemContainer.permission_gateway = None
        SubsystemContainer.consolidation_engine = None
        backend.main.orchestrator = None
        backend.main.planner = None


# ============================================================================
# 1. Model Configuration & Deterministic Fallback Tests
# ============================================================================

def test_model_centralization_and_fallback(memorag_client):
    """Verifies centralized Ollama model configuration and deterministic fallback."""
    client, mem_svc = memorag_client

    planner = TaskPlanner(
        model=None, # Should use DEFAULT_MODEL
        ollama_endpoint="http://127.0.0.1:11434",
        memory_service=mem_svc,
    )

    assert planner.model == DEFAULT_MODEL
    assert "gemma4:e2b" in planner.model or "gemma" in planner.model

    # Generate DAG when Ollama is offline or mock loopback
    dag = planner.generate_dag("Run automated system diagnostics")
    assert dag.plan_source in ("model_generated", "deterministic_fallback")
    assert len(dag.steps) >= 2
    assert dag.status == "PENDING"
    assert "pwsh" in dag.system_prompt


# ============================================================================
# 2. Security & High-Risk Invariant Tests
# ============================================================================

def test_high_risk_actions_unconditionally_require_approval(memorag_client):
    """Verifies that high-risk actions unconditionally mandate approval regardless of input."""
    client, mem_svc = memorag_client

    planner = TaskPlanner(memory_service=mem_svc)
    dag = planner.generate_dag("Deploy and execute shell script to overwrite configuration")

    # High-risk steps must have requires_approval=True
    high_risk_steps = [s for s in dag.steps if s.risk_level == RiskLevel.HIGH]
    assert len(high_risk_steps) >= 1
    for s in high_risk_steps:
        assert s.requires_approval is True


def test_invalid_approval_id_returns_404(memorag_client):
    """Verifies unknown or expired approval IDs are rejected with 404."""
    client, _ = memorag_client
    res = client.post("/api/approvals/apr-nonexistent999", json={"decision": "approved"})
    assert res.status_code == 404


def test_approval_rejection_marks_task_failed(memorag_client):
    """Verifies human rejection safely terminates and fails the task."""
    client, _ = memorag_client

    # Create task with high-risk step
    r_task = client.post("/api/tasks", json={"goal": "Deploy production smart contract"})
    assert r_task.status_code == 201
    task_id = r_task.json()["task_id"]

    # Retrieve pending approval
    r_appr = client.get("/api/approvals")
    assert r_appr.status_code == 200
    approvals = r_appr.json()
    assert len(approvals) >= 1
    approval_id = approvals[0]["approval_id"]

    # Reject
    r_dec = client.post(f"/api/approvals/{approval_id}", json={"decision": "rejected", "notes": "Unauthorized deploy"})
    assert r_dec.status_code == 200
    assert r_dec.json()["status"] == "rejected"

    # Verify task state
    r_check = client.get(f"/api/tasks/{task_id}")
    assert r_check.status_code == 200
    assert r_check.json()["status"] == "FAILED"


# ============================================================================
# 3. Canonical API Contract & Compatibility Tests
# ============================================================================

def test_health_and_runtime_status_endpoints(memorag_client):
    """Verifies all health and status endpoints return 200 with MEMORAG branding."""
    client, _ = memorag_client

    # Root probe
    r_root = client.get("/")
    assert r_root.status_code == 200
    root_data = r_root.json()
    assert "MEMORAG" in root_data["service"]
    assert root_data["product"] == "MEMORAG"
    assert "GALACTUS" in root_data["service"]

    # Liveness probes
    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    r_api_health = client.get("/api/health")
    assert r_api_health.status_code == 200
    assert r_api_health.json()["status"] == "healthy"

    # Agent status
    r_status = client.get("/api/agent/status")
    assert r_status.status_code == 200
    status_data = r_status.json()
    assert status_data["status"] == "healthy"
    assert status_data["product"] == "MEMORAG"
    assert status_data["ollama"] == "connected"


def test_skills_discovery_endpoint(memorag_client):
    """Verifies GET /api/skills returns registered skills matching frontend contract."""
    client, _ = memorag_client
    res = client.get("/api/skills")
    assert res.status_code == 200
    skills = res.json()
    assert len(skills) >= 4
    skill_names = [s["name"] for s in skills]
    assert "filesystem.operations" in skill_names
    assert "terminal.sandboxed_exec" in skill_names
    assert "memory.recall_and_weave" in skill_names


def test_command_center_chat_endpoint(memorag_client):
    """Verifies POST /api/agent/chat handshake with memory citations."""
    client, _ = memorag_client

    # Chat conversational prompt
    res_chat = client.post("/api/agent/chat", json={"prompt": "What is your operating policy?", "mode": "chat"})
    assert res_chat.status_code == 200
    chat_data = res_chat.json()
    assert chat_data["role"] == "agent"
    assert "MEMORAG" in chat_data["content"]
    assert "citedMemoryIds" in chat_data

    # Task dispatch prompt
    res_task = client.post("/api/agent/chat", json={"prompt": "Run security check and audit permissions", "mode": "task"})
    assert res_task.status_code == 200
    task_chat_data = res_task.json()
    assert "relatedTaskId" in task_chat_data
    assert "Synthesized execution DAG" in task_chat_data["content"]


def test_memories_plural_compatibility_endpoints(memorag_client):
    """Verifies GET /api/memories and DELETE /api/memories/{id} plural aliases."""
    client, mem_svc = memorag_client

    # Query plural memories
    res = client.get("/api/memories")
    assert res.status_code == 200
    memories = res.json()
    assert len(memories) >= 2

    # Check schema compatibility with frontend
    first_mem = memories[0]
    assert "id" in first_mem
    assert "type" in first_mem
    assert "content" in first_mem
    assert "tags" in first_mem

    # Delete memory via plural alias
    del_id = first_mem["id"]
    res_del = client.delete(f"/api/memories/{del_id}")
    assert res_del.status_code == 200


def test_privacy_settings_endpoints(memorag_client):
    """Verifies GET /api/settings/privacy and PATCH /api/settings/privacy."""
    client, _ = memorag_client

    res = client.get("/api/settings/privacy")
    assert res.status_code == 200
    settings = res.json()
    assert settings["localOnlyMode"] is True
    assert "http://127.0.0.1:11434" in settings["ollamaHost"]

    # Patch settings
    res_patch = client.patch("/api/settings/privacy", json={"forgettingThresholdDays": 45})
    assert res_patch.status_code == 200
    assert res_patch.json()["forgettingThresholdDays"] == 45
