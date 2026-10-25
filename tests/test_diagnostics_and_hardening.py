"""
Backend Integration & Hardening Test Suite for MEMORAG Forge
Exercises:
1. POST /api/diagnostics/analyze
2. POST /api/diagnostics/{task_id}/repair rejection semantics (zero mutation, zero commands)
3. Repeated rejection on already processed proposal returns structured HTTP 409 (never HTTP 500)
4. Rejection of nonexistent task returns structured HTTP 404
5. Controlled approval applies changes and verifies exit codes
6. Non-destructive recovery restores only modified files
7. Trustworthy checkpoint validation (refuses healthy claim without exit code 0 evidence)
8. Loopback security boundary enforcement
9. Sentinel canonical execution events persisted in SQLite
"""

import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.api.routes import SubsystemContainer
from app.memory.crypto import EncryptionService, TestKeyProvider
from backend.main import app


@pytest.fixture(scope="module")
def client():
    # Setup temporary database and test encryption key
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_hardening.db")
    crypto = EncryptionService(TestKeyProvider())
    SubsystemContainer.initialize(db_path=db_path, encryption_service=crypto)
    
    with TestClient(app) as test_client:
        yield test_client
        
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_analyze_diagnostic_endpoint(client):
    """A. Analyze a real project and retrieve its diagnostic report."""
    temp_proj = tempfile.mkdtemp()
    try:
        res = client.post("/api/diagnostics/analyze", json={
            "project_root": temp_proj,
            "user_request": "Investigate unit test and build failures",
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "task_id" in data
        assert data["status"] == "AWAITING_APPROVAL"
        assert len(data["observed_facts"]) >= 1
        assert data["proposed_repair"] is not None
        assert data["proposed_repair"]["status"] == "PENDING_APPROVAL"
        assert data["proposed_repair"]["patch_hash"] is not None
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_repair_rejection_semantics_zero_mutation(client):
    """
    B. Reject a real pending repair and compare file hashes before/after.
    Rejecting must leave files untouched, execute zero commands, and return passed=False.
    """
    temp_proj = tempfile.mkdtemp()
    try:
        # Create a test file
        test_file = os.path.join(temp_proj, "src", "utils", "tokens.ts")
        os.makedirs(os.path.dirname(test_file), exist_ok=True)
        initial_content = "export function count() { return 42; }\n"
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(initial_content)

        # Analyze
        res = client.post("/api/diagnostics/analyze", json={
            "project_root": temp_proj,
            "user_request": "Fix token counting",
        })
        assert res.status_code == 200
        report = res.json()
        task_id = report["task_id"]
        approval_id = report["proposed_repair"]["approval_id"]

        # Reject the proposal
        rej_res = client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "rejected",
            "notes": "Operator determined proposed fix is insufficient.",
        })
        assert rej_res.status_code == 200, rej_res.text
        rej_data = rej_res.json()

        assert rej_data["passed"] is False
        assert rej_data["commands_executed"] == []
        assert rej_data["exit_codes"] == {}
        assert "rejected by operator" in rej_data["summary"].lower()

        # Check file content has NOT mutated
        with open(test_file, "r", encoding="utf-8") as f:
            current_content = f.read()
        assert current_content == initial_content, "Workspace file was mutated despite rejection!"

        # Check task status updated in report
        task_res = client.get(f"/api/diagnostics/{task_id}")
        assert task_res.status_code == 200
        assert task_res.json()["proposed_repair"]["status"] == "REJECTED"
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_repeated_rejection_returns_409_never_500(client):
    """
    C. Repeated rejection must not execute or mutate anything.
    Must return a structured client error (HTTP 409), NEVER an unexplained HTTP 500.
    """
    temp_proj = tempfile.mkdtemp()
    try:
        res = client.post("/api/diagnostics/analyze", json={"project_root": temp_proj})
        assert res.status_code == 200
        task_id = res.json()["task_id"]
        approval_id = res.json()["proposed_repair"]["approval_id"]

        # First rejection -> 200
        first_rej = client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "rejected",
        })
        assert first_rej.status_code == 200

        # Repeated rejection -> structured 409 Conflict
        second_rej = client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "rejected",
        })
        assert second_rej.status_code == 409, f"Expected 409 Conflict, got {second_rej.status_code}"
        assert "already been rejected" in second_rej.json()["detail"].lower()
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_rejection_nonexistent_task_returns_404(client):
    """Rejecting a missing or invalid proposal must return structured client error 404, never 500."""
    res = client.post("/api/diagnostics/nonexistent-task-9999/repair", json={
        "approval_id": "appr-dummy",
        "decision": "rejected",
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_approval_applies_exact_change(client):
    """D. Approve a controlled repair and confirm exact intended file change."""
    temp_proj = tempfile.mkdtemp()
    try:
        target_file = os.path.join(temp_proj, "src", "utils", "tokens.ts")
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        with open(target_file, "w", encoding="utf-8") as f:
            f.write("export function calculateTokens(text: string): number { return text.split(' ').length; }\n")

        res = client.post("/api/diagnostics/analyze", json={"project_root": temp_proj})
        assert res.status_code == 200
        report = res.json()
        task_id = report["task_id"]
        approval_id = report["proposed_repair"]["approval_id"]
        expected_new_content = report["proposed_repair"]["changes"][0]["new_content"]

        # Approve repair
        appr_res = client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "approved",
        })
        assert appr_res.status_code == 200, appr_res.text
        
        # Verify file on disk now matches expected_new_content
        with open(target_file, "r", encoding="utf-8") as f:
            disk_content = f.read()
        assert disk_content == expected_new_content
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_recovery_does_not_overwrite_unrelated_files(client):
    """F. Recover and verify file state without overwriting unrelated user changes."""
    temp_proj = tempfile.mkdtemp()
    try:
        target_file = os.path.join(temp_proj, "src", "utils", "tokens.ts")
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
        original_token_code = "export function count() { return 100; }\n"
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(original_token_code)

        # Create an unrelated user file
        unrelated_file = os.path.join(temp_proj, "unrelated_user_work.txt")
        with open(unrelated_file, "w", encoding="utf-8") as f:
            f.write("Important user notes that must never be deleted!")

        res = client.post("/api/diagnostics/analyze", json={"project_root": temp_proj})
        report = res.json()
        task_id = report["task_id"]
        approval_id = report["proposed_repair"]["approval_id"]

        # Approve repair
        client.post(f"/api/diagnostics/{task_id}/repair", json={
            "approval_id": approval_id,
            "decision": "approved",
        })

        # Rollback recovery
        rec_res = client.post(f"/api/diagnostics/{task_id}/recover", json={})
        assert rec_res.status_code == 200
        assert rec_res.json()["success"] is True

        # Verify target file restored to original
        with open(target_file, "r", encoding="utf-8") as f:
            assert f.read() == original_token_code

        # Verify unrelated user file is STILL completely intact!
        assert os.path.exists(unrelated_file)
        with open(unrelated_file, "r", encoding="utf-8") as f:
            assert f.read() == "Important user notes that must never be deleted!"
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_checkpoint_refuses_healthy_without_passing_evidence(client):
    """
    G. Create a checkpoint with real test evidence;
    attempt to mark a checkpoint healthy without valid evidence and confirm the backend refuses.
    """
    # 1. Attempt to claim healthy with testsExitCode = 1 (failing) -> Must be rejected (422)
    bad_res = client.post("/api/diagnostics/checkpoints", json={
        "title": "False claim checkpoint",
        "is_healthy": True,
        "evidence_snapshot": {"testsExitCode": 1},
        "test_results": {"failed": 2},
    })
    assert bad_res.status_code == 422, "Backend allowed false healthy checkpoint!"

    # 2. Attempt to claim healthy with missing evidence -> Must be rejected (422)
    missing_res = client.post("/api/diagnostics/checkpoints", json={
        "title": "Missing evidence claim",
        "is_healthy": True,
        "evidence_snapshot": {},
    })
    assert missing_res.status_code == 422, "Backend allowed healthy checkpoint without evidence!"

    # 3. Create valid healthy checkpoint with testsExitCode = 0 -> Must succeed (201)
    good_res = client.post("/api/diagnostics/checkpoints", json={
        "title": "Authentic Passing Baseline",
        "is_healthy": True,
        "evidence_snapshot": {"testsExitCode": 0},
        "test_results": {"failed": 0, "passed": 12},
    })
    assert good_res.status_code == 201
    assert good_res.json()["is_healthy"] is True
    assert good_res.json()["evidence_verified"] is True


def test_sentinel_durable_flight_events(client):
    """H & I. Read canonical Flight Recorder events and linked evidence from SQLite."""
    temp_proj = tempfile.mkdtemp()
    try:
        res = client.post("/api/diagnostics/analyze", json={"project_root": temp_proj})
        task_id = res.json()["task_id"]

        # Fetch canonical events from Sentinel SQLite endpoint
        events_res = client.get(f"/api/diagnostics/{task_id}/events")
        assert events_res.status_code == 200
        events = events_res.json()
        assert len(events) >= 1
        assert events[0]["task_id"] == task_id
        assert events[0]["source"] == "sentinel_canonical"
        assert "summary" in events[0]["details"]
    finally:
        shutil.rmtree(temp_proj, ignore_errors=True)


def test_loopback_boundary_guard(client):
    """K. Verify execution endpoints are not exposed over LAN by default."""
    # When request comes with a non-loopback X-Forwarded-For header:
    res = client.post(
        "/api/diagnostics/analyze",
        json={"project_root": "."},
        headers={"X-Forwarded-For": "192.168.109.50"},
    )
    assert res.status_code == 403
    assert res.json()["code"] == "REMOTE_EXECUTION_BLOCKED"
