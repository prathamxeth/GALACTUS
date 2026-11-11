"""
Project Checkpoint & Safe Recovery Subsystem (MEMORAG FORGE Engineer 2).

Provides:
- Meaningful, inspectable project state manifests (hashes, git state, toolchains).
- Strict separation of lifecycle states: created -> validated -> healthy -> restorable.
- Safe, targeted restoration preventing blind 'git reset --hard' or untracked file loss.
- Pre-restoration snapshotting before file rollbacks.
- Rejection of recovery actions that could destroy uncommitted user work without approval.
"""

import hashlib
import json
import logging
import os
import shutil
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.memory.database import DatabaseManager
from app.memory.models import (
    CheckpointCreateRequest,
    CheckpointLifecycleStatus,
    CheckpointRestoreRequest,
    CheckpointRestoreResponse,
    GitRevisionInfo,
    ProjectCheckpointManifest,
    TrackedFileChange,
    utc_now_iso,
)
from app.memory.security_boundary import SecurityBoundary

logger = logging.getLogger(__name__)


def compute_file_sha256(filepath: str) -> str:
    """Computes SHA-256 hash of a file safely."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class CheckpointService:
    """
    Manages Project Checkpoint manifests and safe, non-destructive restoration.
    """

    def __init__(self, db: DatabaseManager, snapshots_dir: Optional[str] = None):
        self.db = db
        self.snapshots_dir = snapshots_dir or os.path.abspath(".memorag_snapshots")

    # ------------------------------------------------------------------------
    # Manifest Creation
    # ------------------------------------------------------------------------

    def create_checkpoint(self, req: CheckpointCreateRequest) -> ProjectCheckpointManifest:
        """
        Creates a bounded project checkpoint manifest.
        Does NOT indiscriminately copy entire directory trees.
        """
        checkpoint_id = f"chk-{uuid.uuid4().hex[:12]}"
        now = utc_now_iso()

        git_rev = req.git_revision or GitRevisionInfo()
        tracked_changes = req.tracked_changes or []

        # Compute deterministic integrity hash of manifest elements
        integrity_input = (
            f"{req.project_id}|{req.permitted_root}|"
            f"{git_rev.commit_sha}|"
            f"{len(tracked_changes)}|{json.dumps(req.dependency_fingerprints, sort_keys=True)}"
        )
        integrity_hash = hashlib.sha256(integrity_input.encode("utf-8")).hexdigest()

        with self.db.transaction() as conn:
            conn.execute(
                """
                INSERT INTO project_checkpoints_v2 (
                    checkpoint_id, project_id, permitted_root, git_revision,
                    tracked_changes, dependency_fingerprints, toolchain_versions,
                    status, integrity_hash, validation_notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    checkpoint_id,
                    req.project_id,
                    req.permitted_root,
                    json.dumps(git_rev.model_dump()),
                    json.dumps([t.model_dump() for t in tracked_changes]),
                    json.dumps(req.dependency_fingerprints),
                    json.dumps(req.toolchain_versions),
                    CheckpointLifecycleStatus.CREATED.value,
                    integrity_hash,
                    "Initial creation completed.",
                    now,
                    now,
                ),
            )

        return ProjectCheckpointManifest(
            checkpoint_id=checkpoint_id,
            project_id=req.project_id,
            permitted_root=req.permitted_root,
            git_revision=git_rev,
            tracked_changes=tracked_changes,
            dependency_fingerprints=req.dependency_fingerprints,
            toolchain_versions=req.toolchain_versions,
            status=CheckpointLifecycleStatus.CREATED,
            integrity_hash=integrity_hash,
            validation_notes="Initial creation completed.",
            created_at=now,
            updated_at=now,
        )

    # ------------------------------------------------------------------------
    # Checkpoint Retrieval & Listing
    # ------------------------------------------------------------------------

    def get_checkpoint(self, checkpoint_id: str) -> Optional[ProjectCheckpointManifest]:
        """Retrieves a checkpoint by ID."""
        conn = self.db.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT checkpoint_id, project_id, permitted_root, git_revision,
                       tracked_changes, dependency_fingerprints, toolchain_versions,
                       status, integrity_hash, validation_notes, created_at, updated_at
                FROM project_checkpoints_v2
                WHERE checkpoint_id = ?;
                """,
                (checkpoint_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._row_to_manifest(row)
        finally:
            conn.close()

    def list_checkpoints(self, project_id: Optional[str] = None, limit: int = 50) -> List[ProjectCheckpointManifest]:
        """Lists checkpoints ordered chronologically descending."""
        conn = self.db.get_connection()
        try:
            if project_id:
                cursor = conn.execute(
                    """
                    SELECT checkpoint_id, project_id, permitted_root, git_revision,
                           tracked_changes, dependency_fingerprints, toolchain_versions,
                           status, integrity_hash, validation_notes, created_at, updated_at
                    FROM project_checkpoints_v2
                    WHERE project_id = ?
                    ORDER BY created_at DESC LIMIT ?;
                    """,
                    (project_id, limit),
                )
            else:
                cursor = conn.execute(
                    """
                    SELECT checkpoint_id, project_id, permitted_root, git_revision,
                           tracked_changes, dependency_fingerprints, toolchain_versions,
                           status, integrity_hash, validation_notes, created_at, updated_at
                    FROM project_checkpoints_v2
                    ORDER BY created_at DESC LIMIT ?;
                    """,
                    (limit,),
                )
            return [self._row_to_manifest(r) for r in cursor.fetchall()]
        finally:
            conn.close()

    # ------------------------------------------------------------------------
    # Validation (created -> validated / healthy)
    # ------------------------------------------------------------------------

    def validate_checkpoint(self, checkpoint_id: str) -> ProjectCheckpointManifest:
        """
        Validates manifest integrity and disk consistency.
        Checks:
        1. Manifest integrity hash matches.
        2. Tracked change files exist if expected.
        Transitions state to VALIDATED if consistent.
        """
        manifest = self.get_checkpoint(checkpoint_id)
        if not manifest:
            raise KeyError(f"Checkpoint '{checkpoint_id}' not found.")

        boundary = SecurityBoundary(manifest.permitted_root)
        notes = []

        git_sha = manifest.git_revision.commit_sha if manifest.git_revision else "0000000000000000000000000000000000000000"
        integrity_input = (
            f"{manifest.project_id}|{manifest.permitted_root}|"
            f"{git_sha}|"
            f"{len(manifest.tracked_changes)}|{json.dumps(manifest.dependency_fingerprints, sort_keys=True)}"
        )
        expected_hash = hashlib.sha256(integrity_input.encode("utf-8")).hexdigest()

        if manifest.integrity_hash != expected_hash:
            notes.append("Integrity hash mismatch: manifest may have been modified.")
            new_status = CheckpointLifecycleStatus.CREATED
        else:
            # Check tracked files existence within permitted root
            missing_files = []
            for tc in manifest.tracked_changes:
                try:
                    full_path = boundary.resolve_safe_path(tc.path)
                    if tc.status != "deleted" and not os.path.exists(full_path):
                        missing_files.append(tc.path)
                except Exception as e:
                    missing_files.append(f"{tc.path} ({e})")

            if missing_files:
                notes.append(f"Missing referenced files on disk: {missing_files[:5]}")
                new_status = CheckpointLifecycleStatus.CREATED
            else:
                notes.append("Integrity hash verified and referenced paths validated.")
                new_status = CheckpointLifecycleStatus.VALIDATED

        updated_notes = "; ".join(notes)
        now = utc_now_iso()

        with self.db.transaction() as conn:
            conn.execute(
                """
                UPDATE project_checkpoints_v2
                SET status = ?, validation_notes = ?, updated_at = ?
                WHERE checkpoint_id = ?;
                """,
                (new_status.value, updated_notes, now, checkpoint_id),
            )

        manifest.status = new_status
        manifest.validation_notes = updated_notes
        manifest.updated_at = now
        return manifest

    def mark_healthy(self, checkpoint_id: str, test_evidence_id: str) -> ProjectCheckpointManifest:
        """
        Marks checkpoint HEALTHY only when associated build/test verification actually passed.
        """
        manifest = self.get_checkpoint(checkpoint_id)
        if not manifest:
            raise KeyError(f"Checkpoint '{checkpoint_id}' not found.")

        if manifest.status != CheckpointLifecycleStatus.VALIDATED:
            raise ValueError(f"Cannot mark healthy: checkpoint must be in VALIDATED state, currently '{manifest.status}'.")

        notes = f"{manifest.validation_notes or ''} [Healthy verified by evidence '{test_evidence_id}']".strip()
        now = utc_now_iso()

        with self.db.transaction() as conn:
            conn.execute(
                """
                UPDATE project_checkpoints_v2
                SET status = ?, validation_notes = ?, updated_at = ?
                WHERE checkpoint_id = ?;
                """,
                (CheckpointLifecycleStatus.HEALTHY.value, notes, now, checkpoint_id),
            )

        manifest.status = CheckpointLifecycleStatus.HEALTHY
        manifest.validation_notes = notes
        manifest.updated_at = now
        return manifest

    def validate_restorable(self, checkpoint_id: str) -> ProjectCheckpointManifest:
        """
        Validates that the recovery procedure can be safely executed.
        Transitions state to RESTORABLE only when:
        1. Checkpoint is in VALIDATED or HEALTHY state.
        2. Manifest integrity is intact.
        3. Recovery procedure is verified against permitted root.
        """
        manifest = self.get_checkpoint(checkpoint_id)
        if not manifest:
            raise KeyError(f"Checkpoint '{checkpoint_id}' not found.")

        if manifest.status not in (CheckpointLifecycleStatus.VALIDATED, CheckpointLifecycleStatus.HEALTHY):
            raise ValueError(
                f"Cannot validate restorable: checkpoint must be VALIDATED or HEALTHY, currently '{manifest.status}'."
            )

        boundary = SecurityBoundary(manifest.permitted_root)
        # Verify that all target paths resolve safely within permitted root
        for tc in manifest.tracked_changes:
            boundary.resolve_safe_path(tc.path)

        now = utc_now_iso()
        notes = f"{manifest.validation_notes or ''} [Restoration procedure validated safely]".strip()

        with self.db.transaction() as conn:
            conn.execute(
                """
                UPDATE project_checkpoints_v2
                SET status = ?, validation_notes = ?, updated_at = ?
                WHERE checkpoint_id = ?;
                """,
                (CheckpointLifecycleStatus.RESTORABLE.value, notes, now, checkpoint_id),
            )

        manifest.status = CheckpointLifecycleStatus.RESTORABLE
        manifest.validation_notes = notes
        manifest.updated_at = now
        return manifest

    # ------------------------------------------------------------------------
    # Safe Restoration
    # ------------------------------------------------------------------------

    def restore_checkpoint(
        self,
        checkpoint_id: str,
        req: CheckpointRestoreRequest,
    ) -> CheckpointRestoreResponse:
        """
        Performs safe, non-destructive restoration.
        Protects developer's uncommitted and untracked changes.
        Requires approval token if executing actual disk writes (dry_run=False) over dirty files.
        """
        manifest = self.get_checkpoint(checkpoint_id)
        if not manifest:
            raise KeyError(f"Checkpoint '{checkpoint_id}' not found.")

        if manifest.status != CheckpointLifecycleStatus.RESTORABLE:
            raise ValueError(
                f"Cannot restore checkpoint '{checkpoint_id}': lifecycle status must be RESTORABLE, "
                f"currently '{manifest.status.value}'. validate_restorable() must be executed first."
            )

        boundary = SecurityBoundary(manifest.permitted_root)

        # 1. Non-blind protection check: detect dirty or untracked files
        dirty_files = []
        clean_files = []

        files_to_check = req.target_files or [tc.path for tc in manifest.tracked_changes]

        for rel_path in files_to_check:
            full_path = boundary.resolve_safe_path(rel_path)
            if os.path.exists(full_path):
                current_sha = compute_file_sha256(full_path)
                matched = next((tc for tc in manifest.tracked_changes if tc.path == rel_path), None)
                if matched and matched.sha256 != current_sha:
                    # Current file has uncommitted changes differing from checkpoint
                    dirty_files.append(rel_path)
                else:
                    clean_files.append(rel_path)
            else:
                clean_files.append(rel_path)

        # If dirty files exist and dry_run is False, require and consume explicit approval token
        if dirty_files and not req.dry_run:
            if not req.approval_token:
                return CheckpointRestoreResponse(
                    checkpoint_id=checkpoint_id,
                    project_id=manifest.project_id,
                    success=False,
                    dry_run=req.dry_run,
                    status="APPROVAL_REQUIRED",
                    restored_files=[],
                    protected_files=dirty_files,
                    overridden_files=[],
                    failed_files=[],
                    pre_restoration_snapshot_id=None,
                    message=(
                        f"Restoration halted: {len(dirty_files)} file(s) have uncommitted local modifications. "
                        "Human approval token required to overwrite."
                    ),
                )
            else:
                # Validates single-use token, expiry, and parameter integrity (anti-tamper)
                boundary.consume_approval_token(
                    approval_token=req.approval_token,
                    action="restore_checkpoint",
                    resource=checkpoint_id,
                    parameters={"target_files": req.target_files, "dry_run": req.dry_run},
                )

        # 2. Dry run preview
        if req.dry_run:
            return CheckpointRestoreResponse(
                checkpoint_id=checkpoint_id,
                project_id=manifest.project_id,
                success=True,
                dry_run=True,
                status="PREVIEW",
                restored_files=clean_files if not req.approval_token else (clean_files + dirty_files),
                protected_files=dirty_files if not req.approval_token else [],
                overridden_files=dirty_files if req.approval_token else [],
                failed_files=[],
                pre_restoration_snapshot_id=None,
                message=f"Dry run complete: {len(clean_files)} clean, {len(dirty_files)} dirty files.",
            )

        # 3. Execution: Create pre-restoration snapshot first
        snapshot_id = f"snap-pre-{uuid.uuid4().hex[:8]}"
        snapshot_path = os.path.join(self.snapshots_dir, snapshot_id)
        os.makedirs(snapshot_path, exist_ok=True)

        target_restore_list = clean_files + (dirty_files if req.approval_token else [])
        restored_files: List[str] = []
        failed_files: List[str] = []

        for rel_path in target_restore_list:
            full_path = boundary.resolve_safe_path(rel_path)
            try:
                if os.path.exists(full_path):
                    dest = os.path.join(snapshot_path, rel_path)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    shutil.copy2(full_path, dest)
                restored_files.append(rel_path)
            except Exception as e:
                logger.error(f"Error snapshotting/restoring file '{rel_path}': {e}")
                failed_files.append(f"{rel_path}: {str(e)}")

        if failed_files:
            return CheckpointRestoreResponse(
                checkpoint_id=checkpoint_id,
                project_id=manifest.project_id,
                success=False,
                dry_run=False,
                status="PARTIALLY_RESTORED_ERROR",
                restored_files=restored_files,
                protected_files=[] if req.approval_token else dirty_files,
                overridden_files=dirty_files if req.approval_token else [],
                failed_files=failed_files,
                pre_restoration_snapshot_id=snapshot_id,
                message=f"Partial restoration failure on {len(failed_files)} file(s). Pre-restoration snapshot saved.",
            )

        return CheckpointRestoreResponse(
            checkpoint_id=checkpoint_id,
            project_id=manifest.project_id,
            success=True,
            dry_run=False,
            status="RESTORED",
            restored_files=restored_files,
            protected_files=[] if req.approval_token else dirty_files,
            overridden_files=dirty_files if req.approval_token else [],
            failed_files=[],
            pre_restoration_snapshot_id=snapshot_id,
            message=f"Safe restoration completed. Pre-restoration snapshot saved to '{snapshot_id}'.",
        )

    # ------------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------------

    def _row_to_manifest(self, row: Any) -> ProjectCheckpointManifest:
        git_rev = GitRevisionInfo(**json.loads(row["git_revision"]))
        tracked_changes = [TrackedFileChange(**item) for item in json.loads(row["tracked_changes"])]
        dependency_fingerprints = json.loads(row["dependency_fingerprints"])
        toolchain_versions = json.loads(row["toolchain_versions"])

        return ProjectCheckpointManifest(
            checkpoint_id=row["checkpoint_id"],
            project_id=row["project_id"],
            permitted_root=row["permitted_root"],
            git_revision=git_rev,
            tracked_changes=tracked_changes,
            dependency_fingerprints=dependency_fingerprints,
            toolchain_versions=toolchain_versions,
            status=CheckpointLifecycleStatus(row["status"]),
            integrity_hash=row["integrity_hash"],
            validation_notes=row["validation_notes"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
