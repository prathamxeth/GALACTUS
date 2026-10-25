"""
Memory Service layer orchestrating encryption, repository persistence, and in-process search.
Plaintext data is decrypted strictly in process memory; no unencrypted search index is ever stored on disk.
"""

import hashlib
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Union

from app.memory.crypto import EncryptionService
from app.memory.database import DatabaseManager, utc_now
from app.memory.models import (
    EpisodicEvent,
    EpisodicPayload,
    EventCreate,
    MemoryExport,
    MemoryRecord,
    MemoryType,
    MemoryUpdate,
    SemanticCategory,
    SemanticMemory,
    SemanticMemoryCreate,
    SemanticPayload,
    VerificationStatus,
)
from app.memory.repository import MemoryRepository

logger = logging.getLogger(__name__)


def compute_dedup_hash(category: str, subject: str, predicate: str, object_value: Any) -> str:
    """
    Computes a deterministic SHA-256 hash for semantic fact deduplication.
    Normalizes string values (lowercased and stripped).
    """
    norm_cat = str(category).strip().lower()
    norm_subj = str(subject).strip().lower()
    norm_pred = str(predicate).strip().lower()

    if isinstance(object_value, (dict, list)):
        norm_val = json.dumps(object_value, sort_keys=True, ensure_ascii=False)
    else:
        norm_val = str(object_value).strip().lower()

    key_repr = f"{norm_cat}::{norm_subj}::{norm_pred}::{norm_val}"
    return hashlib.sha256(key_repr.encode("utf-8")).hexdigest()


