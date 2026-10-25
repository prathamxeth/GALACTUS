'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  AudienceMode,
  AppearancePreset,
  ChatMessage,
  TaskGraph,
  ApprovalRequest,
  MemoryRecord,
  SkillDefinition,
  SentinelTrigger,
  SystemEventLog,
  DiagnosticMetric,
  PrivacySettings,
  AgentRuntimeStatus,
  CreateSemanticFactRequest,
  PermissionApprovalPayload,
  PermissionApprovalResponse,
} from '../api/types';
import {
  DEMO_APPROVALS,
  DEMO_CHAT_MESSAGES,
  DEMO_DIAGNOSTIC_METRICS,
  DEMO_EVENT_LOGS,
  DEMO_MEMORIES,
  DEMO_PRIVACY_SETTINGS,
  DEMO_RUNTIME_STATUS,
  DEMO_SKILLS,
  DEMO_TASKS,
  DEMO_SENTINELS,
} from '../api/fixtures';
import { api } from '../api/client';

interface RagnarokContextValue {
  // Mode & Appearance
  mode: AudienceMode;
  setMode: (mode: AudienceMode) => void;
  preset: AppearancePreset;
  setPreset: (preset: AppearancePreset) => void;

  // Domain State
  messages: ChatMessage[];
  tasks: TaskGraph[];
  approvals: ApprovalRequest[];
  memories: MemoryRecord[];
  skills: SkillDefinition[];
  sentinels: SentinelTrigger[];
  eventLogs: SystemEventLog[];
  diagnosticMetrics: DiagnosticMetric[];
  settings: PrivacySettings;
  runtimeStatus: AgentRuntimeStatus | null;

  // Backend Connection
  isBackendOnline: boolean;
  isCheckingBackend: boolean;
  backendError: string | null;
  probeBackend: () => Promise<void>;

  // Memory Operations
  isLoadingMemories: boolean;
  memoryError: string | null;
  loadMemories: (query?: string) => Promise<void>;
  createSemanticFact: (fact: CreateSemanticFactRequest) => Promise<{ success: boolean; error?: string }>;
  deleteMemory: (id: string | number) => Promise<{ success: boolean; error?: string }>;
  exportMemories: () => Promise<{ success: boolean; content?: string; filename?: string; error?: string }>;

  // Task & Polling Operations
  isLoadingTasks: boolean;
  taskError: string | null;
  fetchIncompleteTasks: () => Promise<void>;
  createTask: (goal: string, priority?: 'low' | 'normal' | 'high') => void;
  submitPermissionApproval: (payload: PermissionApprovalPayload) => Promise<PermissionApprovalResponse>;
  resolveApproval: (requestId: string, decision: 'approved' | 'rejected', notes?: string) => Promise<void>;

  // Other Operations
  sendMessage: (prompt: string, mode?: 'chat' | 'task' | 'memory') => Promise<void>;
  toggleSkill: (id: string) => void;
  toggleSentinel: (id: string) => void;
  updateSettings: (newSettings: Partial<PrivacySettings>) => Promise<void>;
}

const RagnarokContext = createContext<RagnarokContextValue | undefined>(undefined);

