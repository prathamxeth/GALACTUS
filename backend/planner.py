"""
Task Planner for MEMORAG (Ragnarok Hackathon Architecture).
Responsible for Milestone 5 (Memory Handshake with Member 2):
- Imports and invokes query_relevant_context(user_goal) from the persistence/memory module before generating the DAG.
- Injects verified facts and user preferences into the system prompt passed to local Ollama (gemma4:e2b) so the planner respects user constraints.
- Emits execution plan sources ('model_generated' vs 'deterministic_fallback').
- Strictly preserves security invariants: high-risk actions unconditionally mandate human approval.
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
from pydantic import BaseModel, Field

from app.memory.models import RiskLevel, TaskCheckpoint, TaskStatus
from app.memory.service import MemoryService, query_relevant_context

logger = logging.getLogger(__name__)

# Centralized local model and endpoint defaults
DEFAULT_MODEL = os.environ.get("MEMORAG_MODEL") or os.environ.get("RAGNAROK_MODEL") or "gemma4:e2b"
DEFAULT_OLLAMA_ENDPOINT = os.environ.get("OLLAMA_ENDPOINT", "http://127.0.0.1:11434")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_explicit_action_request(text: str) -> bool:
    """
    Classifies user intent: determines whether a prompt explicitly requests
    an execution/side-effect action vs a conversational question/inquiry.
    Conversational questions must not generate shell or filesystem mutations.
    """
    clean = text.strip().lower()
    if not clean:
        return False

    # Conversational / informational prefixes and inquiry markers
    conversational_prefixes = (
        "is ", "is it", "are ", "can ", "could ", "what ", "where ", "who ",
        "why ", "how ", "explain ", "describe ", "tell me ", "status", "health",
        "hello", "hi ", "hey", "check if", "do you", "test"
    )
    is_question = clean.endswith("?") or any(clean.startswith(p) for p in conversational_prefixes)

    # Explicit action verbs that genuinely request mutating or executing operations
    action_keywords = (
        "run", "execute", "deploy", "build", "create", "write", "install",
        "delete", "remove", "wipe", "backup", "restart", "reboot", "patch",
        "modify", "apply", "kill", "terminate", "compile", "launch"
    )
    words = set(clean.replace("?", " ").replace(".", " ").replace(",", " ").replace("!", " ").split())
    has_action_verb = any(verb in words for verb in action_keywords)

    if is_question and not has_action_verb:
        return False

    return has_action_verb


# ============================================================================
# DAG Models
# ============================================================================

class DAGStep(BaseModel):
    """Represents a single step within a Task execution DAG."""
    step_id: str = Field(default_factory=lambda: f"step-{uuid.uuid4().hex[:8]}")
    step_number: int = Field(default=1)
    title: str = Field(..., description="Human-readable step title")
    skill_name: str = Field(..., description="Target registered skill or tool")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list, description="IDs of prerequisite steps")
    risk_level: RiskLevel = Field(default=RiskLevel.LOW)
    requires_approval: bool = Field(default=False)
    status: str = Field(default="PENDING", description="PENDING, RUNNING, PAUSED_APPROVAL, COMPLETED, FAILED, CANCELLED")
    output: Optional[Any] = Field(default=None)
    approval_id: Optional[str] = Field(default=None)
    started_at: Optional[str] = Field(default=None)
    ended_at: Optional[str] = Field(default=None)
    exit_code: Optional[int] = Field(default=None)
    error: Optional[str] = Field(default=None)

    # NEXUS frontend compatibility aliases
    id: Optional[str] = None
    stepNumber: Optional[int] = None
    skillName: Optional[str] = None
    approvalRequestId: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.id:
            self.id = self.step_id
        if self.stepNumber is None:
            self.stepNumber = self.step_number
        if not self.skillName:
            self.skillName = self.skill_name
        if not self.approvalRequestId and self.approval_id:
            self.approvalRequestId = self.approval_id


class TaskDAG(BaseModel):
    """Execution DAG produced by the TaskPlanner."""
    task_id: str = Field(default_factory=lambda: f"task-{uuid.uuid4().hex[:8]}")
    goal: str = Field(..., description="Original user prompt or task goal")
    model: str = Field(default=DEFAULT_MODEL, description="Target Ollama model")
    plan_source: str = Field(default="deterministic_fallback", description="'model_generated' or 'deterministic_fallback'")
    fallback_reason: Optional[str] = Field(default=None, description="Observable reason deterministic fallback was used")
    inference_latency_ms: Optional[float] = Field(default=None, description="Inference latency in milliseconds if model queried")
    injected_context: Dict[str, Any] = Field(default_factory=dict, description="Retrieved verified facts and preferences")
    system_prompt: str = Field(..., description="System prompt passed to LLM containing injected memory")
    steps: List[DAGStep] = Field(default_factory=list)
    status: str = Field(default="PENDING", description="PENDING, RUNNING, PAUSED_APPROVAL, COMPLETED, FAILED, CANCELLED")
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)

    # NEXUS frontend compatibility aliases
    id: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    priority: str = Field(default="normal")

    def model_post_init(self, __context: Any) -> None:
        if not self.id:
            self.id = self.task_id
        if not self.createdAt:
            self.createdAt = self.created_at
        if not self.updatedAt:
            self.updatedAt = self.updated_at


# ============================================================================
# Task Planner Engine
# ============================================================================

class TaskPlanner:
    """
    Sovereign Task Planner that integrates memory context into local Ollama (gemma4:e2b)
    to generate execution DAGs respecting user constraints.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        ollama_endpoint: Optional[str] = None,
        memory_service: Optional[MemoryService] = None,
        read_timeout: Optional[float] = None,
        connect_timeout: Optional[float] = None,
    ):
        self.model = model or DEFAULT_MODEL
        self.ollama_endpoint = (ollama_endpoint or DEFAULT_OLLAMA_ENDPOINT).rstrip("/")
        self.read_timeout = read_timeout or float(
            os.environ.get("MEMORAG_OLLAMA_TIMEOUT") or os.environ.get("OLLAMA_TIMEOUT") or 45.0
        )
        self.connect_timeout = connect_timeout or float(
            os.environ.get("MEMORAG_OLLAMA_CONNECT_TIMEOUT") or os.environ.get("OLLAMA_CONNECT_TIMEOUT") or 5.0
        )
        self.memory_service = memory_service

    def build_system_prompt(self, user_goal: str, context: Dict[str, Any]) -> str:
        """
        Injects verified facts, user preferences, and constraints into the system prompt.
        """
        formatted_context = context.get("formatted_context", "No prior preferences found.")

        prompt = f"""You are MEMORAG's Sovereign Autonomous Task Planner (Ragnarok Hackathon Architecture).
Target Local Inference Engine: Ollama
Active Model: {self.model}
Telemetry Policy: Zero outbound telemetry, local-first execution (127.0.0.1 loopback only).

=== INJECTED VERIFIED USER MEMORY & CONSTRAINTS ===
{formatted_context}
===================================================

USER TASK GOAL:
{user_goal}

CRITICAL PLANNING & SECURITY RULES:
1. All user preferences and verified facts shown above MUST be strictly respected.
2. If a user preference or constraint conflicts with a generic strategy, user preference WINS.
3. Classify each step by risk level (LOW, MEDIUM, HIGH).
4. High-risk actions (writing files, executing shell commands, modifying network states, sending data) MUST have requires_approval=True.
5. User preferences and memories must NEVER override security boundaries, permission gates, or bypass human consent.
6. Deconstruct into a Directed Acyclic Graph (DAG) with explicit step dependencies.
"""
        return prompt

    def generate_dag(self, user_goal: str) -> TaskDAG:
        """
        Executes Milestone 5 handshake:
        1. Queries relevant context via query_relevant_context(user_goal).
        2. Injects verified facts and preferences into the prompt for gemma4:e2b.
        3. Calls local Ollama or deterministic sovereign planner to produce the DAG.
        """
        # Step 1: Handshake with Member 2 persistence/memory module
        context = query_relevant_context(user_goal, memory_service=self.memory_service)

        # Step 2: Inject into system prompt for gemma4:e2b
        system_prompt = self.build_system_prompt(user_goal, context)

        # Step 3: Attempt Ollama generation or use deterministic heuristic DAG
        steps, plan_source, fallback_reason, latency_ms = self._synthesize_dag_steps(user_goal, context, system_prompt)

        dag = TaskDAG(
            goal=user_goal,
            model=self.model,
            plan_source=plan_source,
            fallback_reason=fallback_reason,
            inference_latency_ms=latency_ms,
            injected_context=context,
            system_prompt=system_prompt,
            steps=steps,
            status="PENDING",
        )

        return dag

    def _synthesize_dag_steps(
        self,
        user_goal: str,
        context: Dict[str, Any],
        system_prompt: str,
    ) -> Tuple[List[DAGStep], str, Optional[str], Optional[float]]:
        """
        Attempts to call Ollama gemma4:e2b. If Ollama is offline or doesn't return JSON,
        uses the deterministic sovereign planner that adheres to the user constraints.
        Returns (steps, plan_source, fallback_reason, latency_ms).
        """
        ollama_response, fallback_reason, latency_ms = self._call_ollama(system_prompt, user_goal)
        if ollama_response:
            parsed_steps = self._parse_llm_dag(ollama_response)
            if parsed_steps:
                return parsed_steps, "model_generated", None, latency_ms
            else:
                fallback_reason = "Model output was not valid structured DAG JSON."

        # Deterministic sovereign fallback that respects user constraints
        return (
            self._generate_deterministic_dag(user_goal, context),
            "deterministic_fallback",
            fallback_reason or "Deterministic sovereign fallback activated.",
            latency_ms,
        )

    def _call_ollama(self, system_prompt: str, user_goal: str) -> Tuple[Optional[str], Optional[str], Optional[float]]:
        """
        Queries local Ollama endpoint with configurable timeouts and bounded safe retries.
        Returns (response_text, fallback_reason, latency_ms).
        """
        import time
        start_time = time.perf_counter()
        fallback_reason = None
        max_retries = 1

        for attempt in range(max_retries + 1):
            try:
                timeout = httpx.Timeout(self.read_timeout, connect=self.connect_timeout)
                with httpx.Client(timeout=timeout) as client:
                    res = client.post(
                        f"{self.ollama_endpoint}/api/generate",
                        json={
                            "model": self.model,
                            "prompt": f"{system_prompt}\n\nProduce DAG JSON for goal: {user_goal}",
                            "stream": False,
                            "format": "json",
                        },
                    )
                    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    if res.status_code == 200:
                        data = res.json()
                        return data.get("response"), None, latency_ms
                    elif res.status_code == 404:
                        fallback_reason = f"Configured model '{self.model}' missing in local Ollama repository."
                        break
                    else:
                        fallback_reason = f"Ollama HTTP {res.status_code}: {res.text[:100]}"
                        break
            except httpx.ConnectError:
                fallback_reason = f"Ollama daemon unreachable at {self.ollama_endpoint}."
                break
            except httpx.TimeoutException:
                fallback_reason = f"Ollama inference timed out after {self.read_timeout}s."
                if attempt < max_retries:
                    continue  # Safe bounded retry
            except Exception as e:
                fallback_reason = f"Ollama inference error: {str(e)}"
                break

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.debug(f"Ollama local inference unavailable ({fallback_reason}); using sovereign deterministic engine.")
        return None, fallback_reason, latency_ms

    def _parse_llm_dag(self, response_text: str) -> Optional[List[DAGStep]]:
        """Parses structured JSON response from Ollama."""
        try:
            match = re.search(r"(\[.*\]|\{.*\})", response_text, re.DOTALL)
            if not match:
                return None
            data = json.loads(match.group(1))
            if isinstance(data, dict):
                data = data.get("steps", [])
            if not isinstance(data, list):
                return None

            steps: List[DAGStep] = []
            for idx, item in enumerate(data, start=1):
                risk = item.get("risk_level", "LOW").upper()
                skill = item.get("skill_name", "system.analyze")
                # Intrinsic high-risk skills unconditionally require approval
                is_high_risk_skill = any(k in skill.lower() for k in ("write", "delete", "execute", "shell", "deploy", "send", "terminal"))
                risk_enum = RiskLevel.HIGH if (risk == "HIGH" or is_high_risk_skill) else (RiskLevel.MEDIUM if risk == "MEDIUM" else RiskLevel.LOW)
                # Invariant: high-risk actions UNCONDITIONALLY require approval
                req_appr = True if risk_enum == RiskLevel.HIGH else bool(item.get("requires_approval", False))

                steps.append(
                    DAGStep(
                        step_id=item.get("step_id") or f"step-{uuid.uuid4().hex[:6]}",
                        step_number=idx,
                        title=item.get("title", f"Step {idx}"),
                        skill_name=skill,
                        parameters=item.get("parameters", {}),
                        dependencies=item.get("dependencies", []),
                        risk_level=risk_enum,
                        requires_approval=req_appr,
                    )
                )
            return steps if steps else None
        except Exception:
            return None

    def _generate_deterministic_dag(self, user_goal: str, context: Dict[str, Any]) -> List[DAGStep]:
        """
        Sovereign rule-based DAG synthesis that strictly incorporates
        retrieved user preferences and verified facts into parameters.
        """
        steps: List[DAGStep] = []
        preferences = context.get("preferences", [])
        verified_facts = context.get("verified_facts", [])

        # Extract preference parameters (e.g. preferred language, formatting style, output path)
        pref_params: Dict[str, Any] = {}
        for p in preferences:
            key = f"{p['subject']}_{p['predicate']}".lower().replace(" ", "_")
            pref_params[key] = p["object_value"]

        # Step 1: Memory & Context Verification (Low risk, no approval required)
        step_1_id = f"step-recall-{uuid.uuid4().hex[:6]}"
        steps.append(
            DAGStep(
                step_id=step_1_id,
                step_number=1,
                title="Verify Context and Ingest User Preferences",
                skill_name="memory.recall_context",
                parameters={"query": user_goal, "preferences": pref_params, "verified_count": len(verified_facts)},
                dependencies=[],
                risk_level=RiskLevel.LOW,
                requires_approval=False,
            )
        )

        # Step 2: Synthesis and Analysis
        step_2_id = f"step-analyze-{uuid.uuid4().hex[:6]}"
        steps.append(
            DAGStep(
                step_id=step_2_id,
                step_number=2,
                title=f"Analyze Goal: {user_goal[:40]}...",
                skill_name="reasoning.synthesize",
                parameters={"goal": user_goal, "constraints_applied": len(context.get("constraints", []))},
                dependencies=[step_1_id],
                risk_level=RiskLevel.LOW,
                requires_approval=False,
            )
        )

        # Step 3: Execution Action (High-risk gate requiring explicit user authorization)
        # ONLY propose side effects when the user's intent explicitly requests an action.
        # Conversational questions and informational queries must never become shell/filesystem actions.
        if is_explicit_action_request(user_goal):
            step_3_id = f"step-exec-{uuid.uuid4().hex[:6]}"
            if "file" in user_goal.lower() or "write" in user_goal.lower():
                skill_name = "filesystem.write_file"
                parameters = {
                    "path": "output.txt",
                    "content": f"Verified execution output for goal: {user_goal}\nTimestamp: {utc_now_iso()}\n",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
            elif "deploy" in user_goal.lower():
                skill_name = "developer.deploy"
                parameters = {
                    "network": "local",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
            else:
                skill_name = "terminal.sandboxed_exec"
                parameters = {
                    "command": ["python", "-c", "import sys; print('Executed side-effect for: ' + sys.argv[1])", user_goal[:30]],
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }

            steps.append(
                DAGStep(
                    step_id=step_3_id,
                    step_number=3,
                    title=f"Execute Side-Effect for Goal: {user_goal[:30]}",
                    skill_name=skill_name,
                    parameters=parameters,
                    dependencies=[step_2_id],
                    risk_level=RiskLevel.HIGH,
                    requires_approval=True,
                )
            )

        return steps
