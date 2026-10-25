"""
SQLite database engine with WAL mode, foreign keys, and versioned schema migrations.
Never deletes or recreates databases on startup; safely runs pending incremental migrations.
"""

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator, List, Optional

logger = logging.getLogger(__name__)

CURRENT_SCHEMA_VERSION = 1


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================================
# Migration Definitions
# ============================================================================

def _apply_migration_v1(conn: sqlite3.Connection) -> None:
    """Initial schema for Galactus / Ragnarok Memory & Security Subsystem."""
    cursor = conn.cursor()

    # 1. Memories Table (Episodic & Semantic)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            memory_type TEXT NOT NULL,
            category TEXT,
            verification_status TEXT NOT NULL DEFAULT 'unverified',
            confidence REAL NOT NULL DEFAULT 1.0,
            dedup_hash TEXT UNIQUE,
            source_ref TEXT,
            schema_version INTEGER NOT NULL DEFAULT 1,
            encrypted_payload TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            expires_at TEXT,
            is_deleted INTEGER NOT NULL DEFAULT 0
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_type_deleted ON memories(memory_type, is_deleted);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_memories_dedup ON memories(dedup_hash);")

    # 2. Task Checkpoints Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS task_checkpoints (
            task_id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            status TEXT NOT NULL,
            current_step TEXT NOT NULL,
            completed_step_ids TEXT NOT NULL DEFAULT '[]',
            pending_step_ids TEXT NOT NULL DEFAULT '[]',
            approval_references TEXT NOT NULL DEFAULT '[]',
            retry_count INTEGER NOT NULL DEFAULT 0,
            encrypted_state TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON task_checkpoints(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_checkpoints_workflow ON task_checkpoints(workflow_id);")

    # 3. Execution Events Table (Idempotency Guard)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_events (
            event_id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES task_checkpoints(task_id) ON DELETE CASCADE,
            step_id TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            idempotency_hash TEXT NOT NULL,
            encrypted_details TEXT NOT NULL,
            recorded_at TEXT NOT NULL
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_task ON execution_events(task_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_idempotency ON execution_events(idempotency_hash);")

    # 4. Permission Policies Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS permission_policies (
            action TEXT PRIMARY KEY,
            default_risk TEXT NOT NULL,
            requires_approval INTEGER NOT NULL DEFAULT 1,
            description TEXT
        );
    """)

    # Seed default policies
    default_policies = [
        ("read_local_file", "LOW", 0, "Read access to local non-sensitive files"),
        ("write_local_file", "MEDIUM", 1, "Modify or create local files in workspace"),
        ("shell_execute", "HIGH", 1, "Execution of system commands in shell/terminal"),
        ("delete_file", "HIGH", 1, "Permanent deletion of local resources"),
        ("network_egress", "HIGH", 1, "Outbound network requests to external servers"),
        ("read_secrets", "HIGH", 1, "Access to credentials, tokens, or encryption keys"),
    ]
    cursor.executemany(
        """
        INSERT OR IGNORE INTO permission_policies (action, default_risk, requires_approval, description)
        VALUES (?, ?, ?, ?);
        """,
        default_policies,
    )


MIGRATIONS = {
    1: _apply_migration_v1,
}


# ============================================================================
# Database Manager
# ============================================================================

class DatabaseManager:
    """
    Manages SQLite connections with WAL mode, foreign keys, and versioned migrations.
    Guarantees thread-safe connections and persistence across application restarts.
    """

    def __init__(self, db_path: str = "galactus_memory.db"):
        self.db_path = os.path.abspath(db_path)
        # Ensure parent directory exists
        parent_dir = os.path.dirname(self.db_path)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)

        self._initialize_database()

    def get_connection(self) -> sqlite3.Connection:
        """Creates a properly configured SQLite connection."""
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for high-concurrency read/write
        conn.execute("PRAGMA journal_mode = WAL;")
        # Enforce foreign key constraints
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        return conn

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager for atomic transaction block with immediate lock."""
        conn = self.get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE;")
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _initialize_database(self) -> None:
        """
        Initializes schema migrations table and applies any pending migrations.
        Never drops or truncates existing tables.
        """
        conn = self.get_connection()
        try:
            # Create schema_migrations table if not present
            conn.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                );
            """)
            conn.commit()

            # Check currently applied version
            cursor = conn.cursor()
            cursor.execute("SELECT MAX(version) FROM schema_migrations;")
            row = cursor.fetchone()
            current_version = row[0] if (row and row[0] is not None) else 0

            # Apply pending migrations incrementally
            for ver in sorted(MIGRATIONS.keys()):
                if ver > current_version:
                    logger.info(f"Applying schema migration version {ver} to {self.db_path}")
                    with self.transaction() as tx_conn:
                        MIGRATIONS[ver](tx_conn)
                        tx_conn.execute(
                            "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);",
                            (ver, utc_now()),
                        )
        finally:
            conn.close()

    def checkpoint_wal(self) -> None:
        """Forces SQLite to flush WAL pages to the primary database file."""
        conn = self.get_connection()
        try:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        finally:
            conn.close()
