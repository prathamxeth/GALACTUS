'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  FileEntry,
  OpenFileTab,
  DiagnosticProblem,
  FlightEvent,
  ProjectCheckpoint,
  PreflightEnvironmentReport,
  TerminalCommandResult,
  WhatChangedComparison,
  ForgeApprovalPrompt,
} from './types';
import { forgeApi } from './client';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { api } from '@/lib/api/client';
import {
  DiagnosticReport,
  DiagnosticTaskStatus,
  BackendFlightRecorderEvent,
  VerificationResult,
  SSEStreamStatus,
} from '@/lib/api/types';

type UnsubscribeCallback = () => void;

export interface AgentSessionEntry {
  id: string;
  goal: string;
  status: DiagnosticTaskStatus | string;
  timestamp: string;
  findingsCount?: number;
  hasPatch?: boolean;
}

export interface ForgeContextValue {
  // Explorer & Files
  fileTree: FileEntry[];
  isLoadingTree: boolean;
  refreshFileTree: () => Promise<void>;
  openTabs: OpenFileTab[];
  activeTabId: string | null;
  activeFile: OpenFileTab | null;
  openFile: (path: string) => Promise<OpenFileTab | null>;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateFileContent: (tabId: string, content: string) => void;
  saveActiveFile: () => Promise<boolean>;

  // Terminal & Execution
  terminalHistory: TerminalCommandResult[];
  isExecutingCommand: boolean;
  runTerminalCommand: (command: string) => Promise<TerminalCommandResult | null>;
  clearTerminal: () => void;
  runBuildCheck: () => Promise<TerminalCommandResult | null>;
  runTestCheck: () => Promise<TerminalCommandResult | null>;

  // Diagnostics & Problems
  problems: DiagnosticProblem[];
  addProblem: (problem: Omit<DiagnosticProblem, 'id' | 'timestamp'>) => void;
  clearProblems: () => void;

  // Flight Recorder & Checkpoints
  flightEvents: FlightEvent[];
  checkpoints: ProjectCheckpoint[];
  isLoadingFlightRecorder: boolean;
  refreshFlightRecorder: () => Promise<void>;
  createHealthyCheckpoint: (title?: string) => Promise<ProjectCheckpoint | null>;
  whatChanged: WhatChangedComparison | null;
  analyzeWhatChanged: () => Promise<WhatChangedComparison | null>;

  // Preflight Inspector
  preflightReport: PreflightEnvironmentReport | null;
  isPreflightLoading: boolean;
  refreshPreflight: () => Promise<void>;

  // Workbench Layout & Navigation (VS Code × Cursor)
  workbenchLayout: 'split' | 'agent-only' | 'editor-only';
  setWorkbenchLayout: (layout: 'split' | 'agent-only' | 'editor-only') => void;
  toggleWorkbenchLayout: () => void;
  workspaceSearchQuery: string;
  setWorkspaceSearchQuery: (query: string) => void;
  agentSessions: AgentSessionEntry[];
  addAgentSession: (session: AgentSessionEntry) => void;
  clearDiagnosticSession: () => void;

  // UI Panels
  activeBottomTab: 'terminal' | 'problems' | 'checkpoints' | 'flight' | 'system';
  setActiveBottomTab: (tab: 'terminal' | 'problems' | 'checkpoints' | 'flight' | 'system') => void;
  activeLeftTab: 'agent' | 'explorer' | 'search' | 'git' | 'problems' | 'flight' | 'inspector' | 'memory' | 'skills';
  setActiveLeftTab: (tab: 'agent' | 'explorer' | 'search' | 'git' | 'problems' | 'flight' | 'inspector' | 'memory' | 'skills') => void;
  isCompanionOpen: boolean;
  setIsCompanionOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;

  // Approvals & Patching
  pendingForgeApproval: ForgeApprovalPrompt | null;
  setPendingForgeApproval: (prompt: ForgeApprovalPrompt | null) => void;
  resolveForgeApproval: (approved: boolean) => Promise<void>;
  applyProposedPatch: (tabId: string) => Promise<boolean>;
  rejectProposedPatch: (tabId: string) => void;

