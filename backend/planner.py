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


def resolve_ollama_endpoint(raw_endpoint: Optional[str] = None) -> str:
    """
    Resolves local Ollama endpoint across Mac, Linux, and Windows.
    Normalizes missing protocol, maps 0.0.0.0 / localhost to 127.0.0.1 to avoid macOS IPv6 connection refused,
    and inspects OLLAMA_ENDPOINT, OLLAMA_HOST, and OLLAMA_BASE_URL.
    """
    ep = (
        raw_endpoint
        or os.environ.get("OLLAMA_ENDPOINT")
        or os.environ.get("OLLAMA_HOST")
        or os.environ.get("OLLAMA_BASE_URL")
        or "http://127.0.0.1:11434"
    ).strip().rstrip("/")
    if not ep.startswith(("http://", "https://")):
        ep = f"http://{ep}"
    if "://0.0.0.0" in ep:
        ep = ep.replace("://0.0.0.0", "://127.0.0.1")
    elif "://localhost" in ep:
        ep = ep.replace("://localhost", "://127.0.0.1")
    return ep


DEFAULT_OLLAMA_ENDPOINT = resolve_ollama_endpoint()


def resolve_model_name(
    model_name: Optional[str] = None,
    available_models: Optional[List[str]] = None,
) -> str:
    """
    Resolves the exact Ollama model tag.
    If the requested model is 'gemma4' or 'gemma4:latest' but the local Ollama repository
    has 'gemma4:e2b', resolves to 'gemma4:e2b' so Ollama doesn't return 404.
    """
    target = (
        model_name
        or os.environ.get("MEMORAG_MODEL")
        or os.environ.get("RAGNAROK_MODEL")
        or "gemma4:e2b"
    ).strip()

    if not available_models:
        return target

    # Exact match first
    if target in available_models:
        return target

    # Base name match (e.g., 'gemma4' -> 'gemma4:e2b', 'gemma4:latest' -> 'gemma4:e2b')
    target_base = target.split(":")[0].lower()
    for m in available_models:
        m_base = m.split(":")[0].lower()
        if m_base == target_base:
            return m

    # Fuzzy match for gemma family
    if "gemma" in target_base:
        for m in available_models:
            if "gemma" in m.lower():
                return m

    return target


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_negative_constraint(text: str) -> bool:
    """
    Checks if prompt expresses a negative constraint or prohibition on executing commands/actions.
    Requirement 6: Never treat 'do not run commands' or similar negative constraints as permission to execute.
    """
    clean = text.strip().lower()
    if not clean:
        return False

    neg_words = r"\b(do\s+not|don't|dont|never|avoid|refrain\s+from|stop|no)\b"
    action_terms = r"\b(run|exec|execute|deploy|build|modify|write|delete|create|commands?|actions?|tasks?|scripts?|side[- ]effects?)\b"

    return bool(re.search(neg_words, clean) and re.search(action_terms, clean))


def is_conversational_inquiry(text: str) -> bool:
    """
    Checks if a prompt is an ordinary greeting, question, status check, or explanation.
    Conversational inquiries must receive direct natural language answers and never spawn task DAGs.
    """
    clean = text.strip().lower()
    if not clean:
        return True

    if is_negative_constraint(clean):
        return True

    # Greetings
    greetings = {"hi", "hello", "hey", "howdy", "greetings", "good morning", "good evening", "good afternoon", "sup"}
    words_list = clean.replace("?", " ").replace(".", " ").replace(",", " ").replace("!", " ").split()
    if clean in greetings or (len(words_list) <= 3 and words_list[0] in greetings and ("can" in clean or "work" in clean or "you" in clean or len(words_list) <= 2)):
        return True

    conversational_prefixes = (
        "is ", "is it", "are ", "can you tell", "can you explain", "could you",
        "what ", "where ", "who ", "why ", "how ", "explain ", "describe ", "tell me ",
        "status", "health", "check if", "do you", "does ", "test if", "hello", "hi ", "hey "
    )
    is_question = clean.endswith("?") or any(clean.startswith(p) for p in conversational_prefixes)

    # Inquiries like "Does the model run perfectly now?", "Hi, can you work?", "Is it working?"
    if any(phrase in clean for phrase in ("can you work", "are you working", "is it working", "run perfectly", "model run")):
        return True

    if is_question:
        if any(clean.startswith(p) for p in ("does ", "is ", "are ", "what ", "why ", "how ", "status", "health", "check if", "can you tell", "can you explain")):
            return True

    return is_question and not any(verb in set(words_list) for verb in ("deploy", "execute", "build", "delete", "wipe", "backup"))


