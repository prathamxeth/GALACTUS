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

    def __init__(self, db: DatabaseManager, crypto: EncryptionService):
        self.db = db
        self.crypto = crypto
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
    ) -> EpisodicEvent:
        """
        Encrypts and stores a chronological episodic interaction event.
        Calculates expiration timestamp if TTL is specified.
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
            payload=payload_dict,
            created_at=now,
            updated_at=now,
            expires_at=expires_at,
            is_deleted=False,
        )

        self.repo.insert_memory(record, encrypted_payload)

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

    # =========================================================================
    # Helpers
    # =========================================================================

    def _row_to_record(self, row: Any) -> MemoryRecord:
        """Converts raw SQLite row into decrypted in-memory MemoryRecord."""
        decrypted_payload = self.crypto.decrypt_json(row["encrypted_payload"])
        return MemoryRecord(
            id=row["id"],
            memory_type=MemoryType(row["memory_type"]),
            category=row["category"],
            verification_status=VerificationStatus(row["verification_status"]),
            confidence=row["confidence"],
            dedup_hash=row["dedup_hash"],
            source_ref=row["source_ref"],
            schema_version=row["schema_version"],
            payload=decrypted_payload,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            expires_at=row["expires_at"],
            is_deleted=bool(row["is_deleted"]),
        )

    def query_relevant_context(self, user_goal: str, max_items: int = 10) -> Dict[str, Any]:
        """
        Milestone 5 Handshake Interface for Member 1 (TaskPlanner):
        Queries and returns verified facts, user preferences, and goal-relevant context
        to inject into the LLM system prompt before generating the DAG.
        """
        # 1. Fetch user preferences
        all_preferences = self.search_memories(
            memory_type=MemoryType.SEMANTIC,
            category=SemanticCategory.PREFERENCE.value,
            limit=max_items,
            include_expired=False,
        )

        # 2. Fetch verified facts & project context
        verified_facts: List[MemoryRecord] = []
        for cat in [SemanticCategory.FACT.value, SemanticCategory.PROJECT_CONTEXT.value]:
            facts = self.search_memories(
                memory_type=MemoryType.SEMANTIC,
                category=cat,
                limit=max_items,
                include_expired=False,
            )
            for f in facts:
                if f.verification_status in [VerificationStatus.VERIFIED, VerificationStatus.USER_PROVIDED]:
                    verified_facts.append(f)

        # 3. Match keyword relevance against user_goal
        goal_keywords = set(re.findall(r"\b\w{3,}\b", user_goal.lower())) if user_goal else set()

        def relevance_score(rec: MemoryRecord) -> int:
            payload_text = json.dumps(rec.payload, ensure_ascii=False).lower()
            return sum(1 for kw in goal_keywords if kw in payload_text)

        sorted_prefs = sorted(all_preferences, key=relevance_score, reverse=True)
        sorted_facts = sorted(verified_facts, key=relevance_score, reverse=True)

        formatted_prefs: List[str] = []
        for p in sorted_prefs:
            subj = p.payload.get("subject", "")
            pred = p.payload.get("predicate", "")
            obj = p.payload.get("object_value", "")
            formatted_prefs.append(f"- User Preference: {subj} {pred} -> {obj}")

        formatted_facts: List[str] = []
        for f in sorted_facts:
            subj = f.payload.get("subject", "")
            pred = f.payload.get("predicate", "")
            obj = f.payload.get("object_value", "")
            status = f.verification_status.value if hasattr(f.verification_status, "value") else str(f.verification_status)
            formatted_facts.append(f"- Verified Fact [{status}]: {subj} {pred} -> {obj}")

        prompt_sections: List[str] = []
        if formatted_prefs:
            prompt_sections.append("### User Preferences & Constraints:\n" + "\n".join(formatted_prefs))
        if formatted_facts:
            prompt_sections.append("### Verified Project Context & Facts:\n" + "\n".join(formatted_facts))

        formatted_prompt_context = "\n\n".join(prompt_sections)

        return {
            "preferences": [p.model_dump() if hasattr(p, "model_dump") else p.dict() for p in sorted_prefs],
            "verified_facts": [f.model_dump() if hasattr(f, "model_dump") else f.dict() for f in sorted_facts],
            "formatted_prompt_context": formatted_prompt_context,
        }


# ============================================================================
# Standalone Handshake Function for Member 1 (TaskPlanner)
# ============================================================================

def query_relevant_context(
    user_goal: str,
    db_path: str = "galactus_memory.db",
    service: Optional[MemoryService] = None,
) -> Dict[str, Any]:
    """
    Convenience function for Member 1 (TaskPlanner) to invoke directly:
        from app.memory.service import query_relevant_context
        # or from app.memory import query_relevant_context
        context = query_relevant_context(user_goal)
    """
    if service is not None:
        return service.query_relevant_context(user_goal)

    # Use existing container or initialize
    from app.api.routes import SubsystemContainer
    if SubsystemContainer.memory_service is not None:
        return SubsystemContainer.memory_service.query_relevant_context(user_goal)

    from app.memory.crypto import CompositeKeyProvider
    db = DatabaseManager(db_path)
    crypto = EncryptionService(CompositeKeyProvider())
    local_service = MemoryService(db, crypto)
    return local_service.query_relevant_context(user_goal)