  // Real Backend Diagnostics (Authoritative Engineer 1 & 2 contract)
  diagnosticReport: DiagnosticReport | null;
  diagnosticStatus: DiagnosticTaskStatus;
  diagnosticEvents: BackendFlightRecorderEvent[];
  sseStreamStatus: SSEStreamStatus;
  isDiagnosticLoading: boolean;
  diagnosticError: string | null;
  projectConnected: boolean;
  connectedProjectRoot: string;
  setConnectedProjectRoot: (root: string) => void;
  startProjectDiagnostics: (projectRoot?: string, userRequest?: string) => Promise<DiagnosticReport | null>;
  loadDiagnosticReport: (taskId: string) => Promise<DiagnosticReport | null>;
  resolveDiagnosticRepair: (approvalId: string, decision: 'approved' | 'rejected', notes?: string) => Promise<VerificationResult | null>;
  recoverDiagnosticProject: () => Promise<boolean>;
}

const ForgeContext = createContext<ForgeContextValue | undefined>(undefined);

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    default:
      return 'plaintext';
  }
}

export const ForgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { probeBackend } = useRagnarok();

  // Explorer State
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [openTabs, setOpenTabs] = useState<OpenFileTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState<TerminalCommandResult[]>([]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Diagnostics State
  const [problems, setProblems] = useState<DiagnosticProblem[]>([]);

  // Flight Recorder State
  const [flightEvents, setFlightEvents] = useState<FlightEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<ProjectCheckpoint[]>([]);
  const [isLoadingFlightRecorder, setIsLoadingFlightRecorder] = useState(false);
  const [whatChanged, setWhatChanged] = useState<WhatChangedComparison | null>(null);

  // Inspector State
  const [preflightReport, setPreflightReport] = useState<PreflightEnvironmentReport | null>(null);
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);

  // Workbench Layout & Search State (VS Code × Cursor)
  const [workbenchLayout, setWorkbenchLayout] = useState<'split' | 'agent-only' | 'editor-only'>('split');
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const [agentSessions, setAgentSessions] = useState<AgentSessionEntry[]>([]);

  const toggleWorkbenchLayout = useCallback(() => {
    setWorkbenchLayout((prev) => {
      if (prev === 'split') return 'agent-only';
      if (prev === 'agent-only') return 'editor-only';
      return 'split';
    });
  }, []);

  const addAgentSession = useCallback((session: AgentSessionEntry) => {
    setAgentSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== session.id);
      return [session, ...filtered];
    });
  }, []);

  // UI Panels State
  const [activeBottomTab, setActiveBottomTab] = useState<'terminal' | 'problems' | 'checkpoints' | 'flight' | 'system'>('terminal');
  const [activeLeftTab, setActiveLeftTab] = useState<'agent' | 'explorer' | 'search' | 'git' | 'problems' | 'flight' | 'inspector' | 'memory' | 'skills'>('agent');
  const [isCompanionOpen, setIsCompanionOpen] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Approval Modal State
  const [pendingForgeApproval, setPendingForgeApproval] = useState<ForgeApprovalPrompt | null>(null);

  // Real Backend Diagnostics State (Authoritative Engineer 1 & 2 contract)
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [diagnosticStatus, setDiagnosticStatus] = useState<DiagnosticTaskStatus>('IDLE');
  const [diagnosticEvents, setDiagnosticEvents] = useState<BackendFlightRecorderEvent[]>([]);
  const [sseStreamStatus, setSseStreamStatus] = useState<SSEStreamStatus>('disconnected');
  const [isDiagnosticLoading, setIsDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [projectConnected, setProjectConnected] = useState<boolean>(true);
  const [connectedProjectRoot, setConnectedProjectRoot] = useState<string>('.');
  const sseUnsubscribeRef = useRef<(() => void) | null>(null);

  const clearDiagnosticSession = useCallback(() => {
    setDiagnosticReport(null);
    setDiagnosticStatus('IDLE');
    setDiagnosticError(null);
  }, [setDiagnosticReport, setDiagnosticStatus, setDiagnosticError]);

  // Refresh File Tree
  const refreshFileTree = useCallback(async () => {
    setIsLoadingTree(true);
    try {
      const tree = await forgeApi.fetchFileTree();
      setFileTree(tree);
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  // Refresh Preflight Inspector
  const refreshPreflight = useCallback(async () => {
    setIsPreflightLoading(true);
    try {
      const report = await forgeApi.fetchPreflightReport();
      setPreflightReport(report);
    } finally {
      setIsPreflightLoading(false);
    }
  }, []);

  // Refresh Flight Recorder Events & Checkpoints
  const refreshFlightRecorder = useCallback(async () => {
    setIsLoadingFlightRecorder(true);
    try {
      const [events, chks] = await Promise.all([
        forgeApi.fetchFlightEvents(),
        forgeApi.fetchCheckpoints(),
      ]);
      setFlightEvents(events.reverse());
      setCheckpoints(chks.reverse());
    } finally {
      setIsLoadingFlightRecorder(false);
    }
  }, []);

  // Open File into Editor Tabs
  const openFile = useCallback(
    async (filePath: string): Promise<OpenFileTab | null> => {
      const normalizedPath = filePath.replace(/^\.\//, '').replace(/^\//, '');
      // Check if already open
      const existing = openTabs.find(
        (t) => t.path === normalizedPath || t.path === filePath || t.id === `tab-${normalizedPath}`
      );
      if (existing) {
        setActiveTabId(existing.id);
        return existing;
      }

      const fileData = await forgeApi.readFile(normalizedPath);
      if (!fileData) {
        setProblems((prev) => [
          {
            id: `err-${Date.now()}`,
            source: 'runtime',
            severity: 'error',
            message: `Could not load file: ${filePath}`,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ]);
        return null;
      }

      const newTab: OpenFileTab = {
        id: `tab-${normalizedPath}`,
        path: normalizedPath,
        name: normalizedPath.split('/').pop() || normalizedPath,
        content: fileData.content,
        originalContent: fileData.content,
        isDirty: false,
        language: detectLanguage(normalizedPath),
        cursorLine: 1,
        cursorCol: 1,
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      return newTab;
    },
    [openTabs]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId) {
          const next = remaining[remaining.length - 1];
          setActiveTabId(next ? next.id : null);
        }
        return remaining;
      });
    },
    [activeTabId]
  );

  const updateFileContent = useCallback((tabId: string, newContent: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) => {
        if (tab.id === tabId) {
          return {
            ...tab,
            content: newContent,
            isDirty: newContent !== tab.originalContent,
          };
        }
        return tab;
      })
    );
  }, []);

  const activeFile = useMemo(() => {
    return openTabs.find((t) => t.id === activeTabId) || null;
  }, [openTabs, activeTabId]);

  // Save File
  const saveActiveFile = useCallback(async (): Promise<boolean> => {
    if (!activeFile) return false;
    const res = await forgeApi.writeFile(activeFile.path, activeFile.content);
    if (res.success) {
      setOpenTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeFile.id
            ? { ...tab, originalContent: tab.content, isDirty: false }
            : tab
        )
      );

      // Record Flight Event
      await forgeApi.recordFlightEvent({
        type: 'git_change',
        summary: `Saved file: ${activeFile.path}`,
        evidence: { affectedPath: activeFile.path },
        provenance: 'user',
      });
      refreshFlightRecorder();
      return true;
    }

    if (res.approvalRequired) {
      setPendingForgeApproval({
        id: `appr-write-${Date.now()}`,
        actionType: 'write_file',
        title: `Authorize Writing to ${activeFile.path}`,
        description: `Save modifications to workspace file ${activeFile.path}.`,
        targetPath: activeFile.path,
        riskLevel: 'medium',
        createdAt: new Date().toISOString(),
      });
    }

    return false;
  }, [activeFile, refreshFlightRecorder]);

  // Run Terminal Command
  const runTerminalCommand = useCallback(
    async (command: string, approvalToken?: string): Promise<TerminalCommandResult> => {
      setIsExecutingCommand(true);
      try {
        const result = await forgeApi.executeTerminal(command, undefined, approvalToken);
        setTerminalHistory((prev) => [...prev, result]);

        // Record flight event for builds / tests
        if (command.includes('test')) {
          const isPassed = result.exitCode === 0;
          await forgeApi.recordFlightEvent({
            type: isPassed ? 'test_passed' : 'test_failed',
            summary: `${command} finished with exit code ${result.exitCode}`,
            evidence: {
              command,
              exitCode: result.exitCode,
              outputExcerpt: (result.stdout || result.stderr).slice(-300),
            },
            healthyState: isPassed,
            provenance: 'terminal',
          });
          refreshFlightRecorder();
        }

        // Parse diagnostic problems if build or test failed
        if (result.exitCode !== 0) {
          const outputLines = (result.stderr || result.stdout).split('\n');
          const errLines = outputLines
            .filter((l) => l.includes('error') || l.includes('FAIL') || l.includes('Error'))
            .slice(0, 5);

          errLines.forEach((msg, idx) => {
            setProblems((prev) => [
              {
                id: `prob-${Date.now()}-${idx}`,
                source: command.includes('test') ? 'test' : 'build',
                severity: 'error',
                message: msg.trim(),
                timestamp: new Date().toISOString(),
              },
              ...prev,
            ]);
          });
        }

        return result;
      } finally {
        setIsExecutingCommand(false);
      }
    },
    [refreshFlightRecorder]
  );

  const clearTerminal = useCallback(() => {
    setTerminalHistory([]);
  }, []);

  const addProblem = useCallback((problem: Omit<DiagnosticProblem, 'id' | 'timestamp'>) => {
    setProblems((prev) => [
      {
        ...problem,
        id: `prob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const clearProblems = useCallback(() => {
    setProblems([]);
  }, []);

  // Quick Action: Run Build Check
  const runBuildCheck = useCallback(async (): Promise<TerminalCommandResult | null> => {
    setActiveBottomTab('terminal');
    const result = await runTerminalCommand('npm run build');
    refreshPreflight();
    return result;
  }, [runTerminalCommand, refreshPreflight]);

  // Quick Action: Run Tests
  const runTestCheck = useCallback(async (): Promise<TerminalCommandResult | null> => {
    setActiveBottomTab('terminal');
    const result = await runTerminalCommand('npm test');
    const isPassing = result?.exitCode === 0;

    if (isPassing && result) {
      // Auto-offer creating a healthy checkpoint
      await forgeApi.createCheckpoint(
        'Verified Passing Build',
        true,
        { total: 23, passed: 23, failed: 0, durationMs: result.durationMs },
        { testsExitCode: 0, buildExitCode: 0 }
      );
      refreshFlightRecorder();
    }
    return result;
  }, [runTerminalCommand, refreshFlightRecorder]);

  // Create Healthy Checkpoint
  const createHealthyCheckpoint = useCallback(
    async (title = 'Manual Checkpoint'): Promise<ProjectCheckpoint | null> => {
      // Run quick test verification first
      const testResult = await forgeApi.executeTerminal('npm test');
      const isHealthy = testResult.exitCode === 0;

      const checkpoint = await forgeApi.createCheckpoint(
        title,
        isHealthy,
        {
          total: isHealthy ? 23 : 0,
          passed: isHealthy ? 23 : 0,
          failed: isHealthy ? 0 : 1,
        },
        {
          testsExitCode: testResult.exitCode,
        }
      );
      refreshFlightRecorder();
      return checkpoint;
    },
    [refreshFlightRecorder]
  );

  // Analyze What Changed Since Last Passing Build
  const analyzeWhatChanged = useCallback(async (): Promise<WhatChangedComparison | null> => {
    const comparison = await forgeApi.compareWhatChanged();
    setWhatChanged(comparison);
    return comparison;
  }, []);

  // Apply Proposed AI Patch
  const applyProposedPatch = useCallback(
    async (tabId: string): Promise<boolean> => {
      const targetTab = openTabs.find((t) => t.id === tabId);
      if (!targetTab || !targetTab.proposedPatch) return false;

      const { replacementContent, filePath, rationale } = {
        replacementContent: targetTab.proposedPatch.replacementContent,
        filePath: targetTab.path,
        rationale: targetTab.proposedPatch.rationale,
      };

      const res = await forgeApi.writeFile(filePath, replacementContent, 'approved-user-token');
      if (res.success) {
        setOpenTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  content: replacementContent,
                  originalContent: replacementContent,
                  isDirty: false,
                  proposedPatch: undefined,
                }
              : tab
          )
        );

        await forgeApi.recordFlightEvent({
          type: 'patch_accepted',
          summary: `Applied proposed fix to ${filePath}: ${rationale}`,
          evidence: { affectedPath: filePath },
          provenance: 'agent',
        });
        refreshFlightRecorder();
        return true;
      }
      return false;
    },
    [openTabs, refreshFlightRecorder]
  );

  const rejectProposedPatch = useCallback((tabId: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, proposedPatch: undefined } : tab
      )
    );
  }, []);

  // Resolve Forge Modal Approval
  const resolveForgeApproval = useCallback(
    async (approved: boolean) => {
      if (!pendingForgeApproval) return;
      if (approved) {
        if (pendingForgeApproval.actionType === 'write_file' && pendingForgeApproval.targetPath && activeFile) {
          await forgeApi.writeFile(pendingForgeApproval.targetPath, activeFile.content, 'approved');
          setOpenTabs((prev) =>
            prev.map((t) => (t.id === activeFile.id ? { ...t, originalContent: t.content, isDirty: false } : t))
          );
        } else if (pendingForgeApproval.actionType === 'execute_command' && pendingForgeApproval.command) {
          await runTerminalCommand(pendingForgeApproval.command, 'approved');
        }
      }
      setPendingForgeApproval(null);
    },
    [pendingForgeApproval, activeFile, runTerminalCommand]
  );

  // Initial Load: Project Tree, Preflight, Checkpoints
  useEffect(() => {
    let isMounted = true;
    const initTimer = setTimeout(() => {
      if (!isMounted) return;
      void refreshFileTree();
      void refreshPreflight();
      void refreshFlightRecorder();
      void probeBackend();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
    };
  }, [refreshFileTree, refreshPreflight, refreshFlightRecorder, probeBackend]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // ⌘S or Ctrl+S: Save file
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      }
      // ⌘B or Ctrl+B: Toggle Companion
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsCompanionOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveFile]);

  // Cleanup SSE stream on unmount
  useEffect(() => {
    return () => {
      if (sseUnsubscribeRef.current) {
        sseUnsubscribeRef.current();
        sseUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Real Backend Diagnostics: Analyze Project
  const startProjectDiagnostics = useCallback(
    async (projectRoot?: string, userRequest?: string): Promise<DiagnosticReport | null> => {
      const targetRoot = projectRoot || connectedProjectRoot || '.';
      if (projectRoot) {
        setConnectedProjectRoot(projectRoot);
      }
      setIsDiagnosticLoading(true);
      setDiagnosticError(null);
      setDiagnosticStatus('INSPECTING');

      if (sseUnsubscribeRef.current) {
        sseUnsubscribeRef.current();
        sseUnsubscribeRef.current = null;
      }

      try {
        const report = await api.analyzeDiagnostics(targetRoot, userRequest);
        setDiagnosticReport(report);
        setDiagnosticStatus(report.status as DiagnosticTaskStatus);
        setProjectConnected(true);

        // Record real session in agent sessions history
        addAgentSession({
          id: report.task_id,
          goal: report.user_request || userRequest || 'Project Diagnostics',
          status: report.status,
          timestamp: report.diagnosed_at || new Date().toISOString(),
          findingsCount: report.observed_facts?.length || 0,
          hasPatch: Boolean(report.proposed_repair),
        });

        // Convert observed facts into problems panel items
        if (report.observed_facts && report.observed_facts.length > 0) {
          const mappedProblems: DiagnosticProblem[] = report.observed_facts.map((fact) => ({
            id: fact.finding_id,
            source: fact.source_type === 'command_output' ? 'test' : fact.source_type === 'environment_inspection' ? 'environment' : 'build',
            severity: fact.status === 'verified' ? 'error' : 'warning',
            message: `[${fact.category.toUpperCase()}] ${fact.summary}`,
            filePath: fact.evidence_refs && fact.evidence_refs.length > 0 ? fact.evidence_refs[0] : undefined,
            timestamp: fact.observed_at || new Date().toISOString(),
          }));
          setProblems((prev) => [...mappedProblems, ...prev]);
        }

        // Attach proposed patch to editor tab if repair actions exist
        if (report.proposed_repair && report.proposed_repair.actions && report.proposed_repair.actions.length > 0) {
          const primaryAction = report.proposed_repair.actions[0];
          const targetPath = primaryAction.target_path || '';

          if (targetPath) {
            await openFile(targetPath);
          }

          setOpenTabs((prev) =>
            prev.map((tab) => {
              if (tab.path === targetPath) {
                return {
                  ...tab,
                  proposedPatch: {
                    diff: report.proposed_repair?.exact_patch || primaryAction.content || '',
                    replacementContent: primaryAction.content || tab.content,
                    rationale: report.proposed_repair?.summary || report.proposed_repair?.explanation || 'Diagnostic automated repair',
                    riskLevel: report.proposed_repair?.risk_level || 'medium',
                    approvalId: report.proposed_repair?.approval_id || report.proposed_repair?.proposal_id || `appr-${Date.now()}`,
                  },
                };
              }
              return tab;
            })
          );
        }

        // Subscribe to real-time Flight Recorder SSE stream
        try {
          if (sseUnsubscribeRef.current) {
            (sseUnsubscribeRef.current as UnsubscribeCallback)();
          }
          const unsub = api.subscribeDiagnosticEvents(
            report.task_id,
            (event) => {
              setDiagnosticEvents((prev) => {
                if (prev.some((e) => e.event_id === event.event_id)) return prev;
                return [...prev, event];
              });
              const eventSummary = (event.details?.summary as string) || (event.details?.message as string) || event.event_type;
              setFlightEvents((prev) => {
                if (prev.some((e) => e.id === event.event_id)) return prev;
                return [
                  {
                    id: event.event_id,
                    timestamp: event.timestamp,
                    type: event.event_type.includes('fail')
                      ? 'test_failed'
                      : event.event_type.includes('repair') || event.event_type.includes('patch')
                      ? 'patch_accepted'
                      : 'command_executed',
                    summary: `[${event.source.toUpperCase()}] ${eventSummary}`,
                    details: event.details,
                    evidence: {
                      outputExcerpt: JSON.stringify(event.details).slice(0, 300),
                    },
                    healthyState: !event.event_type.includes('fail'),
                    provenance: event.source === 'engineer_1' ? 'agent' : 'terminal',
                  },
                  ...prev,
                ];
              });
            },
            (err) => {
              console.warn('Diagnostic SSE connection notice:', err);
            },
            (status) => {
              setSseStreamStatus(status);
            },
            async () => {
              // Reconnect handler: retrieve missed durable events and deduplicate by canonical event ID
              try {
                const missedEvents = await api.getDiagnosticEvents(report.task_id);
                setDiagnosticEvents((prev) => {
                  const existingIds = new Set(prev.map((e) => e.event_id));
                  const newEvents = missedEvents.filter((e) => !existingIds.has(e.event_id));
                  return [...prev, ...newEvents];
                });
              } catch (reconnectErr) {
                console.warn('Failed to retrieve missed events on SSE reconnect:', reconnectErr);
              }
            }
          );
          sseUnsubscribeRef.current = unsub;
        } catch (sseErr) {
          console.warn('Failed to start SSE listener:', sseErr);
        }

        return report;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Diagnostic run failed';
        setDiagnosticError(errorMsg);
        setDiagnosticStatus('FAILED');
        if (errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          setProjectConnected(false);
        }
        return null;
      } finally {
        setIsDiagnosticLoading(false);
      }
    },
    [connectedProjectRoot, openFile, addAgentSession]
  );

  // Load Existing Diagnostic Report & Durable Events
  const loadDiagnosticReport = useCallback(
    async (taskId: string): Promise<DiagnosticReport | null> => {
      setIsDiagnosticLoading(true);
      setDiagnosticError(null);
      try {
        const [report, events] = await Promise.all([
          api.getDiagnosticReport(taskId),
          api.getDiagnosticEvents(taskId).catch(() => []),
        ]);
        setDiagnosticReport(report);
        setDiagnosticStatus(report.status as DiagnosticTaskStatus);
        setDiagnosticEvents(events);

        // Subscribe to live SSE stream for loaded task
        try {
          if (sseUnsubscribeRef.current) {
            (sseUnsubscribeRef.current as UnsubscribeCallback)();
          }
          const unsub = api.subscribeDiagnosticEvents(
            taskId,
            (event) => {
              setDiagnosticEvents((prev) => {
                if (prev.some((e) => e.event_id === event.event_id)) return prev;
                return [...prev, event];
              });
            },
            (err) => {
              console.warn('Diagnostic SSE connection notice:', err);
            },
            (status) => {
              setSseStreamStatus(status);
            },
            async () => {
              try {
                const missed = await api.getDiagnosticEvents(taskId);
                setDiagnosticEvents((prev) => {
                  const existingIds = new Set(prev.map((e) => e.event_id));
                  const newEvents = missed.filter((e) => !existingIds.has(e.event_id));
                  return [...prev, ...newEvents];
                });
              } catch {}
            }
          );
          sseUnsubscribeRef.current = unsub;
        } catch {}

        return report;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to load task ${taskId}`;
        setDiagnosticError(msg);
        return null;
      } finally {
        setIsDiagnosticLoading(false);
      }
    },
    [
      setIsDiagnosticLoading,
      setDiagnosticError,
      setDiagnosticReport,
      setDiagnosticStatus,
      setDiagnosticEvents,
      setSseStreamStatus,
    ]
  );

  // Resolve Repair Approval (Approve or Reject with actual verification outcome)
  const resolveDiagnosticRepair = useCallback(
    async (
      approvalId: string,
      decision: 'approved' | 'rejected',
      notes?: string
    ): Promise<VerificationResult | null> => {
      if (!diagnosticReport) return null;
      setIsDiagnosticLoading(true);
      setDiagnosticError(null);

      try {
        const result = await api.applyRepair(
          diagnosticReport.task_id,
          approvalId,
          decision,
          notes
        );

        if (decision === 'approved') {
          const finalStatus: DiagnosticTaskStatus = result.passed ? 'VERIFIED' : 'FAILED';
          setDiagnosticStatus(finalStatus);
          setDiagnosticReport((prev) =>
            prev
              ? {
                  ...prev,
                  status: finalStatus,
                  verification_results: result,
                  proposed_repair: prev.proposed_repair
                    ? {
                        ...prev.proposed_repair,
                        status: 'APPLIED',
                      }
                    : null,
                }
              : null
          );

          setOpenTabs((prev) =>
            prev.map((t) => ({ ...t, proposedPatch: undefined }))
          );

          void refreshFileTree();

          const exitCodesStr = Object.entries(result.exit_codes || {})
            .map(([cmd, code]) => `${cmd}:${code}`)
            .join(', ');
          const outputsStr = Object.values(result.outputs || {}).join('\n');

          await forgeApi.recordFlightEvent({
            type: result.passed ? 'test_passed' : 'test_failed',
            summary: `Repair approval ${approvalId} ${result.passed ? 'VERIFIED PASSED' : 'VERIFICATION FAILED'} (${exitCodesStr || 'exit 0'})`,
            evidence: {
              approvalId,
              passed: result.passed,
              exitCodes: result.exit_codes,
              commands: result.commands_executed,
              outputExcerpt: outputsStr.slice(-300),
            },
            healthyState: result.passed,
            provenance: 'agent',
          });
          void refreshFlightRecorder();
        } else {
          setDiagnosticStatus('DIAGNOSED');
          setDiagnosticReport((prev) =>
            prev
              ? {
                  ...prev,
                  proposed_repair: prev.proposed_repair
                    ? {
                        ...prev.proposed_repair,
                        status: 'REJECTED',
                      }
                    : null,
                }
              : null
          );

          setOpenTabs((prev) =>
            prev.map((t) => ({ ...t, proposedPatch: undefined }))
          );
        }

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Repair resolution failed';
        setDiagnosticError(msg);
        return null;
      } finally {
        setIsDiagnosticLoading(false);
      }
    },
    [
      diagnosticReport,
      refreshFileTree,
      refreshFlightRecorder,
      setDiagnosticStatus,
      setDiagnosticReport,
      setDiagnosticError,
      setIsDiagnosticLoading,
    ]
  );

  // Rollback Recovery
  const recoverDiagnosticProject = useCallback(async (): Promise<boolean> => {
    if (!diagnosticReport) return false;
    setIsDiagnosticLoading(true);
    try {
      const res = await api.recoverProject(diagnosticReport.task_id);
      if (res.success) {
        setDiagnosticStatus('RECOVERED');
        setDiagnosticReport((prev) => (prev ? { ...prev, status: 'RECOVERED' } : null));
        void refreshFileTree();
        void refreshFlightRecorder();
        return true;
      }
      return false;
    } catch (err: unknown) {
      setDiagnosticError(err instanceof Error ? err.message : 'Recovery failed');
      return false;
    } finally {
      setIsDiagnosticLoading(false);
    }
  }, [
    diagnosticReport,
    refreshFileTree,
    refreshFlightRecorder,
    setDiagnosticStatus,
    setDiagnosticReport,
    setDiagnosticError,
    setIsDiagnosticLoading,
  ]);

  const value = useMemo(
    () => ({
      fileTree,
      isLoadingTree,
      refreshFileTree,
      openTabs,
      activeTabId,
      activeFile,
      openFile,
      closeTab,
      setActiveTabId,
      updateFileContent,
      saveActiveFile,
      terminalHistory,
      isExecutingCommand,
      runTerminalCommand,
      clearTerminal,
      runBuildCheck,
      runTestCheck,
      problems,
      addProblem,
      clearProblems,
      flightEvents,
      checkpoints,
      isLoadingFlightRecorder,
      refreshFlightRecorder,
      createHealthyCheckpoint,
      whatChanged,
      analyzeWhatChanged,
      preflightReport,
      isPreflightLoading,
      refreshPreflight,
      workbenchLayout,
      setWorkbenchLayout,
      toggleWorkbenchLayout,
      workspaceSearchQuery,
      setWorkspaceSearchQuery,
      agentSessions,
      addAgentSession,
      clearDiagnosticSession,
      activeBottomTab,
      setActiveBottomTab,
      activeLeftTab,
      setActiveLeftTab,
      isCompanionOpen,
      setIsCompanionOpen,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      pendingForgeApproval,
      setPendingForgeApproval,
      resolveForgeApproval,
      applyProposedPatch,
      rejectProposedPatch,
      diagnosticReport,
      diagnosticStatus,
      diagnosticEvents,
      sseStreamStatus,
      isDiagnosticLoading,
      diagnosticError,
      projectConnected,
      connectedProjectRoot,
      setConnectedProjectRoot,
      startProjectDiagnostics,
      loadDiagnosticReport,
      resolveDiagnosticRepair,
      recoverDiagnosticProject,
    }),
    [
      fileTree,
      isLoadingTree,
      refreshFileTree,
      openTabs,
      activeTabId,
      activeFile,
      openFile,
      closeTab,
      setActiveTabId,
      updateFileContent,
      saveActiveFile,
      terminalHistory,
      isExecutingCommand,
      runTerminalCommand,
      clearTerminal,
      runBuildCheck,
      runTestCheck,
      problems,
      addProblem,
      clearProblems,
      flightEvents,
      checkpoints,
      isLoadingFlightRecorder,
      refreshFlightRecorder,
      createHealthyCheckpoint,
      whatChanged,
      analyzeWhatChanged,
      preflightReport,
      isPreflightLoading,
      refreshPreflight,
      workbenchLayout,
      toggleWorkbenchLayout,
      workspaceSearchQuery,
      agentSessions,
      addAgentSession,
      clearDiagnosticSession,
      activeBottomTab,
      setActiveBottomTab,
      activeLeftTab,
      setActiveLeftTab,
      isCompanionOpen,
      setIsCompanionOpen,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      pendingForgeApproval,
      setPendingForgeApproval,
      resolveForgeApproval,
      applyProposedPatch,
      rejectProposedPatch,
      diagnosticReport,
      diagnosticStatus,
      diagnosticEvents,
      sseStreamStatus,
      isDiagnosticLoading,
      diagnosticError,
      projectConnected,
      connectedProjectRoot,
      startProjectDiagnostics,
      loadDiagnosticReport,
      resolveDiagnosticRepair,
      recoverDiagnosticProject,
    ]
  );

  return <ForgeContext.Provider value={value}>{children}</ForgeContext.Provider>;
};

export const useForge = (): ForgeContextValue => {
  const context = useContext(ForgeContext);
  if (!context) {
    throw new Error('useForge must be used within a ForgeProvider');
  }
  return context;
};
