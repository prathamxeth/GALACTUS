/**
 * MEMORAG Forge Core Types
 * 
 * Defines domain models for:
 * - IDE Project Explorer & Virtual File Buffer
 * - Project Flight Recorder & Healthy Checkpoint System
 * - Capability-Aware On-Device Preflight & Environment Inspector
 * - Sandboxed Local Execution Boundary & Approvals
 */

export interface FileEntry {
  name: string;
  path: string; // Relative to project root
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  children?: FileEntry[];
  isGitModified?: boolean;
  isGitUntracked?: boolean;
}

export interface OpenFileTab {
  id: string;
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
  cursorLine: number;
  cursorCol: number;
  proposedPatch?: {
    diff: string;
    replacementContent: string;
    rationale: string;
    approvalId: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface DiagnosticProblem {
  id: string;
  source: 'build' | 'test' | 'lint' | 'typescript' | 'runtime' | 'environment';
  severity: 'error' | 'warning' | 'info';
  message: string;
  filePath?: string;
  line?: number;
  col?: number;
  ruleId?: string;
  timestamp: string;
  suggestedAction?: string;
}

export type FlightEventType =
  | 'project_opened'
  | 'git_change'
  | 'manifest_changed'
  | 'build_started'
  | 'build_passed'
  | 'build_failed'
  | 'test_started'
  | 'test_passed'
  | 'test_failed'
  | 'command_executed'
  | 'task_started'
  | 'task_approval_requested'
  | 'task_completed'
  | 'task_failed'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'patch_proposed'
  | 'patch_accepted'
  | 'patch_rejected';

export interface FlightEvent {
  id: string;
  timestamp: string;
  projectId?: string;
  type: FlightEventType;
  summary: string;
  details?: Record<string, unknown>;
  evidence?: {
    command?: string;
    exitCode?: number;
    outputExcerpt?: string;
    gitCommit?: string;
    modifiedFiles?: string[];
    affectedPath?: string;
    errorCount?: number;
    approvalId?: string;
    passed?: boolean;
    exitCodes?: Record<string, number>;
    commands?: string[];
  };
  healthyState?: boolean;
  provenance: 'user' | 'system' | 'agent' | 'terminal';
}

export interface ProjectCheckpoint {
  id: string;
  timestamp: string;
  title: string;
  gitCommit: string;
  gitBranch: string;
  isHealthy: boolean; // True ONLY if tests and build actually passed
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    durationMs?: number;
  };
  dependencyFingerprint: string;
  modifiedFilesCount: number;
  evidenceSnapshot: {
    testsExitCode?: number;
    buildExitCode?: number;
    headCommit?: string;
    packageJsonHash?: string;
  };
}

export interface PreflightEnvironmentReport {
  timestamp: string;
  os: {
    platform: string;
    arch: string;
    release: string;
    cpus: number;
  };
  resources: {
    totalRamMb: number;
    freeRamMb: number;
    processMemoryMb: number;
    diskSpaceGb?: number;
  };
  git: {
    installed: boolean;
    branch: string;
    commit: string;
    isClean: boolean;
    modifiedCount: number;
    modifiedFiles: string[];
  };
  toolchains: {
    node: { version: string; available: boolean };
    npm: { version: string; available: boolean };
    python: { version: string; available: boolean };
    git: { version: string; available: boolean };
  };
  backend: {
    url: string;
    reachable: boolean;
    latencyMs: number;
    model: string;
    ollamaStatus: string;
    activeModelLoaded: boolean;
    serviceName?: string;
  };
  security: {
    projectRoot: string;
    isolationMode: 'constrained_loopback';
    approvalRequiredForModifications: boolean;
  };
}

export interface TerminalCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  cwd?: string;
  timestamp: string;
}

export interface WhatChangedComparison {
  lastPassingCheckpoint: ProjectCheckpoint | null;
  currentGitState: {
    branch: string;
    commit: string;
    modifiedFiles: string[];
  };
  differences: {
    modifiedFiles: string[];
    dependencyChanges: string[];
    failingTests: string[];
    newErrors: string[];
  };
  correlationAnalysis: string;
  confidenceScore: number; // 0.0 - 1.0 (honestly separated from causation)
  suggestedPatch?: {
    filePath: string;
    rationale: string;
    diff: string;
    replacementContent: string;
    approvalId: string;
  };
}

export interface ForgeApprovalPrompt {
  id: string;
  actionType: 'write_file' | 'execute_command' | 'restore_checkpoint' | 'apply_patch';
  title: string;
  description: string;
  targetPath?: string;
  command?: string;
  diff?: string;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
}
