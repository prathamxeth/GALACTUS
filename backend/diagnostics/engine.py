"""
MEMORAG Forge — Diagnostic & Evidence-Based Repair Engine.
Orchestrates constrained inspection, evidence extraction, approval-gated repair,
post-action verification, and safe rollback recovery.
"""

import difflib
import hashlib
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
import httpx

from app.memory.models import MemoryType, RiskLevel
from app.memory.service import MemoryService, query_relevant_context
from backend.diagnostics.inspector import ProjectInspector, SecurityViolationError
from backend.diagnostics.models import (
    DiagnosticReport,
    DiagnosticSourceType,
    EvidenceFinding,
    FindingCategory,
    FindingStatus,
    FlightRecorderEvent,
    ProposedAction,
    RecoveryOption,
    RepairProposal,
    VerificationResult,
    utc_now_iso,
)

logger = logging.getLogger(__name__)


class DiagnosticEngine:
    """
    Core engine for MEMORAG Forge evidence-based diagnosis and approval-gated repair.
    Emits durable flight recorder events to Sentinel and live events over SSE.
    """

    def __init__(
        self,
        memory_service: Optional[MemoryService] = None,
        event_broadcaster: Optional[Callable[[str, str, Dict[str, Any]], Any]] = None,
        model: Optional[str] = None,
        ollama_endpoint: Optional[str] = None,
    ):
        self.memory_service = memory_service
        self.event_broadcaster = event_broadcaster
        self.model = model or os.environ.get("MEMORAG_MODEL") or "gemma4:e2b"
        self.ollama_endpoint = (ollama_endpoint or os.environ.get("OLLAMA_ENDPOINT", "http://127.0.0.1:11434")).rstrip("/")
        self._tasks: Dict[str, DiagnosticReport] = {}
        self._backups: Dict[str, Dict[str, str]] = {}  # task_id -> {file_path: original_content}
        self._approvals: Dict[str, Dict[str, Any]] = {}  # approval_id -> metadata
        self._flight_recorder_events: Dict[str, List[FlightRecorderEvent]] = {}

    def query_local_ollama_reasoning(self, prompt: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Attempts local Ollama inference for diagnostic reasoning.
        Returns (response_text, error_message).
        Uses environment-configurable timeouts (default 45s read, 5s connect) for reliable cold starts.
        If Ollama is offline or model is missing, returns (None, error_message) with an honest limitation description.
        """
        read_timeout = float(os.environ.get("MEMORAG_OLLAMA_TIMEOUT") or os.environ.get("OLLAMA_TIMEOUT") or 45.0)
        connect_timeout = float(os.environ.get("MEMORAG_OLLAMA_CONNECT_TIMEOUT") or os.environ.get("OLLAMA_CONNECT_TIMEOUT") or 5.0)
        try:
            timeout = httpx.Timeout(read_timeout, connect=connect_timeout)
            with httpx.Client(timeout=timeout) as client:
                res = client.post(
                    f"{self.ollama_endpoint}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    return data.get("response"), None
                elif res.status_code == 404:
                    return None, f"Configured model '{self.model}' is not available in local Ollama repository."
                else:
                    return None, f"Ollama returned HTTP {res.status_code}: {res.text[:100]}"
        except httpx.ConnectError:
            return None, "Ollama service unavailable: Local connection refused at 127.0.0.1:11434."
        except httpx.TimeoutException:
            return None, f"Ollama diagnostic reasoning timed out after {read_timeout}s."
        except Exception as e:
            return None, f"Ollama inference error: {str(e)}"

    def get_report(self, task_id: str) -> Optional[DiagnosticReport]:
        return self._tasks.get(task_id)

    def get_flight_recorder_events(self, task_id: str) -> List[FlightRecorderEvent]:
        # Return in-memory cache if available
        if task_id in self._flight_recorder_events and self._flight_recorder_events[task_id]:
            return self._flight_recorder_events[task_id]

        # Query durable episodic store in Sentinel across backend restarts
        if self.memory_service:
            try:
                records = self.memory_service.search_memories(
                    query=task_id,
                    memory_type=MemoryType.EPISODIC,
                    limit=200,
                )
                events = []
                for rec in records:
                    payload = rec.payload or {}
                    if payload.get("session_id") == task_id and "flight_recorder::" in (rec.category or ""):
                        evt_type = rec.category.replace("flight_recorder::", "")
                        source_id = rec.source_ref.replace("fre:", "") if rec.source_ref else rec.id
                        events.append(
                            FlightRecorderEvent(
                                event_id=source_id,
                                task_id=task_id,
                                event_type=evt_type,
                                timestamp=rec.created_at,
                                details=payload.get("content", {}),
                                evidence_refs=payload.get("metadata", {}).get("evidence_refs", []),
                            )
                        )
                events.sort(key=lambda e: e.timestamp)
                self._flight_recorder_events[task_id] = events
                return events
            except Exception as e:
                logger.debug(f"Failed to query durable flight recorder events from memory_service: {e}")

        return self._flight_recorder_events.get(task_id, [])

    async def _emit_event(
        self,
        task_id: str,
        event_type: str,
        details: Dict[str, Any],
        evidence_refs: Optional[List[str]] = None,
    ) -> FlightRecorderEvent:
        """
        Emits a durable flight recorder event:
        1. Persists to Sentinel's episodic store if available.
        2. Appends to task event history.
        3. Broadcasts over SSE to live clients.
        """
        event = FlightRecorderEvent(
            task_id=task_id,
            event_type=event_type,
            details=details,
            evidence_refs=evidence_refs or [],
        )

        if task_id not in self._flight_recorder_events:
            self._flight_recorder_events[task_id] = []
        self._flight_recorder_events[task_id].append(event)

        # Durable persistence via Sentinel MemoryService
        if self.memory_service:
            try:
                self.memory_service.store_event(
                    session_id=task_id,
                    event_type=f"flight_recorder::{event_type}",
                    content=details,
                    source_ref=f"fre:{event.event_id}",
                    metadata={"evidence_refs": event.evidence_refs},
                )
            except Exception as e:
                logger.debug(f"Sentinel memory store_event failed: {e}")

        # Broadcast SSE event
        if self.event_broadcaster:
            try:
                await self.event_broadcaster(task_id, event_type, {
                    "event_id": event.event_id,
                    "task_id": task_id,
                    "event_type": event_type,
                    "timestamp": event.timestamp,
                    "details": details,
                    "evidence_refs": event.evidence_refs,
                })
            except Exception as e:
                logger.debug(f"SSE event broadcast failed: {e}")

        return event

    async def run_diagnostic(
        self,
        project_root: str,
        user_request: str = "Diagnose build or test failures",
    ) -> DiagnosticReport:
        """
        Executes stages 1 through 10 of the project diagnostic workflow.
        Produces structured facts, hypotheses, and an approval-gated repair proposal.
        """
        task_id = f"diag-{uuid.uuid4().hex[:8]}"

        # Stage 1: Validate project root
        inspector = ProjectInspector(project_root)
        canonical_root = str(inspector.project_root)

        await self._emit_event(task_id, "diagnostic_task_created", {
            "task_id": task_id,
            "project_root": canonical_root,
            "user_request": user_request,
        })

        observed_facts: List[EvidenceFinding] = []
        hypotheses: List[EvidenceFinding] = []
        evidence_counter = 1

        # Stage 2: Request environment and git snapshot
        await self._emit_event(task_id, "project_inspection_started", {"project_root": canonical_root})

        # Check toolchain availability
        has_python = inspector.check_toolchain_availability("python")
        has_git = inspector.check_toolchain_availability("git")
        has_node = inspector.check_toolchain_availability("node")

        observed_facts.append(
            EvidenceFinding(
                finding_id=f"fnd-{evidence_counter}",
                task_id=task_id,
                category=FindingCategory.ENVIRONMENT_INSPECTION if has_python else FindingCategory.MISSING_TOOLCHAIN,
                summary=f"Host toolchain check: Python={has_python}, Git={has_git}, Node={has_node}",
                evidence_refs=[f"toolchain:python={has_python}", f"toolchain:git={has_git}"],
                source_type=DiagnosticSourceType.TOOLCHAIN_CHECK,
                confidence=1.0,
                status=FindingStatus.VERIFIED,
            )
        )
        evidence_counter += 1

        if not has_python:
            await self._emit_event(task_id, "check_failed", {"check": "toolchain_python", "status": "missing"})

        # Inspect Git state
        git_info = inspector.get_git_status_and_diff()
        if git_info["is_git_repo"]:
            observed_facts.append(
                EvidenceFinding(
                    finding_id=f"fnd-{evidence_counter}",
                    task_id=task_id,
                    category=FindingCategory.CONFIG_ERROR if git_info["modified_files"] else FindingCategory.ENVIRONMENT_INSPECTION,
                    summary=f"Git status inspected: {len(git_info['modified_files'])} modified file(s).",
                    evidence_refs=[f"git_status:{f}" for f in git_info["modified_files"]],
                    source_type=DiagnosticSourceType.GIT_DIFF,
                    confidence=1.0,
                    status=FindingStatus.VERIFIED,
                )
            )
            evidence_counter += 1

        await self._emit_event(task_id, "project_inspection_completed", {
            "project_root": canonical_root,
            "modified_files": git_info["modified_files"],
        })

        # Stage 3: Retrieve verified memory & constraints from Sentinel
        relevant_memories: List[Dict[str, Any]] = []
        if self.memory_service:
            try:
                mem_context = query_relevant_context(user_request, memory_service=self.memory_service)
                for f in mem_context.get("verified_facts", []):
                    relevant_memories.append({
                        "id": f.get("id"),
                        "type": "verified_fact",
                        "summary": f"{f.get('subject')} {f.get('predicate')}: {f.get('object_value')}",
                        "verification_status": f.get("verification_status", "verified"),
                    })
                for p in mem_context.get("preferences", []):
                    relevant_memories.append({
                        "id": p.get("id"),
                        "type": "preference",
                        "summary": f"{p.get('subject')} -> {p.get('predicate')}: {p.get('object_value')}",
                        "verification_status": p.get("verification_status", "user_provided"),
                    })
            except Exception as e:
                logger.debug(f"Memory context lookup failed: {e}")

        # Stage 5 & 6: Execute read-only diagnostic checks
        diagnostic_commands_to_run = []
        python_files = list(Path(canonical_root).glob("*.py")) + list(Path(canonical_root).glob("src/**/*.py"))

        for py_file in python_files[:5]:
            rel = str(py_file.relative_to(canonical_root)).replace("\\", "/")
            diagnostic_commands_to_run.append(f"python -m py_compile {rel}")

        # If tests directory exists, add pytest check
        if (Path(canonical_root) / "tests").exists():
            diagnostic_commands_to_run.append("python -m pytest -v")

        failed_checks = []
        passed_checks = []

        for cmd in diagnostic_commands_to_run:
            await self._emit_event(task_id, "command_started", {"command": cmd})
            code, stdout, stderr = inspector.execute_read_only_command(cmd)
            await self._emit_event(task_id, "command_completed", {
                "command": cmd,
                "exit_code": code,
                "output_snippet": (stderr or stdout)[:200],
            })

            ref_id = f"exec:{cmd}::code={code}"

            if code == 0:
                passed_checks.append(cmd)
                await self._emit_event(task_id, "check_passed", {"command": cmd})
            else:
                failed_checks.append((cmd, code, stdout, stderr))
                await self._emit_event(task_id, "check_failed", {
                    "command": cmd,
                    "exit_code": code,
                    "error": stderr or stdout,
                })

                # Record observed fact for the failure
                category = FindingCategory.SYNTAX_ERROR if "SyntaxError" in stderr or "py_compile" in cmd else FindingCategory.TEST_FAILURE
                observed_facts.append(
                    EvidenceFinding(
                        finding_id=f"fnd-{evidence_counter}",
                        task_id=task_id,
                        category=category,
                        summary=f"Command '{cmd}' failed with exit code {code}.",
                        evidence_refs=[ref_id, f"output:{stderr[:150]}"],
                        source_type=DiagnosticSourceType.COMMAND_OUTPUT,
                        confidence=1.0,
                        status=FindingStatus.VERIFIED,
                    )
                )
                evidence_counter += 1

        # Stage 7 & 8: Correlate observed failures and produce hypotheses
        repair_proposal: Optional[RepairProposal] = None

        if not failed_checks:
            # Healthy project or insufficient evidence
            if not diagnostic_commands_to_run:
                hypotheses.append(
                    EvidenceFinding(
                        finding_id=f"fnd-{evidence_counter}",
                        task_id=task_id,
                        category=FindingCategory.INSUFFICIENT_EVIDENCE,
                        summary="No build or test entry points identified to diagnose in this project.",
                        evidence_refs=[],
                        source_type=DiagnosticSourceType.STATIC_CHECK,
                        confidence=0.3,
                        status=FindingStatus.HYPOTHESIS,
                        limitations="No recognized Makefile, pytest, or npm configurations found.",
                    )
                )
            else:
                observed_facts.append(
                    EvidenceFinding(
                        finding_id=f"fnd-{evidence_counter}",
                        task_id=task_id,
                        category=FindingCategory.BUILD_FAILURE,
                        summary="All executed diagnostic verification checks passed. No active build errors detected.",
                        evidence_refs=[f"passed:{c}" for c in passed_checks],
                        source_type=DiagnosticSourceType.COMMAND_OUTPUT,
                        confidence=1.0,
                        status=FindingStatus.VERIFIED,
                    )
                )
        else:
            # Correlate failure to generate hypothesis and minimal repair proposal
            first_fail_cmd, first_code, first_stdout, first_stderr = failed_checks[0]

            # Example: Syntax error correlation
            match_syntax = re.search(r'File "([^"]+)", line (\d+)', first_stderr)
            if match_syntax or "py_compile" in first_fail_cmd:
                target_file_rel = first_fail_cmd.replace("python -m py_compile ", "").strip()
                line_no = int(match_syntax.group(2)) if match_syntax else 1
                # Attempt local Ollama inference or record honest limitation
                ollama_prompt = (
                    f"Diagnose the following build/test error in project:\n"
                    f"Command: {first_fail_cmd}\n"
                    f"Exit code: {first_code}\n"
                    f"Error output:\n{first_stderr[:400]}\n"
                    f"Provide a concise 1-sentence hypothesis and minimal safe fix."
                )
                ollama_thought, ollama_err = self.query_local_ollama_reasoning(ollama_prompt)

                if ollama_thought:
                    hypotheses.append(
                        EvidenceFinding(
                            finding_id=f"fnd-{evidence_counter}",
                            task_id=task_id,
                            category=FindingCategory.SYNTAX_ERROR,
                            summary=f"Model reasoning hypothesis: {ollama_thought.strip()[:150]}",
                            evidence_refs=[f"exec:{first_fail_cmd}::code={first_code}", f"stderr:{first_stderr[:100]}"],
                            source_type=DiagnosticSourceType.LLM_HYPOTHESIS,
                            confidence=0.85,
                            status=FindingStatus.HYPOTHESIS,
                            limitations="Model-generated hypothesis; unverified until post-repair checks pass.",
                        )
                    )
                    evidence_counter += 1
                elif ollama_err:
                    await self._emit_event(task_id, "hypothesis_produced", {
                        "fallback": "heuristic",
                        "limitation": ollama_err,
                    })

                hypotheses.append(
                    EvidenceFinding(
                        finding_id=f"fnd-{evidence_counter}",
                        task_id=task_id,
                        category=FindingCategory.SYNTAX_ERROR,
                        summary=f"Hypothesis: Python syntax corruption in {target_file_rel} around line {line_no}.",
                        evidence_refs=[f"exec:{first_fail_cmd}::code={first_code}", f"stderr:{first_stderr[:100]}"],
                        source_type=DiagnosticSourceType.STATIC_CHECK,
                        confidence=0.9,
                        status=FindingStatus.HYPOTHESIS,
                        limitations=f"Diagnostic limitation: {ollama_err}" if ollama_err else None,
                    )
                )
                evidence_counter += 1

                await self._emit_event(task_id, "hypothesis_produced", {
                    "hypothesis": f"Syntax error in {target_file_rel}",
                    "confidence": 0.9,
                })

                # Stage 9: Minimal repair proposal with unified diff
                try:
                    current_content = inspector.inspect_file_content(target_file_rel)
                    repaired_content = self._attempt_syntax_heuristic_repair(current_content, first_stderr)
                    if repaired_content != current_content:
                        diff = "".join(difflib.unified_diff(
                            current_content.splitlines(keepends=True),
                            repaired_content.splitlines(keepends=True),
                            fromfile=f"a/{target_file_rel}",
                            tofile=f"b/{target_file_rel}",
                        ))

                        approval_id = f"apr-diag-{uuid.uuid4().hex[:8]}"

                        repair_proposal = RepairProposal(
                            task_id=task_id,
                            summary=f"Fix syntax error in {target_file_rel}",
                            explanation=f"Replaced invalid syntax at line {line_no} observed during py_compile verification.",
                            supporting_evidence_ids=[f"fnd-{evidence_counter - 1}"],
                            files_to_modify=[target_file_rel],
                            exact_patch=diff,
                            actions=[
                                ProposedAction(
                                    action_type="file_patch",
                                    target_path=target_file_rel,
                                    diff_patch=diff,
                                    content=repaired_content,
                                    risk_level=RiskLevel.MEDIUM,
                                    requires_approval=True,
                                )
                            ],
                            risk_level=RiskLevel.MEDIUM,
                            requires_approval=True,
                            expected_verification_commands=[first_fail_cmd],
                            status="PENDING_APPROVAL",
                            approval_id=approval_id,
                        )

                        # Compute cryptographic hashes for patch integrity and disk validation
                        patch_hash = hashlib.sha256(diff.encode("utf-8")).hexdigest()
                        pre_diagnostic_hash = hashlib.sha256(current_content.encode("utf-8")).hexdigest()

                        # Stage 10: Register approval requirement bound to exact patch and disk state
                        self._approvals[approval_id] = {
                            "approval_id": approval_id,
                            "task_id": task_id,
                            "target_path": target_file_rel,
                            "patch": diff,
                            "patch_hash": patch_hash,
                            "pre_diagnostic_hash": pre_diagnostic_hash,
                            "expected_commands": [first_fail_cmd],
                            "status": "pending",
                        }

                        await self._emit_event(task_id, "repair_proposed", {
                            "proposal_id": repair_proposal.proposal_id,
                            "summary": repair_proposal.summary,
                            "files": repair_proposal.files_to_modify,
                        })
                        await self._emit_event(task_id, "approval_requested", {
                            "approval_id": approval_id,
                            "action": "file_patch",
                            "target_path": target_file_rel,
                        })
                except Exception as e:
                    logger.debug(f"Failed to generate heuristic repair: {e}")

        # Check recovery checkpoint availability
        recovery_options = []
        if repair_proposal and repair_proposal.files_to_modify:
            recovery_options.append(
                RecoveryOption(
                    task_id=task_id,
                    description=f"Restore pre-repair state of {', '.join(repair_proposal.files_to_modify)}",
                    is_available=True,
                )
            )

        status = "AWAITING_APPROVAL" if (repair_proposal and repair_proposal.requires_approval) else "DIAGNOSED"

        report = DiagnosticReport(
            task_id=task_id,
            project_root=canonical_root,
            user_request=user_request,
            observed_facts=observed_facts,
            relevant_memory=relevant_memories,
            hypotheses=hypotheses,
            proposed_repair=repair_proposal,
            approval_requirements={"approval_id": repair_proposal.approval_id} if repair_proposal else {},
            recovery_options=recovery_options,
            status=status,
        )

        self._tasks[task_id] = report
        return report

    def _attempt_syntax_heuristic_repair(self, content: str, error_trace: str) -> str:
        """Heuristic patch generator for common syntax errors in test projects."""
        lines = content.splitlines(keepends=True)
        # Check for unclosed parenthesis or missing colons
        new_lines = []
        for line in lines:
            # Common demo typo: 'def foo(' without '):'
            if line.strip().startswith("def ") and "(" in line and not line.strip().endswith(":"):
                if ")" not in line:
                    line = line.rstrip("\r\n") + "):\n"
                elif not line.strip().endswith(":"):
                    line = line.rstrip("\r\n") + ":\n"
            # Common demo typo: unclosed string
            elif line.count('"') % 2 == 1 and not line.strip().endswith('"""'):
                line = line.rstrip("\r\n") + '"\n'
            new_lines.append(line)
        return "".join(new_lines)

    async def execute_repair(
        self,
        task_id: str,
        approval_id: str,
        decision: str = "approved",
        operator_notes: Optional[str] = None,
    ) -> VerificationResult:
        """
        Stages 11 through 14:
        Validates approval, applies the repair, and reruns verification checks.
        """
        report = self.get_report(task_id)
        if not report:
            raise KeyError(f"Diagnostic task '{task_id}' not found.")

        if not report.proposed_repair:
            raise ValueError(f"Task '{task_id}' has no pending repair proposal.")

        proposal = report.proposed_repair

        # Stage 11: Validate approval integrity
        if proposal.approval_id != approval_id:
            raise SecurityViolationError(f"Stale or mismatched approval ID '{approval_id}'. Expected '{proposal.approval_id}'.")

        stored_appr = self._approvals.get(approval_id)
        if not stored_appr or stored_appr["status"] != "pending":
            raise SecurityViolationError(f"Approval '{approval_id}' is invalid, expired, or already consumed.")

        if decision.lower() != "approved":
            # Rejection
            stored_appr["status"] = "rejected"
            proposal.status = "REJECTED"
            report.status = "FAILED"
            await self._emit_event(task_id, "approval_rejected", {
                "approval_id": approval_id,
                "notes": operator_notes,
            })
            return VerificationResult(
                task_id=task_id,
                proposal_id=proposal.proposal_id,
                passed=False,
                summary="Repair rejected by human operator.",
            )

        # Verify patch integrity (approval is cryptographically bound to the exact patch)
        current_patch_hash = hashlib.sha256((proposal.exact_patch or "").encode("utf-8")).hexdigest()
        if current_patch_hash != stored_appr.get("patch_hash"):
            raise SecurityViolationError(
                f"Approval '{approval_id}' was authorized for a different patch hash. Re-authorization required."
            )

        # Mark approval consumed
        stored_appr["status"] = "consumed"
        proposal.status = "APPROVED"
        await self._emit_event(task_id, "approval_granted", {
            "approval_id": approval_id,
            "operator_notes": operator_notes,
        })

        # Stage 12: Execute approved action inside sandbox
        inspector = ProjectInspector(report.project_root)
        await self._emit_event(task_id, "repair_execution_started", {"proposal_id": proposal.proposal_id})

        if task_id not in self._backups:
            self._backups[task_id] = {}

        try:
            for action in proposal.actions:
                if action.action_type in ("file_patch", "file_write") and action.target_path:
                    resolved_file = inspector.validate_path_in_sandbox(action.target_path)

                    # Revalidate filesystem state immediately before mutation
                    # Prevent silently overwriting changes made by the developer after diagnosis
                    if resolved_file.exists():
                        with open(resolved_file, "r", encoding="utf-8", errors="replace") as f:
                            disk_content = f.read()
                        disk_hash = hashlib.sha256(disk_content.encode("utf-8")).hexdigest()
                        if disk_hash != stored_appr.get("pre_diagnostic_hash"):
                            raise SecurityViolationError(
                                f"Pre-mutation safety check failed: File '{action.target_path}' was modified on disk after diagnosis. "
                                f"Repair aborted to prevent silently overwriting developer changes. Please re-run diagnosis."
                            )
                        self._backups[task_id][action.target_path] = disk_content

                    # Write repaired content
                    if action.content is not None:
                        with open(resolved_file, "w", encoding="utf-8") as f:
                            f.write(action.content)

            proposal.status = "EXECUTED"
            await self._emit_event(task_id, "repair_execution_completed", {"proposal_id": proposal.proposal_id})

            # Stage 13: Rerun verification checks
            all_passed = True
            exit_codes = {}
            outputs = {}

            for cmd in proposal.expected_verification_commands:
                code, stdout, stderr = inspector.execute_read_only_command(cmd)
                exit_codes[cmd] = code
                outputs[cmd] = (stderr or stdout)[:500]
                if code != 0:
                    all_passed = False

            summary = "Post-repair verification PASSED." if all_passed else "Post-repair verification FAILED."
            ver_res = VerificationResult(
                task_id=task_id,
                proposal_id=proposal.proposal_id,
                passed=all_passed,
                commands_executed=proposal.expected_verification_commands,
                exit_codes=exit_codes,
                outputs=outputs,
                summary=summary,
            )

            report.verification_results = ver_res
            report.status = "VERIFIED" if all_passed else "FAILED"

            await self._emit_event(task_id, "verification_completed", {
                "passed": all_passed,
                "summary": summary,
                "exit_codes": exit_codes,
            })

            return ver_res

        except Exception as e:
            report.status = "FAILED"
            await self._emit_event(task_id, "repair_execution_failed", {"error": str(e)})
            raise

    async def recover_task(self, task_id: str) -> Dict[str, Any]:
        """
        Stage 14: Safe rollback recovery if repair failed and backup exists.
        """
        report = self.get_report(task_id)
        if not report:
            raise KeyError(f"Diagnostic task '{task_id}' not found.")

        backups = self._backups.get(task_id, {})
        if not backups:
            await self._emit_event(task_id, "recovery_failed", {"reason": "No valid recovery backup exists."})
            raise ValueError(f"No valid recovery checkpoint or backup available for task '{task_id}'.")

        await self._emit_event(task_id, "recovery_requested", {"task_id": task_id})
        inspector = ProjectInspector(report.project_root)

        try:
            restored_files = []
            for rel_path, orig_content in backups.items():
                resolved = inspector.validate_path_in_sandbox(rel_path)
                with open(resolved, "w", encoding="utf-8") as f:
                    f.write(orig_content)
                restored_files.append(rel_path)

            report.status = "RECOVERED"
            await self._emit_event(task_id, "recovery_completed", {"restored_files": restored_files})
            return {"success": True, "restored_files": restored_files, "status": "RECOVERED"}
        except Exception as e:
            await self._emit_event(task_id, "recovery_failed", {"error": str(e)})
            raise
