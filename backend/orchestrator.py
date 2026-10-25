"""
Task Orchestrator & Execution Engine for Project MEMORAG.
Milestone 6 Handshake:
- Manages DAG execution lifecycle and checkpoints.
- Emits real-time task progress and approval events over SSE streams.
- Manages approval gates and successfully resumes paused DAG branches when approved.
"""

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.memory.models import RiskLevel, TaskCheckpoint, TaskStatus
from app.memory.permissions import PermissionGateway
from app.memory.recovery import TaskRecoveryManager
from backend.planner import DAGStep, TaskDAG

logger = logging.getLogger(__name__)


class TaskOrchestrator:
    """
    Stateful orchestrator for executing TaskDAGs, emitting real-time events,
    and managing human approval checkpoints.
    """

    def __init__(
        self,
        recovery_manager: Optional[TaskRecoveryManager] = None,
        permission_gateway: Optional[PermissionGateway] = None,
    ):
        self.recovery_manager = recovery_manager
        self.permission_gateway = permission_gateway

        # Active tasks: task_id -> TaskDAG
        self.tasks: Dict[str, TaskDAG] = {}

        # SSE subscriber queues: task_id -> List[asyncio.Queue]
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}

        # Pending approvals: approval_id -> metadata
        self._pending_approvals: Dict[str, Dict[str, Any]] = {}

    def register_task(self, dag: TaskDAG) -> None:
        """Registers a newly planned TaskDAG with the orchestrator."""
        self.tasks[dag.task_id] = dag
        self._save_checkpoint(dag)

    def get_task(self, task_id: str) -> Optional[TaskDAG]:
        """Retrieves an active or completed TaskDAG."""
        return self.tasks.get(task_id)

    def list_tasks(self) -> List[TaskDAG]:
        """Lists all registered tasks."""
        return list(self.tasks.values())

    def list_pending_approvals(self) -> List[Dict[str, Any]]:
        """Lists all actions currently awaiting human authorization."""
        return list(self._pending_approvals.values())

    # =========================================================================
    # SSE Event Broadcasting & Subscriptions
    # =========================================================================

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """Subscribes an SSE connection to events for a specific task."""
        queue: asyncio.Queue = asyncio.Queue()
        if task_id not in self._subscribers:
            self._subscribers[task_id] = []
        self._subscribers[task_id].append(queue)
        return queue

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """Removes a subscriber queue upon SSE disconnection."""
        if task_id in self._subscribers and queue in self._subscribers[task_id]:
            self._subscribers[task_id].remove(queue)
            if not self._subscribers[task_id]:
                del self._subscribers[task_id]

    async def broadcast_event(self, task_id: str, event_type: str, data: Dict[str, Any]) -> None:
        """Broadcasts an event to all connected SSE clients for this task."""
        payload = {
            "task_id": task_id,
            "event": event_type,
            "data": data,
        }
        if task_id in self._subscribers:
            for q in list(self._subscribers[task_id]):
                try:
                    q.put_nowait(payload)
                except Exception as e:
                    logger.debug(f"Failed to queue event for subscriber: {e}")

    async def event_generator(self, task_id: str) -> AsyncGenerator[str, None]:
        """
        Asynchronous generator yielding formatted Server-Sent Events (SSE)
        for GET /api/tasks/{task_id}/events/stream.
        """
        queue = self.subscribe(task_id)
        task = self.get_task(task_id)

        try:
            # Yield initial connection greeting & task state
            initial_data = {
                "task_id": task_id,
                "status": task.status if task else "UNKNOWN",
                "goal": task.goal if task else "",
                "step_count": len(task.steps) if task else 0,
            }
            yield f"event: task_connected\ndata: {json.dumps(initial_data)}\n\n"

            # Check if any steps are currently awaiting approval
            if task:
                for step in task.steps:
                    if step.status == "PAUSED_APPROVAL" and step.approval_id:
                        appr_evt = {
                            "task_id": task_id,
                            "step_id": step.step_id,
                            "approval_id": step.approval_id,
                            "action": step.skill_name,
                            "title": step.title,
                            "risk_level": step.risk_level.value if hasattr(step.risk_level, "value") else str(step.risk_level),
                        }
                        yield f"event: approval_required\ndata: {json.dumps(appr_evt)}\n\n"

            # Stream incoming real-time events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    evt_type = event.get("event", "message")
                    evt_data = event.get("data", {})
                    yield f"event: {evt_type}\ndata: {json.dumps(evt_data)}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": ping\n\n"
        finally:
            self.unsubscribe(task_id, queue)

    # =========================================================================
    # Task Execution & Approval Resumption
    # =========================================================================

    async def start_task(self, task_id: str) -> None:
        """Begins DAG execution for a registered task."""
        task = self.get_task(task_id)
        if not task:
            raise KeyError(f"Task '{task_id}' not found.")

        task.status = "RUNNING"
        await self.broadcast_event(
            task_id,
            "task_started",
            {"task_id": task_id, "status": "RUNNING", "goal": task.goal},
        )
        self._save_checkpoint(task)

        # Trigger initial runnable steps
        await self._advance_dag(task)

    async def _advance_dag(self, task: TaskDAG) -> None:
        """Evaluates DAG dependencies and advances eligible steps."""
        completed_step_ids = {s.step_id for s in task.steps if s.status == "COMPLETED"}

        all_completed = True
        any_paused = False

        for step in task.steps:
            if step.status == "COMPLETED":
                continue

            all_completed = False

            if step.status == "PAUSED_APPROVAL":
                any_paused = True
                continue

            if step.status == "PENDING":
                # Check if all dependencies are satisfied
                deps_met = all(dep in completed_step_ids for dep in step.dependencies)
                if deps_met:
                    if step.requires_approval:
                        # Pause for approval
                        await self._pause_step_for_approval(task, step)
                        any_paused = True
                    else:
                        # Run low-risk step
                        await self._execute_step(task, step)
                        # Re-run advance to pick up newly unlocked dependents
                        await self._advance_dag(task)
                        return

        if any_paused:
            task.status = "PAUSED_APPROVAL"
        elif all_completed and len(task.steps) > 0:
            task.status = "COMPLETED"
            await self.broadcast_event(
                task.task_id,
                "task_completed",
                {"task_id": task.task_id, "status": "COMPLETED"},
            )

        self._save_checkpoint(task)

    async def _pause_step_for_approval(self, task: TaskDAG, step: DAGStep) -> None:
        """Transitions step into PAUSED_APPROVAL and registers pending approval."""
        approval_id = f"apr-{uuid.uuid4().hex[:10]}"
        step.status = "PAUSED_APPROVAL"
        step.approval_id = approval_id

        # Register pending approval record
        self._pending_approvals[approval_id] = {
            "approval_id": approval_id,
            "task_id": task.task_id,
            "step_id": step.step_id,
            "title": step.title,
            "action": step.skill_name,
            "risk_level": step.risk_level.value if hasattr(step.risk_level, "value") else str(step.risk_level),
            "parameters": step.parameters,
            "created_at": task.updated_at,
        }

        # Flush SSE event for human confirmation
        await self.broadcast_event(
            task.task_id,
            "approval_required",
            {
                "task_id": task.task_id,
                "step_id": step.step_id,
                "approval_id": approval_id,
                "title": step.title,
                "action": step.skill_name,
                "risk_level": step.risk_level.value if hasattr(step.risk_level, "value") else str(step.risk_level),
                "parameters": step.parameters,
            },
        )

        logger.info(f"Task {task.task_id} step {step.step_id} PAUSED for approval: {approval_id}")

    async def _execute_step(self, task: TaskDAG, step: DAGStep) -> None:
        """Executes a single step and records completion."""
        step.status = "RUNNING"
        await self.broadcast_event(
            task.task_id,
            "step_progress",
            {"task_id": task.task_id, "step_id": step.step_id, "status": "RUNNING", "title": step.title},
        )

        # Simulate execution output
        step.output = f"Executed {step.skill_name} successfully."
        step.status = "COMPLETED"

        await self.broadcast_event(
            task.task_id,
            "step_completed",
            {
                "task_id": task.task_id,
                "step_id": step.step_id,
                "status": "COMPLETED",
                "output": step.output,
            },
        )

    async def resume_approval(
        self,
        approval_id: str,
        decision: str = "approved",
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Milestone 6:
        POST /api/approvals/{approval_id} endpoint execution.
        Resumes the paused DAG branch when approved.
        """
        if approval_id not in self._pending_approvals:
            raise KeyError(f"Approval ID '{approval_id}' not found or already processed.")

        appr_info = self._pending_approvals.pop(approval_id)
        task_id = appr_info["task_id"]
        step_id = appr_info["step_id"]

        task = self.get_task(task_id)
        if not task:
            raise KeyError(f"Associated task '{task_id}' not found.")

        # Locate paused step
        target_step = next((s for s in task.steps if s.step_id == step_id), None)
        if not target_step:
            raise KeyError(f"Associated step '{step_id}' not found in task {task_id}.")

        if decision.lower() == "approved":
            # Grant permission in Gateway if available
            if self.permission_gateway:
                self.permission_gateway.grant_approval(
                    action=target_step.skill_name,
                    resource=str(target_step.parameters.get("path", "*")),
                )

            # Flush approval granted event over SSE
            await self.broadcast_event(
                task_id,
                "approval_granted",
                {
                    "task_id": task_id,
                    "approval_id": approval_id,
                    "step_id": step_id,
                    "decision": "approved",
                    "notes": notes,
                },
            )

            # Resume paused step
            target_step.status = "RUNNING"
            await self.broadcast_event(
                task_id,
                "step_resumed",
                {"task_id": task_id, "step_id": step_id, "status": "RUNNING"},
            )

            target_step.output = f"Authorized execution of {target_step.skill_name} completed."
            target_step.status = "COMPLETED"

            await self.broadcast_event(
                task_id,
                "step_completed",
                {"task_id": task_id, "step_id": step_id, "status": "COMPLETED", "output": target_step.output},
            )

            # Advance remaining DAG steps
            task.status = "RUNNING"
            await self._advance_dag(task)

            return {
                "success": True,
                "approval_id": approval_id,
                "status": "approved",
                "resumed_task_id": task_id,
                "step_id": step_id,
                "task_status": task.status,
            }
        else:
            # Rejection
            target_step.status = "REJECTED"
            task.status = "FAILED"
            await self.broadcast_event(
                task_id,
                "approval_rejected",
                {"task_id": task_id, "approval_id": approval_id, "step_id": step_id, "notes": notes},
            )
            self._save_checkpoint(task)
            return {
                "success": True,
                "approval_id": approval_id,
                "status": "rejected",
                "resumed_task_id": task_id,
                "step_id": step_id,
                "task_status": "FAILED",
            }

    def _save_checkpoint(self, task: TaskDAG) -> None:
        """Persists task checkpoint using TaskRecoveryManager if initialized."""
        if not self.recovery_manager:
            return

        status_mapping = {
            "PENDING": TaskStatus.PENDING,
            "RUNNING": TaskStatus.RUNNING,
            "PAUSED_APPROVAL": TaskStatus.PAUSED,
            "COMPLETED": TaskStatus.COMPLETED,
            "FAILED": TaskStatus.FAILED,
        }
        current_step_id = next(
            (s.step_id for s in task.steps if s.status in ("RUNNING", "PAUSED_APPROVAL")),
            task.steps[0].step_id if task.steps else "start",
        )

        chk = TaskCheckpoint(
            task_id=task.task_id,
            workflow_id=task.task_id,
            status=status_mapping.get(task.status, TaskStatus.RUNNING),
            current_step=current_step_id,
            completed_step_ids=[s.step_id for s in task.steps if s.status == "COMPLETED"],
            pending_step_ids=[s.step_id for s in task.steps if s.status in ("PENDING", "PAUSED_APPROVAL")],
            state_data={"goal": task.goal, "model": task.model},
        )
        try:
            self.recovery_manager.save_task_checkpoint(chk)
        except Exception as e:
            logger.debug(f"Unable to write recovery checkpoint: {e}")
