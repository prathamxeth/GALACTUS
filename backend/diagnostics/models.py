"""
MEMORAG Forge — Diagnostic & Evidence Contract Models.
Defines typed evidence findings, flight recorder events, repair proposals, and verification results.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.memory.models import RiskLevel


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class FindingCategory(str, Enum):
    SYNTAX_ERROR = "syntax_error"
    DEPENDENCY_MISMATCH = "dependency_mismatch"
    MISSING_TOOLCHAIN = "missing_toolchain"
    TEST_FAILURE = "test_failure"
    BUILD_FAILURE = "build_failure"
    CONFIG_ERROR = "config_error"
    PERMISSION_VIOLATION = "permission_violation"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    ENVIRONMENT_INSPECTION = "environment_inspection"
    UNKNOWN = "unknown"


class FindingStatus(str, Enum):
    VERIFIED = "verified"
    HYPOTHESIS = "hypothesis"
    DISPROVED = "disproved"


class DiagnosticSourceType(str, Enum):
    COMMAND_OUTPUT = "command_output"
    GIT_DIFF = "git_diff"
    ENVIRONMENT_INSPECTION = "environment_inspection"
    STATIC_CHECK = "static_check"
    MEMORY_VAULT = "memory_vault"
    TOOLCHAIN_CHECK = "toolchain_check"
    LLM_HYPOTHESIS = "llm_hypothesis"


class EvidenceFinding(BaseModel):
    """
    Evidence-backed diagnostic finding carrying full provenance.
    Never equates an LLM assertion with verified evidence.
    """
    finding_id: str = Field(default_factory=lambda: f"fnd-{uuid.uuid4().hex[:8]}")
    task_id: str
    category: FindingCategory
    summary: str
    evidence_refs: List[str] = Field(
        default_factory=list,
        description="References to actual command execution IDs, exit codes, diff lines, or tool outputs"
    )
    source_type: DiagnosticSourceType
    observed_at: str = Field(default_factory=utc_now_iso)
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    status: FindingStatus = Field(default=FindingStatus.VERIFIED)
    limitations: Optional[str] = Field(None, description="Known gaps or ambiguities in evidence")


class ProposedAction(BaseModel):
    """Specific single modification action within a repair proposal."""
    action_id: str = Field(default_factory=lambda: f"act-{uuid.uuid4().hex[:6]}")
    action_type: str = Field(..., description="'file_patch', 'file_write', 'install_package', 'command'")
    target_path: Optional[str] = None
    diff_patch: Optional[str] = None
    content: Optional[str] = None
    command: Optional[str] = None
    risk_level: RiskLevel = Field(default=RiskLevel.MEDIUM)
    requires_approval: bool = Field(default=True)


class RepairProposal(BaseModel):
    """
    Minimal, evidence-backed repair proposal.
    Requires explicit human approval before any file writes or mutations.
    """
    proposal_id: str = Field(default_factory=lambda: f"rep-{uuid.uuid4().hex[:8]}")
    task_id: str
    summary: str
    explanation: str
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    files_to_modify: List[str] = Field(default_factory=list)
    exact_patch: Optional[str] = Field(None, description="Unified diff patch of proposed changes")
    actions: List[ProposedAction] = Field(default_factory=list)
    risk_level: RiskLevel = Field(default=RiskLevel.MEDIUM)
    requires_approval: bool = Field(default=True)
    expected_verification_commands: List[str] = Field(default_factory=list)
    limitations: Optional[str] = None
    recovery_checkpoint_id: Optional[str] = None
    status: str = Field(default="PENDING_APPROVAL", description="'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED'")
    approval_id: Optional[str] = None


class VerificationResult(BaseModel):
    """Post-action verification execution result."""
    verification_id: str = Field(default_factory=lambda: f"ver-{uuid.uuid4().hex[:8]}")
    task_id: str
    proposal_id: Optional[str] = None
    passed: bool
    commands_executed: List[str] = Field(default_factory=list)
    exit_codes: Dict[str, int] = Field(default_factory=dict)
    outputs: Dict[str, str] = Field(default_factory=dict)
    summary: str
    executed_at: str = Field(default_factory=utc_now_iso)


class RecoveryOption(BaseModel):
    """Safe recovery / rollback option if repair fails."""
    recovery_id: str = Field(default_factory=lambda: f"rec-{uuid.uuid4().hex[:8]}")
    task_id: str
    description: str
    checkpoint_id: Optional[str] = None
    backup_path: Optional[str] = None
    is_available: bool = True
    recovery_command: Optional[str] = None


class DiagnosticReport(BaseModel):
    """
    Structured diagnostic report separating observed facts from hypotheses.
    """
    task_id: str
    project_root: str
    user_request: str
    observed_facts: List[EvidenceFinding] = Field(
        default_factory=list,
        description="Strictly observed outputs, real exit codes, and verifiable diffs"
    )
    relevant_memory: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Retrieved preferences and facts from Sentinel vault with verification status"
    )
    hypotheses: List[EvidenceFinding] = Field(
        default_factory=list,
        description="Plausible root cause hypotheses (never claimed as ground-truth facts)"
    )
    proposed_repair: Optional[RepairProposal] = None
    approval_requirements: Dict[str, Any] = Field(default_factory=dict)
    verification_results: Optional[VerificationResult] = None
    recovery_options: List[RecoveryOption] = Field(default_factory=list)
    status: str = Field(default="DIAGNOSED", description="'INSPECTING', 'DIAGNOSED', 'AWAITING_APPROVAL', 'REPAIRING', 'VERIFIED', 'FAILED', 'RECOVERED'")
    diagnosed_at: str = Field(default_factory=utc_now_iso)


class FlightRecorderEvent(BaseModel):
    """Durable Project Flight Recorder event compatible with Sentinel."""
    event_id: str = Field(default_factory=lambda: f"fre-{uuid.uuid4().hex[:10]}")
    task_id: str
    event_type: str
    timestamp: str = Field(default_factory=utc_now_iso)
    details: Dict[str, Any] = Field(default_factory=dict)
    evidence_refs: List[str] = Field(default_factory=list)
    source: str = "MEMORAG_FORGE_DIAGNOSTICS"
