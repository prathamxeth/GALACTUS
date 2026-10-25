/**
 * MEMORAG Sovereign AI Agent - Type Definitions
 * Aligned with MEMORAG Research Proposal (FR1-FR4, NFR1-NFR4)
 */

export type TruthfulRuntimeState =
  | 'Offline Preview'
  | 'Backend Disconnected'
  | 'Backend Connected'
  | 'AI Model Ready'
  | 'Task Running'
  | 'Approval Required'
  | 'Task Failed'
  | 'Task Completed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed';

export type StepStatus = 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';

export type MemoryType = 'episodic' | 'semantic';

export type SemanticCategory = 'fact' | 'preference' | 'entity' | 'rule';

export type SkillCategory = 'system' | 'filesystem' | 'network' | 'communication' | 'developer';

export type TriggerType = 'file_watcher' | 'cron' | 'inbox_poll' | 'system_event';

export type AudienceMode = 'user' | 'developer';

export type AppearancePreset = 'light' | 'dark' | 'oled-light' | 'oled-dark';

export interface SystemEventLog {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  eventType: string;
  message: string;
  taskId?: string;
  skillName?: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  category: 'latency' | 'resource' | 'model' | 'storage';
  measured: boolean;
  note?: string;
  timestamp?: string;
}

// --- System & Agent Health ---
export interface AgentRuntimeStatus {
  online: boolean;
  model: string;
  ollamaEndpoint: string;
  ollamaStatus: 'connected' | 'disconnected' | 'degraded';
  latencyMs: number;
  cpuPercent: number;
  ramUsageMb: number;
  encryptedDatabase: {
    status: 'locked' | 'unlocked';
    algorithm: string;
    totalRecords: number;
    sizeKb: number;
  };
  telemetry: {
    outboundBytes: number;
    sovereignGuarantee: boolean;
    lastAuditTimestamp: string;
  };
  activeSentinelsCount: number;
  pendingApprovalsCount: number;
  activeModelLoaded?: boolean;
  serviceName?: string;
}

export interface SSETaskEvent {
  task_id: string;
  event: string;
  data: Record<string, unknown>;
}

// --- Chat & Command Center ---
export interface ActionProposal {
  id: string;
  toolName: string;
  actionTitle: string;
  description: string;
  riskLevel: RiskLevel;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  thoughtTrace?: string; // Seer's telling / chain of thought (NFR4.1)
  citedMemoryIds?: string[]; // Referenced memories from Mimir's well
  actionProposal?: ActionProposal; // Embedded approval gate
  relatedTaskId?: string;
}

// --- Autonomous Workflow & Task Execution ---
export interface TaskStep {
  id: string;
  stepNumber: number;
  title: string;
  skillName: string;
  status: StepStatus;
  parameters: Record<string, unknown>;
  output?: string;
  error?: string;
  reflectionAttempt: number; // FR3.3 self-correction loop count
  startedAt?: string;
  completedAt?: string;
  approvalRequestId?: string;
}

export interface TaskGraph {
  id: string;
  goal: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  steps: TaskStep[];
  priority: 'low' | 'normal' | 'high';
  estimatedDurationMs?: number;
  errorMessage?: string;
}

