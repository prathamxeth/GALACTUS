"""
Pydantic data models and schemas for GALACTUS / Ragnarok Memory & Security Subsystem.
Strictly local-first, zero-leak design.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    """Returns current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


# ============================================================================
# Enums
# ============================================================================

class MemoryType(str, Enum):
    EPISODIC = "episodic"
    SEMANTIC = "semantic"


class VerificationStatus(str, Enum):
    USER_PROVIDED = "user_provided"
    VERIFIED = "verified"
    INFERRED = "inferred"
    UNVERIFIED = "unverified"


class SemanticCategory(str, Enum):
    FACT = "fact"
    PREFERENCE = "preference"
    PROJECT_CONTEXT = "project_context"
    HEURISTIC = "heuristic"


class EpisodicEventType(str, Enum):
    USER_MESSAGE = "user_message"
    AGENT_MESSAGE = "agent_message"
    TOOL_EXECUTION = "tool_execution"
    SYSTEM_EVENT = "system_event"
    TASK_OUTCOME = "task_outcome"


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REQUIRES_RECONCILIATION = "REQUIRES_RECONCILIATION"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# ============================================================================
# Memory Payloads & Records
# ============================================================================

class EpisodicPayload(BaseModel):
    """Payload for episodic memory events."""
    session_id: str = Field(..., description="Active session or conversation ID")
    event_type: str = Field(..., description="Category of event (e.g. user_message, tool_execution)")
    content: Dict[str, Any] = Field(..., description="Detailed event content, thoughts, inputs, outputs")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary contextual metadata")


class SemanticPayload(BaseModel):
    """Payload for semantic structured facts."""
    category: SemanticCategory = Field(..., description="Fact classification")
    subject: str = Field(..., description="Subject / entity")
    predicate: str = Field(..., description="Relation / attribute")
    object_value: Any = Field(..., description="Value (string, number, or JSON object)")
    context: Dict[str, Any] = Field(default_factory=dict, description="Contextual origin details")


class MemoryRecord(BaseModel):
    """
    Decrypted in-memory representation of any memory record (episodic or semantic).
    Plaintext is only materialized in process memory and never written unencrypted to disk.
    """
    id: str = Field(..., description="Stable UUID v4 identifier")
    memory_type: MemoryType = Field(..., description="episodic or semantic")
    category: Optional[str] = Field(None, description="Semantic category or episodic event type")
    verification_status: VerificationStatus = Field(
        default=VerificationStatus.UNVERIFIED,
        description="Provenance confidence rating"
    )
    confidence: float = Field(
        default=1.0, ge=0.0, le=1.0,
        description="Confidence score for inferred facts"
    )
    dedup_hash: Optional[str] = Field(
        None, description="Deterministic SHA-256 hash for deduplication"
    )
    source_ref: Optional[str] = Field(
        None, description="Provenance reference (e.g. 'chat', 'tool', 'file')"
    )
    schema_version: int = Field(default=1, description="Payload schema version")
    payload: Dict[str, Any] = Field(..., description="Decrypted payload content")
    created_at: str = Field(default_factory=utc_now_iso, description="UTC ISO-8601 creation timestamp")
    updated_at: str = Field(default_factory=utc_now_iso, description="UTC ISO-8601 update timestamp")
    expires_at: Optional[str] = Field(None, description="UTC ISO-8601 expiration timestamp, if any")
    is_deleted: bool = Field(default=False, description="Tombstone flag")


# Specific convenience views
class EpisodicEvent(BaseModel):
    id: str
    session_id: str
    event_type: str
    content: Dict[str, Any]
    source_ref: Optional[str] = None
    created_at: str
    expires_at: Optional[str] = None
    is_deleted: bool = False


class SemanticMemory(BaseModel):
    id: str
    category: SemanticCategory
    subject: str
    predicate: str
    object_value: Any
    verification_status: VerificationStatus
    confidence: float
    dedup_hash: str
    source_ref: Optional[str] = None
    created_at: str
    updated_at: str
    expires_at: Optional[str] = None
    is_deleted: bool = False


# ============================================================================
# Request / Input Schemas
# ============================================================================