class MemoryService:
    """
    High-level memory operations:
    - Episodic interaction logging
    - Semantic fact storage with deduplication
    - In-process deterministic keyword search
    - Inspection, update, soft/hard deletion, export, and expiration purging
    """

    def __init__(
        self,
        db: DatabaseManager,
        crypto: EncryptionService,
        flight_recorder: Optional[Any] = None,
    ):
        self.db = db
        self.crypto = crypto
        self.flight_recorder = flight_recorder
        self.repo = MemoryRepository(db)

    # =========================================================================
    # Episodic Memory
    # =========================================================================

    def store_event(
        self,
        session_id: str,
        event_type: str,
        content: Dict[str, Any],
        source_ref: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None,
    ) -> EpisodicEvent:
        """
        Encrypts and stores a chronological episodic interaction event.
        Calculates expiration timestamp if TTL is specified.
        Mirrors to canonical Flight Recorder if service is configured.
        """
        event_id = str(uuid.uuid4())
        now = utc_now()
        expires_at = None
        if ttl_seconds and ttl_seconds > 0:
            exp_dt = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            expires_at = exp_dt.isoformat()

        payload_dict = {
            "session_id": session_id,
            "event_type": event_type,
            "content": content,
            "metadata": metadata or {},
        }

        # Encrypt payload before saving
        encrypted_payload = self.crypto.encrypt_json(payload_dict)

        record = MemoryRecord(
            id=event_id,
            memory_type=MemoryType.EPISODIC,
            category=event_type,
            verification_status=VerificationStatus.UNVERIFIED,
            confidence=1.0,
            dedup_hash=None,
            source_ref=source_ref,
            schema_version=1,
            project_id=project_id,
            payload=payload_dict,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            is_deleted=False,
        )

        self.repo.insert_memory(record, encrypted_payload)

        # Mirror to canonical Flight Recorder if service is configured
        if self.flight_recorder:
            try:
                from app.memory.models import EventSourceType, FlightRecorderEventCreate
                task_id = metadata.get("task_id") if metadata else None
                phase = metadata.get("phase") if metadata else None
                evidence_refs = metadata.get("evidence_refs", []) if metadata else []
                summary_str = ""
                if isinstance(content, dict):
                    summary_str = content.get("text") or content.get("message") or str(content)
                else:
                    summary_str = str(content)

                self.flight_recorder.record_event(
                    FlightRecorderEventCreate(
                        event_id=event_id,
                        project_id=project_id or "default",
                        task_id=task_id,
                        event_type=event_type,
                        source_type=EventSourceType.SYSTEM,
                        actor=metadata.get("actor", "agent") if metadata else "agent",
                        summary=summary_str[:200] if summary_str else f"Episodic: {event_type}",
                        phase=phase,
                        evidence_refs=evidence_refs,
                        metadata=metadata or {},
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to mirror episodic event to flight recorder: {e}")

        return EpisodicEvent(
            id=event_id,
            session_id=session_id,
            event_type=event_type,
            content=content,
            source_ref=source_ref,
            created_at=now,
            expires_at=expires_at,
            is_deleted=False,
        )

    # =========================================================================
    # Semantic Memory
    # =========================================================================

    def store_memory(
        self,
        category: SemanticCategory,
        subject: str,
        predicate: str,
        object_value: Any,
        verification_status: VerificationStatus = VerificationStatus.USER_PROVIDED,
        confidence: float = 1.0,
        source_ref: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None,
    ) -> SemanticMemory:
        """
        Stores structured fact/preference.
        Guarantees deduplication: if an identical active fact exists,
        updates verification_status, confidence, and timestamps rather than inserting duplicate.
        """
        cat_str = category.value if hasattr(category, "value") else str(category)
        dedup_hash = compute_dedup_hash(cat_str, subject, predicate, object_value)
        existing_row = self.repo.find_by_dedup_hash(dedup_hash)

        now = utc_now()
        expires_at = None
        if ttl_seconds and ttl_seconds > 0:
            exp_dt = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
            expires_at = exp_dt.isoformat()

        payload_dict = {
            "category": cat_str,
            "subject": subject,
            "predicate": predicate,
            "object_value": object_value,
            "context": context or {},
        }

        if existing_row:
            # Fact already exists: update confidence & verification status if higher/fresher
            mem_id = existing_row["id"]
            encrypted_payload = self.crypto.encrypt_json(payload_dict)
            stat_str = verification_status.value if hasattr(verification_status, "value") else str(verification_status)
            self.repo.update_memory_row(
                memory_id=mem_id,
                encrypted_payload=encrypted_payload,
                verification_status=stat_str,
                confidence=confidence,
            )
            return SemanticMemory(
                id=mem_id,
                category=category,
                subject=subject,
                predicate=predicate,
                object_value=object_value,
                verification_status=verification_status,
                confidence=confidence,
                dedup_hash=dedup_hash,
                source_ref=existing_row["source_ref"] or source_ref,
                created_at=existing_row["created_at"],
                updated_at=now,
                expires_at=existing_row["expires_at"],
                is_deleted=False,
            )

        # New semantic memory
        mem_id = str(uuid.uuid4())
        encrypted_payload = self.crypto.encrypt_json(payload_dict)

        record = MemoryRecord(
            id=mem_id,
            memory_type=MemoryType.SEMANTIC,
            category=cat_str,
            verification_status=verification_status,
            confidence=confidence,
            dedup_hash=dedup_hash,
            source_ref=source_ref,
            schema_version=1,
            project_id=project_id,
            payload=payload_dict,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            is_deleted=False,
        )

        self.repo.insert_memory(record, encrypted_payload)

        return SemanticMemory(
            id=mem_id,
            category=category,
            subject=subject,
            predicate=predicate,
            object_value=object_value,
            verification_status=verification_status,
            confidence=confidence,
            dedup_hash=dedup_hash,
            source_ref=source_ref,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            is_deleted=False,
        )

    # =========================================================================
    # Retrieval, Inspection, Editing, Deletion & Export
    # =========================================================================

    def get_memory(self, memory_id: Union[str, uuid.UUID, Any], include_deleted: bool = False) -> Optional[MemoryRecord]:
        """
        Inspects a single memory by ID.
        Decrypts the payload in process memory before returning.
        """
        row = self.repo.get_memory_row(memory_id, include_deleted=include_deleted)
        if not row:
            return None
        return self._row_to_record(row)

    def update_memory(self, memory_id: Union[str, uuid.UUID, Any], update: MemoryUpdate) -> MemoryRecord:
        """
        Updates an existing memory record. Re-encrypts payload with new values.
        """
        current = self.get_memory(memory_id)
        if not current:
            raise KeyError(f"Memory with ID '{memory_id}' not found or deleted.")

        new_payload = dict(current.payload)
        new_stat = current.verification_status
        new_conf = current.confidence

        if update.object_value is not None:
            new_payload["object_value"] = update.object_value
        if update.content is not None:
            new_payload["content"] = update.content
        if update.verification_status is not None:
            new_stat = update.verification_status
        if update.confidence is not None:
            new_conf = update.confidence

        encrypted_payload = self.crypto.encrypt_json(new_payload)
        stat_val = new_stat.value if hasattr(new_stat, "value") else str(new_stat)

        self.repo.update_memory_row(
            memory_id=current.id,
            encrypted_payload=encrypted_payload,
            verification_status=stat_val,
            confidence=new_conf,
        )

        return self.get_memory(current.id)

    def delete_memory(self, memory_id: Union[str, uuid.UUID, Any], hard_delete: bool = False) -> bool:
        """
        Deletes a memory record.
        - If hard_delete is False: soft deletes (sets is_deleted = 1, excluded from queries).
        - If hard_delete is True: cryptographically overwrites payload and deletes SQLite row.
        """
        current = self.get_memory(memory_id, include_deleted=True)
        if not current:
            return False
        if hard_delete:
            return self.repo.hard_delete_memory(current.id)
        if current.is_deleted:
            return False
        return self.repo.soft_delete_memory(current.id)

    def search_memories(
        self,
        query: Optional[str] = None,
        project_id: Optional[str] = None,
        memory_type: Optional[MemoryType] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        include_expired: bool = False,
    ) -> List[MemoryRecord]:
        """
        Deterministic local keyword search.
        Fetches candidate rows, decrypts in process memory, and filters against query terms.
        No unencrypted search index is ever stored on disk.
        """
        type_str = memory_type.value if memory_type else None
        candidate_rows = self.repo.get_all_active_candidate_rows(
            memory_type=type_str,
            category=category,
            include_expired=include_expired,
        )

        matched: List[MemoryRecord] = []
        clean_query = query.strip().lower() if query else None

        for row in candidate_rows:
            try:
                record = self._row_to_record(row)
            except Exception as e:
                logger.warning(f"Skipping corrupt or un-decryptable record {row['id']}: {e}")
                continue

            # Project scope filtering
            if project_id and record.project_id and record.project_id != project_id:
                continue

            if not clean_query:
                matched.append(record)
                continue

            # Check if query matches in payload content, subject, predicate, or object
            payload_str = json.dumps(record.payload, ensure_ascii=False).lower()
            if clean_query in payload_str or (record.source_ref and clean_query in record.source_ref.lower()):
                matched.append(record)

        # Apply pagination on filtered results
        return matched[offset : offset + limit]

    def export_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        category: Optional[str] = None,
    ) -> MemoryExport:
        """Exports all active memories of requested type/category as a decrypted JSON structure."""
        type_str = memory_type.value if memory_type else None
        candidate_rows = self.repo.get_all_active_candidate_rows(
            memory_type=type_str,
            category=category,
            include_expired=False,
        )

        records: List[MemoryRecord] = []
        for row in candidate_rows:
            try:
                records.append(self._row_to_record(row))
            except Exception as e:
                logger.warning(f"Error decrypting record {row['id']} during export: {e}")

        return MemoryExport(
            total_records=len(records),
            records=records,
        )

    def purge_expired(self) -> int:
        """Purges expired memories from active state."""
        return self.repo.purge_expired_records()

    def query_relevant_context(self, user_goal: str) -> Dict[str, Any]:
        """
        Milestone 5 Memory Handshake:
        Extracts verified facts, user preferences, and contextual constraints relevant
        to the user goal for prompt injection into the Task Planner (gemma4:e2b).
        """
        # 1. Fetch all semantic memories that are active
        all_semantic = self.search_memories(
            memory_type=MemoryType.SEMANTIC,
            limit=200,
            include_expired=False,
        )

        # 2. Extract goal keywords
        goal_words = set(w.strip().lower() for w in user_goal.split() if len(w.strip()) > 2)

        verified_facts: List[Dict[str, Any]] = []
        preferences: List[Dict[str, Any]] = []
        constraints: List[Dict[str, Any]] = []

        for mem in all_semantic:
            payload = mem.payload or {}
            cat = (mem.category or "").lower()
            subject = payload.get("subject", "")
            predicate = payload.get("predicate", "")
            obj_val = payload.get("object_value", "")
            text_repr = f"{subject} {predicate} {obj_val}".lower()

            is_match = any(word in text_repr for word in goal_words)

            item = {
                "id": mem.id,
                "category": cat,
                "subject": subject,
                "predicate": predicate,
                "object_value": obj_val,
                "verification_status": mem.verification_status.value if hasattr(mem.verification_status, "value") else str(mem.verification_status),
                "confidence": mem.confidence,
            }

            if cat == "preference" or cat == SemanticCategory.PREFERENCE.value:
                preferences.append(item)
            elif cat in ("constraint", "project_context", SemanticCategory.PROJECT_CONTEXT.value):
                constraints.append(item)
            elif mem.verification_status in (VerificationStatus.VERIFIED, VerificationStatus.USER_PROVIDED):
                verified_facts.append(item)
            elif is_match:
                verified_facts.append(item)

        # 3. Format formatted_context string for Ollama system prompt
        context_lines: List[str] = []
        if preferences:
            context_lines.append("USER PREFERENCES:")
            for p in preferences:
                context_lines.append(f"- {p['subject']} -> {p['predicate']}: {p['object_value']}")
        if constraints:
            context_lines.append("CONSTRAINTS & POLICIES:")
            for c in constraints:
                context_lines.append(f"- {c['subject']} -> {c['predicate']}: {c['object_value']}")
        if verified_facts:
            context_lines.append("VERIFIED FACTS:")
            for vf in verified_facts:
                context_lines.append(f"- {vf['subject']} {vf['predicate']} {vf['object_value']} (verified)")

        formatted_context = "\n".join(context_lines) if context_lines else "No specific prior preferences or verified constraints found."

        return {
            "user_goal": user_goal,
            "verified_facts": verified_facts,
            "preferences": preferences,
            "constraints": constraints,
            "formatted_context": formatted_context,
        }

    # =========================================================================
    # Helpers
    # =========================================================================

    def _row_to_record(self, row: Any) -> MemoryRecord:
        """Converts raw SQLite row into decrypted in-memory MemoryRecord."""
        decrypted_payload = self.crypto.decrypt_json(row["encrypted_payload"])
        project_id = row["project_id"] if "project_id" in row.keys() else None
        return MemoryRecord(
            id=row["id"],
            memory_type=MemoryType(row["memory_type"]),
            category=row["category"],
            verification_status=VerificationStatus(row["verification_status"]),
            confidence=row["confidence"],
            dedup_hash=row["dedup_hash"],
            source_ref=row["source_ref"],
            schema_version=row["schema_version"],
            project_id=project_id,
            payload=decrypted_payload,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            expires_at=row["expires_at"],
            is_deleted=bool(row["is_deleted"]),
        )

    def query_relevant_context(self, user_goal: str, max_items: int = 100) -> Dict[str, Any]:
        """
        Milestone 5 Memory Handshake:
        Extracts verified facts, user preferences, and contextual constraints relevant
        to the user goal for prompt injection into the Task Planner (gemma4:e2b).
        """
        # 1. Fetch all semantic memories that are active
        all_semantic = self.search_memories(
            memory_type=MemoryType.SEMANTIC,
            limit=200,
            include_expired=False,
        )

        # 2. Extract goal keywords
        goal_words = set(re.findall(r"\b\w{3,}\b", user_goal.lower())) if user_goal else set()

        verified_facts: List[Dict[str, Any]] = []
        preferences: List[Dict[str, Any]] = []
        constraints: List[Dict[str, Any]] = []

        for mem in all_semantic:
            payload = mem.payload or {}
            cat = (mem.category or "").lower()
            subject = payload.get("subject", "")
            predicate = payload.get("predicate", "")
            obj_val = payload.get("object_value", "")
            text_repr = f"{subject} {predicate} {obj_val}".lower()

            is_match = any(word in text_repr for word in goal_words)

            item = {
                "id": mem.id,
                "category": cat,
                "subject": subject,
                "predicate": predicate,
                "object_value": obj_val,
                "verification_status": mem.verification_status.value if hasattr(mem.verification_status, "value") else str(mem.verification_status),
                "confidence": mem.confidence,
            }

            if cat == "preference" or cat == SemanticCategory.PREFERENCE.value:
                preferences.append(item)
            if cat in ("constraint", "project_context", SemanticCategory.PROJECT_CONTEXT.value):
                constraints.append(item)
            if cat in ("fact", SemanticCategory.FACT.value, "project_context", SemanticCategory.PROJECT_CONTEXT.value):
                if mem.verification_status in (VerificationStatus.VERIFIED, VerificationStatus.USER_PROVIDED):
                    verified_facts.append(item)
            elif mem.verification_status in (VerificationStatus.VERIFIED, VerificationStatus.USER_PROVIDED):
                verified_facts.append(item)
            elif is_match and mem.verification_status != VerificationStatus.UNVERIFIED:
                verified_facts.append(item)

        # Sort by keyword relevance if goal provided
        def relevance_score(item_dict: Dict[str, Any]) -> int:
            t = f"{item_dict.get('subject', '')} {item_dict.get('predicate', '')} {item_dict.get('object_value', '')}".lower()
            return sum(1 for kw in goal_words if kw in t)

        preferences = sorted(preferences, key=relevance_score, reverse=True)[:max_items]
        constraints = sorted(constraints, key=relevance_score, reverse=True)[:max_items]
        verified_facts = sorted(verified_facts, key=relevance_score, reverse=True)[:max_items]

        # 3. Format formatted_context string for Ollama system prompt
        context_lines: List[str] = []
        if preferences:
            context_lines.append("USER PREFERENCES:")
            for p in preferences:
                context_lines.append(f"- {p['subject']} -> {p['predicate']}: {p['object_value']}")
        if constraints:
            context_lines.append("CONSTRAINTS & POLICIES:")
            for c in constraints:
                context_lines.append(f"- {c['subject']} -> {c['predicate']}: {c['object_value']}")
        if verified_facts:
            context_lines.append("VERIFIED FACTS:")
            for vf in verified_facts:
                context_lines.append(f"- {vf['subject']} {vf['predicate']} {vf['object_value']} (verified)")

        formatted_context = "\n".join(context_lines) if context_lines else "No specific prior preferences or verified constraints found."

        return {
            "user_goal": user_goal,
            "verified_facts": verified_facts,
            "preferences": preferences,
            "constraints": constraints,
            "formatted_context": formatted_context,
            "formatted_prompt_context": formatted_context,
        }


# ============================================================================
# Standalone Handshake Function for Member 1 (TaskPlanner)
# ============================================================================

def query_relevant_context(
    user_goal: str,
    memory_service: Optional[MemoryService] = None,
    service: Optional[MemoryService] = None,
    db_path: str = "galactus_memory.db",
) -> Dict[str, Any]:
    """
    Module-level convenience function for Milestone 5 Memory Handshake.
    Can be invoked directly by backend/planner.py (TaskPlanner).
    Supports invocation with memory_service or service keyword arguments.
    """
    active_service = memory_service or service
    if active_service is not None:
        return active_service.query_relevant_context(user_goal)

    from app.api.routes import SubsystemContainer
    if SubsystemContainer.memory_service is not None:
        return SubsystemContainer.memory_service.query_relevant_context(user_goal)

    try:
        from app.api.routes import get_memory_service
        return get_memory_service().query_relevant_context(user_goal)
    except Exception:
        pass

    from app.memory.crypto import CompositeKeyProvider
    db = DatabaseManager(db_path)
    crypto = EncryptionService(CompositeKeyProvider())
    local_service = MemoryService(db, crypto)
    return local_service.query_relevant_context(user_goal)