// --- Approval Gates (FR4.3 Role-Based Access Control) ---
export interface ApprovalRequest {
  id: string;
  taskId: string;
  stepId: string;
  taskGoal: string;
  actionTitle: string;
  toolName: string;
  riskLevel: RiskLevel;
  rationale: string;
  commandOrPayload: string;
  parameters: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'denied' | 'expired';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface PermissionApprovalPayload {
  request_id: string;
  requestId?: string;
  task_id?: string;
  approved: boolean;
  decision: 'approved' | 'denied';
  notes?: string;
}

export interface PermissionApprovalResponse {
  success: boolean;
  status: 'approved' | 'denied' | 'pending';
  message?: string;
}

// --- Memory Vault Backend Contracts (FR1) ---
export interface BackendEpisodicMemory {
  id: string | number;
  timestamp?: string;
  created_at?: string;
  title?: string;
  event_type?: string;
  content?: string;
  description?: string;
  source_event?: string;
  source?: string;
  importance_score?: number;
  importanceScore?: number;
  tags?: string[];
  pinned?: boolean;
}

export interface BackendSemanticMemory {
  id: string | number;
  category: string;
  fact_key: string;
  fact_content: string;
  is_verified?: boolean;
  tokens?: number;
  created_at?: string;
  updated_at?: string;
  subject?: string;
  statement?: string;
}

export interface CreateSemanticFactRequest {
  category: string;
  fact_key: string;
  fact_content: string;
  is_verified: boolean;
  tokens: number;
}

export interface EpisodicMemory {
  id: string;
  type: 'episodic';
  title: string;
  content: string;
  timestamp: string;
  sourceEvent: string;
  importanceScore: number; // 0.0 to 1.0
  tags: string[];
  pinned?: boolean;
  isBackendRecord?: boolean;
}

export interface SemanticMemory {
  id: string;
  type: 'semantic';
  category: SemanticCategory;
  subject: string;
  statement: string;
  confidence: number; // 0.0 to 1.0
  updatedAt: string;
  accessCount: number;
  decayFactor: number; // 0.0 to 1.0 (forgetting mechanism FR1.3)
  embeddingDim?: number;
  factKey?: string;
  isVerified?: boolean;
  tokens?: number;
  isBackendRecord?: boolean;
}

export type MemoryRecord = EpisodicMemory | SemanticMemory;

// --- Task & Action Details Backend Contracts (FR3 / FR4) ---
export type BackendTaskStatus =
  | 'PAUSED_APPROVAL'
  | 'awaiting_approval'
  | 'running'
  | 'queued'
  | 'pending'
  | 'failed'
  | 'completed';

export interface BackendTaskActionDetails {
  tool_name?: string;
  toolName?: string;
  action_title?: string;
  actionTitle?: string;
  description?: string;
  rationale?: string;
  parameters?: Record<string, unknown>;
  risk_level?: RiskLevel;
  riskLevel?: RiskLevel;
  command?: string;
}

export interface BackendIncompleteTask {
  id: string;
  goal: string;
  status: BackendTaskStatus | string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  steps?: TaskStep[];
  action_details?: BackendTaskActionDetails;
  actionDetails?: BackendTaskActionDetails;
  approval_request_id?: string;
  approvalRequestId?: string;
  priority?: 'low' | 'normal' | 'high';
  error_message?: string;
  errorMessage?: string;
}

// --- Registered Skills & Dwarves' Forge (FR2) ---
export interface SkillParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface SkillDefinition {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: SkillCategory;
  isSandboxed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  parameters: SkillParameter[];
  executionCount: number;
  lastExecutedAt?: string;
  enabled: boolean;
  isMock?: boolean;
  isIncomplete?: boolean;
}

// --- Background Sentinel Triggers (FR4.1) ---
export interface SentinelTrigger {
  id: string;
  name: string;
  type: TriggerType;
  patternOrSchedule: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  actionSummary: string;
  eventCount: number;
}

// --- Privacy & System Settings ---
export interface PrivacySettings {
  localOnlyMode: boolean;
  ollamaHost: string;
  selectedModel: string;
  databaseEncryption: boolean;
  memoryAutoForgetting: boolean;
  forgettingThresholdDays: number;
  maxCpuUsagePercent: number;
  rbacStrictApproval: boolean;
  backgroundTriggersEnabled: boolean;
  fastApiBackendUrl: string;
}

// ============================================================================
// MEMORAG Forge Diagnostics & Project Flight Recorder (Authoritative Contracts)
// ============================================================================

export type FindingCategory =
  | 'syntax_error'
  | 'dependency_mismatch'
  | 'missing_toolchain'
  | 'test_failure'
  | 'build_failure'
  | 'config_error'
  | 'permission_violation'
  | 'insufficient_evidence'
  | 'environment_inspection'
  | 'unknown';

export type DiagnosticSourceType =
  | 'command_output'
  | 'git_diff'
  | 'environment_inspection'
  | 'static_check'
  | 'memory_vault'
  | 'toolchain_check'
  | 'llm_hypothesis';

export type FindingStatus = 'verified' | 'hypothesis' | 'disproved';

export interface EvidenceFinding {
  finding_id: string;
  task_id: string;
  category: FindingCategory;
  summary: string;
  evidence_refs: string[];
  source_type: DiagnosticSourceType;
  observed_at?: string;
  confidence: number; // 0.0 to 1.0
  status: FindingStatus;
  limitations?: string | null;
}

export interface ProposedAction {
  action_id?: string;
  action_type: 'file_patch' | 'file_write' | 'install_package' | 'command' | string;
  target_path?: string | null;
  diff_patch?: string | null;
  content?: string | null;
  command?: string | null;
  risk_level: RiskLevel;
  requires_approval: boolean;
}

export interface RepairProposal {
  proposal_id: string;
  task_id: string;
  summary: string;
  explanation: string;
  supporting_evidence_ids: string[];
  files_to_modify: string[];
  exact_patch?: string | null;
  actions: ProposedAction[];
  risk_level: RiskLevel;
  requires_approval: boolean;
  expected_verification_commands: string[];
  limitations?: string | null;
  recovery_checkpoint_id?: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | string;
  approval_id?: string | null;
}

export interface RecoveryOption {
  recovery_id: string;
  task_id: string;
  description: string;
  checkpoint_id?: string | null;
  backup_path?: string | null;
  is_available: boolean;
  recovery_command?: string | null;
}

export interface VerificationResult {
  verification_id: string;
  task_id: string;
  proposal_id?: string | null;
  passed: boolean;
  commands_executed: string[];
  exit_codes: Record<string, number>;
  outputs: Record<string, string>;
  summary: string;
  executed_at?: string;
}

export type DiagnosticTaskStatus =
  | 'IDLE'
  | 'INSPECTING'
  | 'DIAGNOSED'
  | 'AWAITING_APPROVAL'
  | 'REPAIRING'
  | 'VERIFIED'
  | 'FAILED'
  | 'RECOVERED'
  | 'OFFLINE'
  | 'ERROR';

export interface DiagnosticReport {
  task_id: string;
  project_root: string;
  user_request: string;
  observed_facts: EvidenceFinding[];
  relevant_memory: Record<string, unknown>[];
  hypotheses: EvidenceFinding[];
  proposed_repair?: RepairProposal | null;
  approval_requirements?: Record<string, unknown>;
  verification_results?: VerificationResult | null;
  recovery_options: RecoveryOption[];
  status: DiagnosticTaskStatus | string;
  diagnosed_at?: string;
}

export interface BackendFlightRecorderEvent {
  event_id: string;
  task_id: string;
  event_type: string;
  timestamp: string;
  details: Record<string, unknown>;
  evidence_refs: string[];
  source: string;
}

export interface AnalyzeProjectRequest {
  project_root: string;
  user_request?: string;
}

export interface ResolveRepairRequest {
  approval_id: string;
  decision: 'approved' | 'rejected';
  notes?: string | null;
}

export type SSEStreamStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