def is_explicit_action_request(text: str) -> bool:
    """
    Classifies user intent: determines whether a prompt explicitly requests
    an execution/side-effect action vs a conversational question/inquiry/greeting/negative constraint.
    Conversational questions must not generate shell or filesystem mutations.
    """
    clean = text.strip().lower()
    if not clean:
        return False

    # Negative constraints (e.g. "do not run commands") MUST NEVER be treated as permission to execute
    if is_negative_constraint(clean):
        return False

    if is_conversational_inquiry(clean):
        return False

    words = set(clean.replace("?", " ").replace(".", " ").replace(",", " ").replace("!", " ").split())

    # Explicit action verbs that genuinely request mutating, executing, or workspace-inspection operations
    action_keywords = (
        "run", "execute", "deploy", "build", "create", "write", "install",
        "delete", "remove", "wipe", "backup", "restart", "reboot", "patch",
        "modify", "apply", "kill", "terminate", "compile", "launch", "list", "read", "inspect",
        "prepare", "stage", "lint", "audit", "validate", "generate", "sync"
    )
    has_action_verb = any(verb in words for verb in action_keywords)
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
        self.ollama_endpoint = resolve_ollama_endpoint(ollama_endpoint)
        self.read_timeout = read_timeout or float(
            os.environ.get("MEMORAG_OLLAMA_TIMEOUT") or os.environ.get("OLLAMA_TIMEOUT") or 45.0
        )
        self.connect_timeout = connect_timeout or float(
            os.environ.get("MEMORAG_OLLAMA_CONNECT_TIMEOUT") or os.environ.get("OLLAMA_CONNECT_TIMEOUT") or 5.0
        )
        self.memory_service = memory_service

    def _ensure_resolved_model(self) -> str:
        """Dynamically ensures self.model matches an installed tag in Ollama if available."""
        try:
            with httpx.Client(timeout=2.0) as client:
                res = client.get(f"{self.ollama_endpoint}/api/tags")
                if res.status_code == 200:
                    models = [m.get("name") for m in res.json().get("models", []) if m.get("name")]
                    resolved = resolve_model_name(self.model, models)
                    if resolved in models:
                        self.model = resolved
        except Exception:
            pass
        return self.model

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
        context["is_task_mode"] = True

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

    def _post_ollama(self, endpoint_path: str, json_data: Dict[str, Any], timeout: httpx.Timeout) -> httpx.Response:
        """Isolated transport method for local Ollama calls, cleanly mockable in tests."""
        url = f"{self.ollama_endpoint}{endpoint_path}"
        with httpx.Client(timeout=timeout) as client:
            return client.post(url, json=json_data)

    def _call_ollama(self, system_prompt: str, user_goal: str) -> Tuple[Optional[str], Optional[str], Optional[float]]:
        """
        Queries local Ollama endpoint with configurable timeouts and bounded safe retries.
        Returns (response_text, fallback_reason, latency_ms).
        """
        import time
        self._ensure_resolved_model()
        start_time = time.perf_counter()
        fallback_reason = None
        max_retries = 1

        for attempt in range(max_retries + 1):
            try:
                timeout = httpx.Timeout(self.read_timeout, connect=self.connect_timeout)
                res = self._post_ollama(
                    "/api/generate",
                    {
                        "model": self.model,
                        "prompt": f"{system_prompt}\n\nProduce DAG JSON for goal: {user_goal}",
                        "stream": False,
                        "format": "json",
                    },
                    timeout=timeout,
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

        # Step 3: Execution Action (High-risk gate requiring explicit authorization for mutations, low risk for read-only)
        # ONLY propose side effects when the user's intent explicitly requests an action or task mode
        clean_goal = user_goal.lower()
        has_neg = is_negative_constraint(user_goal)
        is_action = (is_explicit_action_request(user_goal) or (context.get("is_task_mode") and not is_conversational_inquiry(user_goal))) and not has_neg

        if is_action:
            step_3_id = f"step-exec-{uuid.uuid4().hex[:6]}"
            # Read-only task detection (list, dir, read, inspect)
            clean_words = set(clean_goal.replace("?", " ").replace(".", " ").replace(",", " ").replace("!", " ").split())
            if any(k in clean_words for k in ("list", "dir", "directory", "ls")) and "checklist" not in clean_words:
                skill_name = "filesystem.list_dir"
                parameters = {
                    "path": ".",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
                risk_level = RiskLevel.LOW
                requires_approval = False
                title = f"List Directory: {user_goal[:30]}"
            elif any(k in clean_goal for k in ("read", "inspect_file", "view file")) and not any(k in clean_goal for k in ("write", "overwrite", "delete")):
                skill_name = "filesystem.read_file"
                parameters = {
                    "path": "output.txt",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
                risk_level = RiskLevel.LOW
                requires_approval = False
                title = f"Read File: {user_goal[:30]}"
            elif "file" in clean_goal or "write" in clean_goal:
                skill_name = "filesystem.write_file"
                parameters = {
                    "path": "output.txt",
                    "content": f"Verified execution output for goal: {user_goal}\nTimestamp: {utc_now_iso()}\n",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
                risk_level = RiskLevel.HIGH
                requires_approval = True
                title = f"Write File: {user_goal[:30]}"
            elif "deploy" in clean_goal:
                skill_name = "developer.deploy"
                parameters = {
                    "network": "local",
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
                risk_level = RiskLevel.HIGH
                requires_approval = True
                title = f"Deploy: {user_goal[:30]}"
            else:
                skill_name = "terminal.sandboxed_exec"
                parameters = {
                    "command": ["python", "-c", "import sys; print('Executed side-effect for: ' + sys.argv[1])", user_goal[:30]],
                    "goal": user_goal,
                    "user_preferences": pref_params,
                }
                risk_level = RiskLevel.HIGH
                requires_approval = True
                title = f"Execute Command: {user_goal[:30]}"

            steps.append(
                DAGStep(
                    step_id=step_3_id,
                    step_number=3,
                    title=title,
                    skill_name=skill_name,
                    parameters=parameters,
                    dependencies=[step_2_id],
                    risk_level=risk_level,
                    requires_approval=requires_approval,
                )
            )

        return steps

    def generate_chat_response(
        self,
        prompt: str,
        context: Dict[str, Any],
        history: Optional[List[Dict[str, Any]]] = None,
        is_capability_query: bool = False,
    ) -> Tuple[str, Optional[str], float, str]:
        """
        Executes actual natural language inference using Ollama gemma4:e2b.
        Returns (content, fallback_reason, latency_ms, thought_trace).
        If Ollama is unavailable or times out, returns a truthful, useful fallback.
        Never fabricates model output or claims an operation succeeded.
        """
        import time
        start_time = time.perf_counter()

        # Format durable memory context
        formatted_context = context.get("formatted_context", "No specific prior preferences or verified constraints found.")

        # Check for capability query
        p_lower = prompt.lower()
        capability_keywords = (
            "what can you do", "capabilities", "what do you do", "what are your capabilities",
            "your skills", "what tools", "list your capabilities", "what features do you have"
        )
        is_capability = is_capability_query or any(kw in p_lower for kw in capability_keywords)

        if is_capability:
            system_prompt = (
                f"You are MEMORAG's Sovereign Personal Assistant (Ragnarok Hackathon Architecture).\n"
                f"Active Local Model: {self.model}\n\n"
                f"OPERATIONAL INSTRUCTION:\n"
                f"When asked what you can do or about your capabilities, provide a direct, concise bulleted list of your 5 registered operational tools:\n"
                f"- filesystem.operations: Inspect directories, read and write files within sandbox boundaries.\n"
                f"- terminal.sandboxed_exec: Execute privileged toolchain commands with human approval gates.\n"
                f"- memory.recall_and_weave: Recall encrypted semantic knowledge, preferences, and episodic memory.\n"
                f"- communication.email_triage: Triage local threads and stage response drafts.\n"
                f"- developer.git_flow: Inspect repository status, stage branches, and coordinate release packages.\n"
                f"Do not explain abstract security policies or internal system architectures; present the 5 operational capabilities directly."
            )
        else:
            # Truthful system prompt
            system_prompt = (
                f"You are MEMORAG's Sovereign Personal Assistant (Ragnarok Hackathon Architecture).\n"
                f"Active Local Model: {self.model}\n"
                f"Security Policy: Local loopback execution only (127.0.0.1). Zero outbound telemetry.\n\n"
                f"=== VERIFIED DURABLE MEMORY CONTEXT ===\n"
                f"{formatted_context}\n"
                f"=======================================\n\n"
                f"GUIDELINES:\n"
                f"1. Respond directly, naturally, and concisely to the operator's prompt.\n"
                f"2. Clearly identify as MEMORAG when describing your operating policy or system identity.\n"
                f"3. Use the durable memory context above when relevant. Do NOT fabricate, pretend to remember, or hallucinate facts that are not present in the context.\n"
                f"4. Never claim that an operation, script, or side-effect succeeded if it has not been executed.\n"
                f"5. If a negative constraint is given (e.g. 'do not run commands'), confirm that no commands will be run and that backend authorization remains authoritative.\n"
            )

        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            for item in history[-10:]:
                role = "assistant" if item.get("role") in ("agent", "assistant") else "user"
                c = item.get("content", "")
                if c:
                    messages.append({"role": role, "content": str(c)})

        messages.append({"role": "user", "content": prompt})

        fallback_reason = None
        response_text = None
        max_retries = 1
        self._ensure_resolved_model()

        for attempt in range(max_retries + 1):
            try:
                timeout = httpx.Timeout(self.read_timeout, connect=self.connect_timeout)
                res = self._post_ollama(
                    "/api/chat",
                    {
                        "model": self.model,
                        "messages": messages,
                        "stream": False,
                        "keep_alive": "30m",
                        "options": {
                            "temperature": 0.2,
                        },
                    },
                    timeout=timeout,
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                if res.status_code == 200:
                    data = res.json()
                    msg = data.get("message", {}).get("content", "").strip()
                    if not msg and data.get("message", {}).get("thinking"):
                        msg = data.get("message", {}).get("thinking", "").strip()
                    if not msg and data.get("response"):
                        msg = data.get("response", "").strip()
                    if msg:
                        response_text = msg
                        break
                    else:
                        fallback_reason = "Ollama returned empty response content."
                        break
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
                    continue
            except Exception as e:
                fallback_reason = f"Ollama inference error: {str(e)}"
                break

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

        if response_text:
            thought_trace = (
                f"Generated via local model {self.model} in {latency_ms}ms. "
                f"Queried memory vault ({len(context.get('verified_facts', []))} facts, "
                f"{len(context.get('preferences', []))} preferences). Zero outbound telemetry."
            )
            return response_text, None, latency_ms, thought_trace

        # Model is unavailable or timed out: return a truthful, useful fallback.
        # NEVER fabricate model output or claim an operation succeeded.
        thought_trace = f"Local model inference unavailable: {fallback_reason}. Truthful fallback engaged. Zero outbound telemetry."
        if is_capability:
            fallback_content = (
                f"MEMORAG Sovereign Agent operational capabilities:\n"
                f"- filesystem.operations: Inspect directories, read and write files within sandbox boundaries.\n"
                f"- terminal.sandboxed_exec: Execute privileged toolchain commands with human approval gates.\n"
                f"- memory.recall_and_weave: Recall encrypted semantic knowledge, preferences, and episodic memory.\n"
                f"- communication.email_triage: Triage local threads and stage response drafts.\n"
                f"- developer.git_flow: Inspect repository status, stage branches, and coordinate release packages."
            )
        else:
            fallback_content = (
                f"[Inference Fallback] Local model '{self.model}' is currently unavailable ({fallback_reason}). "
                f"The MEMORAG agent runtime is active, durable memory and security boundaries are intact, "
                f"but live LLM text generation did not complete."
            )
        return fallback_content, fallback_reason, latency_ms, thought_trace

