"""
Task persistence, checkpointing, and crash recovery subsystem.
Enforces explicit state transitions and an idempotency guard to prevent re-execution of completed side effects.
"""

import hashlib
import json
import logging
import uuid
from typing import Any, Dict, List, Optional
from app.memory.crypto import EncryptionService
from app.memory.database import DatabaseManager, utc_now
from app.memory.models import TaskCheckpoint, TaskExecutionEvent, TaskStatus
from app.memory.repository import MemoryRepository

logger = logging.getLogger(__name__)


def compute_action_hash(action: str, params: Dict[str, Any]) -> str:
    """Computes a deterministic SHA-256 hash representing an external side-effect invocation."""
    canonical_params = json.dumps(params, sort_keys=True, ensure_ascii=False)
    raw = f"{action}::{canonical_params}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class TaskRecoveryManager:
    """
    Manages transactional workflow state persistence and reboot recovery.
    All task state variables are encrypted at rest with Fernet.
    """

    def __init__(self, db: DatabaseManager, crypto: EncryptionService):
        self.db = db
        self.crypto = crypto
        self.repo = MemoryRepository(db)

    def save_task_checkpoint(self, checkpoint: TaskCheckpoint) -> None:
        """
        Encrypts state_data and writes task checkpoint to SQLite.
        """
        checkpoint.updated_at = utc_now()
        encrypted_state = self.crypto.encrypt_json(checkpoint.state_data)
        self.repo.save_task_checkpoint(checkpoint, encrypted_state)

    def get_task_checkpoint(self, task_id: str) -> Optional[TaskCheckpoint]:
        """Fetches and decrypts a specific task checkpoint."""
        row = self.repo.get_task_checkpoint_row(task_id)
        if not row:
            return None
        return self._row_to_checkpoint(row)

    def load_incomplete_tasks(self) -> List[TaskCheckpoint]:
        """
        Loads all tasks that were in progress (PENDING, RUNNING, PAUSED, REQUIRES_RECONCILIATION)
        prior to process shutdown or crash.
        """
        rows = self.repo.list_incomplete_task_rows()
        tasks: List[TaskCheckpoint] = []
        for r in rows:
            try:
                tasks.append(self._row_to_checkpoint(r))
            except Exception as e:
                logger.error(f"Failed to decrypt task checkpoint {r['task_id']}: {e}")
        return tasks

    def record_execution_event(
        self,
        task_id: str,
        step_id: str,
        action: str,
        status: str,
        input_params: Dict[str, Any],
        output_details: Dict[str, Any],
    ) -> TaskExecutionEvent:
        """
        Records an execution event with an idempotency hash.
        Encrypts output/error details at rest.
        """
        idempotency_hash = compute_action_hash(action, input_params)
        event_id = str(uuid.uuid4())
        now = utc_now()

        encrypted_details = self.crypto.encrypt_json(output_details)

        event = TaskExecutionEvent(
            event_id=event_id,
            task_id=task_id,
            step_id=step_id,
            action=action,
            status=status,
            idempotency_hash=idempotency_hash,
            details=output_details,
            recorded_at=now,
        )

        self.repo.save_execution_event(event, encrypted_details)
        return event

    def is_step_already_executed(
        self,
        task_id: str,
        step_id: str,
        idempotency_hash: Optional[str] = None,
    ) -> bool:
        """
        Idempotency Guard:
        Verifies whether a step has already been completed in the task DAG
        or if an identical side-effect has already been committed.
        """
        chk = self.get_task_checkpoint(task_id)
        if chk and step_id in chk.completed_step_ids:
            return True

        if idempotency_hash:
            row = self.repo.get_execution_event_by_hash(idempotency_hash)
            if row and row["status"] == "SUCCESS":
                return True

        return False

    def mark_step_completed(
        self,
        task_id: str,
        step_id: str,
        next_step: Optional[str] = None,
        state_updates: Optional[Dict[str, Any]] = None,
    ) -> TaskCheckpoint:
        """
        Transitions a step to completed.
        Removes step from pending_step_ids, appends to completed_step_ids,
        updates state_data, and sets next_step.
        """
        chk = self.get_task_checkpoint(task_id)
        if not chk:
            raise KeyError(f"Task with ID '{task_id}' not found.")

        if step_id not in chk.completed_step_ids:
            chk.completed_step_ids.append(step_id)

        if step_id in chk.pending_step_ids:
            chk.pending_step_ids.remove(step_id)

        if next_step:
            chk.current_step = next_step
        elif not chk.pending_step_ids:
            chk.status = TaskStatus.COMPLETED

        if state_updates:
            chk.state_data.update(state_updates)

        self.save_task_checkpoint(chk)
        return chk

    def flag_for_reconciliation(self, task_id: str, reason: str) -> TaskCheckpoint:
        """
        Flags an ambiguous or partially failed side effect for human reconciliation.
        Prevents any automated re-execution until human intervention.
        """
        chk = self.get_task_checkpoint(task_id)
        if not chk:
            raise KeyError(f"Task with ID '{task_id}' not found.")

        chk.status = TaskStatus.REQUIRES_RECONCILIATION
        chk.state_data["reconciliation_reason"] = reason
        chk.state_data["reconciliation_flagged_at"] = utc_now()
        self.save_task_checkpoint(chk)
        return chk

    # =========================================================================
    # Helpers
    # =========================================================================

    def _row_to_checkpoint(self, row: Any) -> TaskCheckpoint:
        """Decrypts and converts SQLite row into TaskCheckpoint."""
        decrypted_state = self.crypto.decrypt_json(row["encrypted_state"])
        return TaskCheckpoint(
            task_id=row["task_id"],
            workflow_id=row["workflow_id"],
            status=TaskStatus(row["status"]),
            current_step=row["current_step"],
            completed_step_ids=json.loads(row["completed_step_ids"]),
            pending_step_ids=json.loads(row["pending_step_ids"]),
            approval_references=json.loads(row["approval_references"]),
            retry_count=row["retry_count"],
            state_data=decrypted_state,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