export const RagnarokProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Audience Mode (Default 'user', persisted)
  const [mode, setModeState] = useState<AudienceMode>('user');

  // 2. Appearance Preset (Default 'dark', persisted)
  const [preset, setPresetState] = useState<AppearancePreset>('dark');

  // 3. Domain State
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_CHAT_MESSAGES);
  const [tasks, setTasks] = useState<TaskGraph[]>(DEMO_TASKS);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(DEMO_APPROVALS);
  const [memories, setMemories] = useState<MemoryRecord[]>(DEMO_MEMORIES);
  const [skills, setSkills] = useState<SkillDefinition[]>(DEMO_SKILLS);
  const [sentinels, setSentinels] = useState<SentinelTrigger[]>(DEMO_SENTINELS);
  const [eventLogs, setEventLogs] = useState<SystemEventLog[]>(DEMO_EVENT_LOGS);
  const [diagnosticMetrics] = useState<DiagnosticMetric[]>(DEMO_DIAGNOSTIC_METRICS);
  const [settings, setSettings] = useState<PrivacySettings>(DEMO_PRIVACY_SETTINGS);
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(DEMO_RUNTIME_STATUS);

  // 4. Backend Connectivity & State
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // 5. Memory State
  const [isLoadingMemories, setIsLoadingMemories] = useState<boolean>(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  // 6. Task State
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Initialize Mode and Theme from LocalStorage / System
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedMode = (localStorage.getItem('memorag_mode') || localStorage.getItem('ragnarok_mode')) as AudienceMode | null;
        if (savedMode === 'user' || savedMode === 'developer') {
          setModeState(savedMode);
        }

        const savedTheme = (localStorage.getItem('memorag_theme') || localStorage.getItem('ragnarok_theme')) as AppearancePreset | null;
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setPresetState(savedTheme);
          document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const initialTheme: AppearancePreset = prefersDark ? 'dark' : 'light';
          setPresetState(initialTheme);
          document.documentElement.setAttribute('data-theme', initialTheme);
        }
      } catch {
        // LocalStorage unavailable
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const setMode = (newMode: AudienceMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('memorag_mode', newMode);
      localStorage.setItem('ragnarok_mode', newMode);
    } catch {
      // ignore
    }
  };

  const setPreset = (newPreset: AppearancePreset) => {
    setPresetState(newPreset);
    document.documentElement.setAttribute('data-theme', newPreset);
    try {
      localStorage.setItem('memorag_theme', newPreset);
      localStorage.setItem('ragnarok_theme', newPreset);
    } catch {
      // ignore
    }
  };

  // --- Fetch Incomplete Tasks (/api/tasks/incomplete) ---
  const fetchIncompleteTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    setTaskError(null);
    try {
      const res = await api.getIncompleteTasks();
      if (res.isLive) {
        setTasks((prev) => {
          // Merge incomplete tasks with existing completed ones
          const incompleteIds = new Set(res.data.map((t) => t.id));
          const completedRetained = prev.filter(
            (t) => t.status === 'completed' && !incompleteIds.has(t.id)
          );
          return [...res.data, ...completedRetained];
        });

        // Extract any approval requests from tasks paused awaiting approval
        const newApprovals: ApprovalRequest[] = [];
        for (const t of res.data) {
          if (t.status === 'awaiting_approval') {
            for (const s of t.steps) {
              if (s.status === 'awaiting_approval' || s.approvalRequestId) {
                newApprovals.push({
                  id: s.approvalRequestId || `appr-${t.id}`,
                  taskId: t.id,
                  stepId: s.id,
                  taskGoal: t.goal,
                  actionTitle: s.title,
                  toolName: s.skillName,
                  riskLevel: 'high',
                  rationale: s.output || 'Protected operation halted by PAUSED_APPROVAL gate.',
                  commandOrPayload: JSON.stringify(s.parameters, null, 2),
                  parameters: s.parameters,
                  createdAt: t.updatedAt,
                  status: 'pending',
                });
              }
            }
          }
        }
        if (newApprovals.length > 0) {
          setApprovals(newApprovals);
        }
      } else if (res.error) {
        setTaskError(res.error);
      }
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to fetch incomplete tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // --- Load Memories (Episodic + Semantic) ---
  const loadMemories = useCallback(async (query?: string) => {
    setIsLoadingMemories(true);
    setMemoryError(null);
    try {
      const [epiRes, semRes] = await Promise.all([
        api.getEpisodicMemories(),
        api.getSemanticMemories(query),
      ]);

      if (epiRes.isLive || semRes.isLive) {
        setMemories([...epiRes.data, ...semRes.data]);
      } else {
        // Backend offline or error
        const errMsg = epiRes.error || semRes.error || 'FastAPI memory endpoints offline';
        setMemoryError(errMsg);
      }
    } catch (err: unknown) {
      setMemoryError(err instanceof Error ? err.message : 'Error loading memories');
    } finally {
      setIsLoadingMemories(false);
    }
  }, []);

  // --- Probe Backend Health ---
  const probeBackend = useCallback(async () => {
    setIsCheckingBackend(true);
    setBackendError(null);
    try {
      const health = await api.checkHealth();
      setIsBackendOnline(health.online);

      if (health.online) {
        setBackendError(null);
        // Refresh live data concurrently
        const [statRes, skillRes] = await Promise.all([
          api.getRuntimeStatus(),
          api.getSkills(),
        ]);
        setRuntimeStatus(statRes.data);
        if (skillRes.isLive) {
          setSkills(skillRes.data);
        }
        await Promise.all([fetchIncompleteTasks(), loadMemories()]);
      } else {
        setBackendError(health.message || `Backend offline at ${api.getBaseUrl()}`);
      }
    } catch (err: unknown) {
      setIsBackendOnline(false);
      setBackendError(err instanceof Error ? err.message : 'Backend connection failed');
    } finally {
      setIsCheckingBackend(false);
    }
  }, [fetchIncompleteTasks, loadMemories]);

  // Background probe on mount
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    probeBackend();
  }, [probeBackend]);

  // --- Create Semantic Fact (POST /api/memory/semantic) ---
  const createSemanticFact = async (
    fact: CreateSemanticFactRequest
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await api.createSemanticFact(fact);
    if (res.isLive && res.data) {
      setMemories((prev) => [res.data as MemoryRecord, ...prev]);
      setEventLogs((prev) => [
        {
          id: `evt-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: 'INFO',
          eventType: 'FACT_LEARNED',
          message: `Learned new fact: "${fact.fact_key}"`,
          details: { category: fact.category, tokens: fact.tokens },
        },
        ...prev,
      ]);
      return { success: true };
    }
    return { success: false, error: res.error || 'Backend memory endpoint failed' };
  };

  // --- Delete Memory (DELETE /api/memory/{id}) ---
  const deleteMemory = async (
    id: string | number
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await api.deleteMemory(id);
    const strId = String(id);
    if (res.isLive || !isBackendOnline) {
      setMemories((prev) => prev.filter((m) => String(m.id) !== strId));
      setEventLogs((prev) => [
        {
          id: `evt-${Date.now()}`,
          timestamp: new Date().toISOString(),
          severity: 'INFO',
          eventType: 'MEMORY_FORGOTTEN',
          message: `Memory item #${strId} permanently deleted from local store`,
        },
        ...prev,
      ]);
      return { success: true };
    }
    return { success: false, error: res.error || `Failed to delete memory ${strId}` };
  };

  // --- Export Memories (GET /api/memory/export) ---
  const exportMemories = async (): Promise<{
    success: boolean;
    content?: string;
    filename?: string;
    error?: string;
  }> => {
    const res = await api.exportMemories();
    if (res.isLive && res.data.content) {
      // Trigger download in browser
      const blob = new Blob([res.data.content], { type: res.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return { success: true, content: res.data.content, filename: res.data.filename };
    }

    // Local JSON export fallback if backend export is offline
    const localContent = JSON.stringify(memories, null, 2);
    const filename = `memorag_memory_export_${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([localContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return {
      success: true,
      content: localContent,
      filename,
      error: res.error ? `Exported local records (Backend export endpoint was offline)` : undefined,
    };
  };

  // --- Submit Permission Approval (POST /api/permissions/approve) ---
  const submitPermissionApproval = async (
    payload: PermissionApprovalPayload
  ): Promise<PermissionApprovalResponse> => {
    const res = await api.submitPermissionApproval(payload);

    // Update approval status in local state
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === payload.request_id || a.id === payload.requestId
          ? { ...a, status: payload.decision === 'approved' ? 'approved' : 'denied' }
          : a
      )
    );

    // Note: Never assume returned authorization means underlying tool action completed!
    // We update the step to reflect authorization status, keeping status running until backend confirms.
    setTasks((prev) =>
      prev.map((t) => {
        const matchesTask = t.id === payload.task_id;
        const containsStep = t.steps.some(
          (s) => s.approvalRequestId === payload.request_id || s.approvalRequestId === payload.requestId
        );

        if (matchesTask || containsStep) {
          return {
            ...t,
            status: payload.approved ? 'running' : 'failed',
            steps: t.steps.map((s) => {
              if (s.approvalRequestId === payload.request_id || s.approvalRequestId === payload.requestId) {
                return {
                  ...s,
                  status: payload.approved ? 'running' : 'failed',
                  output: payload.approved
                    ? 'Authorization granted. Action queued for execution by agent...'
                    : `Action denied by user: ${payload.notes || 'Halted.'}`,
                };
              }
              return s;
            }),
          };
        }
        return t;
      })
    );

    setEventLogs((prev) => [
      {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: payload.approved ? 'INFO' : 'WARN',
        eventType: 'APPROVAL_SUBMITTED',
        message: `Approval request ${payload.request_id} submitted with decision: ${payload.decision}`,
        details: { notes: payload.notes },
      },
      ...prev,
    ]);

    return res.data;
  };

  // Legacy bridge for resolveApproval
  const resolveApproval = async (
    requestId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ) => {
    await submitPermissionApproval({
      request_id: requestId,
      approved: decision === 'approved',
      decision: decision === 'approved' ? 'approved' : 'denied',
      notes,
    });
  };

  // --- Send Message ---
  const sendMessage = async (prompt: string, sendMode: 'chat' | 'task' | 'memory' = 'chat') => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);

    const newLog: SystemEventLog = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      eventType: 'PROMPT_INGEST',
      message: `User submitted request in ${sendMode} mode`,
      details: { promptLength: prompt.length },
    };
    setEventLogs((prev) => [newLog, ...prev]);

    try {
      const response = await api.sendPrompt(prompt, sendMode);
      setMessages((prev) => [...prev, response.data]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'agent',
          content: 'I could not communicate with the local agent gateway. Please verify that the local service is running.',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // --- Create Task ---
  const createTask = (goal: string, priority: 'low' | 'normal' | 'high' = 'normal') => {
    const newTask: TaskGraph = {
      id: `task-${Date.now().toString().slice(-6)}`,
      goal: goal.trim(),
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority,
      estimatedDurationMs: 25000,
      steps: [
        {
          id: `step-${Date.now()}-1`,
          stepNumber: 1,
          title: 'Understand Goal and Plan Steps',
          skillName: 'workflow.planner',
          status: 'completed',
          parameters: { goal },
          output: 'Plan generated with 3 sequential steps.',
          reflectionAttempt: 0,
        },
        {
          id: `step-${Date.now()}-2`,
          stepNumber: 2,
          title: 'Execute Local Action in Sandbox',
          skillName: 'system.sandboxed_exec',
          status: 'running',
          parameters: { isolation: 'CONTAINER_SHIELD' },
          reflectionAttempt: 0,
        },
        {
          id: `step-${Date.now()}-3`,
          stepNumber: 3,
          title: 'Store Results in Memory',
          skillName: 'memory.record_saga',
          status: 'pending',
          parameters: { autoConsolidate: true },
          reflectionAttempt: 0,
        },
      ],
    };

    setTasks((prev) => [newTask, ...prev]);

    setEventLogs((prev) => [
      {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: 'INFO',
        eventType: 'TASK_DISPATCH',
        message: `New task graph initialized: ${goal}`,
        taskId: newTask.id,
      },
      ...prev,
    ]);
  };

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const toggleSentinel = (id: string) => {
    setSentinels((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const updateSettings = async (newSettings: Partial<PrivacySettings>) => {
    await api.updatePrivacySettings(newSettings);
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <RagnarokContext.Provider
      value={{
        mode,
        setMode,
        preset,
        setPreset,
        messages,
        tasks,
        approvals,
        memories,
        skills,
        sentinels,
        eventLogs,
        diagnosticMetrics,
        settings,
        runtimeStatus,
        isBackendOnline,
        isCheckingBackend,
        backendError,
        probeBackend,
        isLoadingMemories,
        memoryError,
        loadMemories,
        createSemanticFact,
        deleteMemory,
        exportMemories,
        isLoadingTasks,
        taskError,
        fetchIncompleteTasks,
        createTask,
        submitPermissionApproval,
        resolveApproval,
        sendMessage,
        toggleSkill,
        toggleSentinel,
        updateSettings,
      }}
    >
      {children}
    </RagnarokContext.Provider>
  );
};

export const useRagnarok = (): RagnarokContextValue => {
  const context = useContext(RagnarokContext);
  if (!context) {
    throw new Error('useRagnarok must be used within a RagnarokProvider');
  }
  return context;
};

// Aliases for project & agent rename to MEMORAG
export const useMemoRag = useRagnarok;
export const MemoRagProvider = RagnarokProvider;
export const MemoRagContext = RagnarokContext;
export type MemoRagContextValue = RagnarokContextValue;
