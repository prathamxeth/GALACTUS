"""
MEMORAG Forge — Constrained Local Project Inspector.
Enforces strict filesystem boundary sandboxing and executes read-only diagnostic checks.
"""

import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# Explicitly allowed read-only inspection command patterns
ALLOWED_DIAGNOSTIC_COMMANDS = [
    r"^git\s+status(\s+--porcelain)?$",
    r"^git\s+diff(\s+[\w\-./]+)?$",
    r"^git\s+log(\s+-n\s+\d+)?(\s+--oneline)?$",
    r"^python\s+-m\s+py_compile\s+[\w\-./]+$",
    r"^python\s+-m\s+pytest(\s+[\w\-./]+)?(\s+-v)?$",
    r"^npm\s+test$",
    r"^npm\s+run\s+(build|lint|typecheck)$",
    r"^node\s+--check\s+[\w\-./]+$",
]

# Prohibited shell operators that indicate injection or arbitrary chaining
FORBIDDEN_OPERATORS = [";", "&&", "||", "|", "`", "$(", ">", "<", "\n", "\r"]


class SecurityViolationError(Exception):
    """Raised when an operation violates filesystem or execution policy."""
    pass


class ProjectInspector:
    """
    Constrained local execution boundary for project diagnostics.
    Guarantees operations stay strictly within the authorized project directory.
    """

    def __init__(self, project_root: str):
        self.project_root = Path(project_root).resolve()
        if not self.project_root.exists() or not self.project_root.is_dir():
            raise SecurityViolationError(f"Target project root does not exist or is not a directory: {project_root}")

    def validate_path_in_sandbox(self, relative_or_abs_path: str) -> Path:
        """
        Validates that a target path resides strictly within the project root.
        Rejects directory traversal attempts (e.g. ../../etc) and escaping symlinks.
        """
        canonical_root = self.project_root.resolve()
        target = (self.project_root / relative_or_abs_path).resolve()
        try:
            target.relative_to(canonical_root)
        except ValueError:
            raise SecurityViolationError(
                f"Path traversal detected! Path '{relative_or_abs_path}' escapes sandbox '{canonical_root}'."
            )

        # Protection against symlinks resolving outside the project root
        real_target = Path(os.path.realpath(str(target)))
        real_root = Path(os.path.realpath(str(canonical_root)))
        try:
            real_target.relative_to(real_root)
        except ValueError:
            raise SecurityViolationError(
                f"Escaping symlink detected! Real path '{real_target}' escapes sandbox '{real_root}'."
            )
        return target

    def check_toolchain_availability(self, tool_name: str) -> bool:
        """Checks if a compiler or package manager is installed on the host system."""
        return shutil.which(tool_name) is not None

    def execute_read_only_command(
        self,
        cmd_string: str,
        timeout_seconds: float = 10.0,
        max_output_bytes: int = 65536,
    ) -> Tuple[int, str, str]:
        """
        Executes an authorized read-only diagnostic command.
        Enforces execution policy, timeouts, and output limits.
        """
        cmd_clean = cmd_string.strip()

        # 1. Check for command chaining or shell injection operators
        for op in FORBIDDEN_OPERATORS:
            if op in cmd_clean:
                raise SecurityViolationError(
                    f"Forbidden shell operator '{op}' detected in command: {cmd_string}"
                )

        # 2. Match against explicit read-only policy
        is_allowed = any(re.match(pattern, cmd_clean) for pattern in ALLOWED_DIAGNOSTIC_COMMANDS)
        if not is_allowed:
            raise SecurityViolationError(
                f"Command '{cmd_clean}' is not permitted under the read-only diagnostic policy."
            )

        # 3. Check toolchain binary existence
        tokens = cmd_clean.split()
        binary = tokens[0]
        if not self.check_toolchain_availability(binary):
            return 127, "", f"Toolchain binary '{binary}' is not available or not installed on host."

        # 4. Safe subprocess execution inside project_root
        try:
            proc = subprocess.run(
                tokens,
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                shell=False,
            )
            stdout = proc.stdout[:max_output_bytes]
            stderr = proc.stderr[:max_output_bytes]
            return proc.returncode, stdout, stderr
        except subprocess.TimeoutExpired:
            return 124, "", f"Diagnostic command timed out after {timeout_seconds} seconds."
        except Exception as e:
            return 1, "", f"Execution failure: {str(e)}"

    def inspect_file_content(self, relative_path: str, max_bytes: int = 32768) -> str:
        """Reads file safely from within sandbox."""
        resolved = self.validate_path_in_sandbox(relative_path)
        if not resolved.exists() or not resolved.is_file():
            raise FileNotFoundError(f"File not found in project: {relative_path}")
        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            return f.read(max_bytes)

    def get_git_status_and_diff(self) -> Dict[str, Any]:
        """Gathers git branch status and modified diffs if repository is git-tracked."""
        git_dir = self.project_root / ".git"
        if not git_dir.exists():
            return {
                "is_git_repo": False,
                "status_output": "Not a git repository.",
                "diff_output": "",
                "modified_files": [],
            }

        code_stat, stdout_stat, _ = self.execute_read_only_command("git status --porcelain")
        code_diff, stdout_diff, _ = self.execute_read_only_command("git diff")

        modified_files = []
        if code_stat == 0 and stdout_stat:
            for line in stdout_stat.splitlines():
                parts = line.strip().split(maxsplit=1)
                if len(parts) == 2:
                    modified_files.append(parts[1])

        return {
            "is_git_repo": True,
            "status_output": stdout_stat,
            "diff_output": stdout_diff,
            "modified_files": modified_files,
        }