class EventCreate(BaseModel):
    """Input contract for storing an episodic event."""
    session_id: str = Field(..., description="Active session ID")
    event_type: str = Field(default="user_message", description="Event type")
    content: Dict[str, Any] = Field(..., description="Event content dictionary")
    source_ref: Optional[str] = Field(None, description="Origin source reference")
    ttl_seconds: Optional[int] = Field(None, description="Retention time-to-live in seconds")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class SemanticMemoryCreate(BaseModel):
    """Input contract for storing a semantic memory."""
    category: SemanticCategory = Field(default=SemanticCategory.FACT)
    subject: str = Field(..., description="Entity or topic the fact describes")
    predicate: str = Field(..., description="Relation or property name")
    object_value: Any = Field(..., description="Target value or structured data")
    verification_status: VerificationStatus = Field(default=VerificationStatus.USER_PROVIDED)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source_ref: Optional[str] = Field(None, description="Origin source reference")
    ttl_seconds: Optional[int] = Field(None, description="Optional TTL in seconds")


class MemoryUpdate(BaseModel):
    """Input contract for editing an existing semantic or episodic memory."""
    object_value: Optional[Any] = Field(None, description="New object value")
    verification_status: Optional[VerificationStatus] = Field(None)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    content: Optional[Dict[str, Any]] = Field(None, description="New content for episodic record")


class MemorySearchQuery(BaseModel):
    """Request model for memory search."""
    query: Optional[str] = Field(None, description="Keyword search string")
    memory_type: Optional[MemoryType] = Field(None, description="Filter by episodic or semantic")
    category: Optional[str] = Field(None, description="Filter by category")
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)
    include_expired: bool = Field(default=False, description="Whether to include expired records")


class MemoryExport(BaseModel):
    """Schema for exported memories."""
    exported_at: str = Field(default_factory=utc_now_iso)
    total_records: int
    records: List[MemoryRecord]


# ============================================================================
# Task Recovery Schemas
# ============================================================================

class TaskCheckpoint(BaseModel):
    """Persistent task state checkpoint for crash recovery."""
    task_id: str = Field(..., description="Unique task identifier")
    workflow_id: str = Field(..., description="Parent workflow or pipeline ID")
    status: TaskStatus = Field(default=TaskStatus.PENDING)
    current_step: str = Field(..., description="Identifier of current step")
    completed_step_ids: List[str] = Field(default_factory=list, description="List of step IDs already committed")
    pending_step_ids: List[str] = Field(default_factory=list, description="List of step IDs yet to execute")
    approval_references: List[str] = Field(default_factory=list, description="Approved permission token IDs")
    retry_count: int = Field(default=0, ge=0)
    state_data: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary task execution variables")
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


class TaskExecutionEvent(BaseModel):
    """Execution event record with idempotency hash for side-effect guard."""
    event_id: str = Field(..., description="Unique event identifier")
    task_id: str = Field(..., description="Associated task ID")
    step_id: str = Field(..., description="Associated step ID")
    action: str = Field(..., description="Action name executed")
    status: str = Field(..., description="SUCCESS, FAILED, PENDING")
    idempotency_hash: str = Field(..., description="SHA-256 hash of action inputs to prevent re-execution")
    details: Dict[str, Any] = Field(default_factory=dict, description="Action outputs or error logs")
    recorded_at: str = Field(default_factory=utc_now_iso)


# ============================================================================
# Permission Schemas
# ============================================================================

class PermissionCheckRequest(BaseModel):
    """Authorization check request compatible with Member 1."""
    user_id: str = Field(..., description="Subject identity or agent identity")
    action: str = Field(..., description="Requested action / tool name")
    resource: str = Field(..., description="Target file, URL, process, or entity")
    risk_level: RiskLevel = Field(default=RiskLevel.MEDIUM)
    approval_token: Optional[str] = Field(None, description="Human approval token if previously granted")


class PermissionDecision(BaseModel):
    """Decision returned by the authorization gateway."""
    allowed: bool = Field(..., description="True if action is permitted to execute")
    reason: str = Field(..., description="Explanation of the authorization decision")
    approval_required: bool = Field(..., description="True if human confirmation is required")
    approval_id: Optional[str] = Field(None, description="Token identifier if approval is pending or granted")
