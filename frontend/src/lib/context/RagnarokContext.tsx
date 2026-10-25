'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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
  TruthfulRuntimeState,
  CreateSemanticFactRequest,
  PermissionApprovalPayload,
  PermissionApprovalResponse,
  RiskLevel,
  TaskStatus,
  TruthfulModelStatus,
  MessageAttachment,
} from '../api/types';
import {
  DEMO_PRIVACY_SETTINGS,
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

  // Truthful Runtime State
  runtimeState: TruthfulRuntimeState;
  modelStatus: TruthfulModelStatus;
  availableModels: string[];
  isBackendOnline: boolean;
  isCheckingBackend: boolean;
  backendError: string | null;
  probeBackend: () => Promise<void>;

  // Data Source Flags (visibly identify live vs preview data)
  isMemoriesLive: boolean;
  isTasksLive: boolean;
  isSkillsLive: boolean;
  isApprovalsLive: boolean;

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
  sendMessage: (prompt: string, mode?: 'chat' | 'task' | 'memory', attachments?: MessageAttachment[]) => Promise<void>;
  isSendingMessage: boolean;
  abortSendMessage: () => void;
  cancelActiveTask: (taskId?: string) => Promise<void>;
  clearConversation: () => void;
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

  // 3. Domain State (Messages start empty for clean OLED empty state, thread activates on first interaction)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const activeChatAbortRef = useRef<AbortController | null>(null);
  const [tasks, setTasks] = useState<TaskGraph[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [sentinels, setSentinels] = useState<SentinelTrigger[]>([]);
  const [eventLogs, setEventLogs] = useState<SystemEventLog[]>([]);
  const [diagnosticMetrics] = useState<DiagnosticMetric[]>([]);
  const [settings, setSettings] = useState<PrivacySettings>(DEMO_PRIVACY_SETTINGS);
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus | null>(null);

  // 4. Backend Connectivity & State
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [hasProbedOnce, setHasProbedOnce] = useState<boolean>(false);
  const [isCheckingBackend, setIsCheckingBackend] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [recentlyCompletedTaskId, setRecentlyCompletedTaskId] = useState<string | null>(null);

  // 5. Data Live/Mock Separation Flags
  const [isMemoriesLive, setIsMemoriesLive] = useState<boolean>(false);
  const [isTasksLive, setIsTasksLive] = useState<boolean>(false);
  const [isSkillsLive, setIsSkillsLive] = useState<boolean>(false);
  const [isApprovalsLive, setIsApprovalsLive] = useState<boolean>(false);

  // 6. Loading States
  const [isLoadingMemories, setIsLoadingMemories] = useState<boolean>(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // SSE Subscriptions Reference: task_id -> cleanup()
  const sseSubscribersRef = useRef<Map<string, () => void>>(new Map());

  // Attach SSE listener to a task
  const attachTaskSSE = useCallback((taskId: string) => {
    if (!taskId || sseSubscribersRef.current.has(taskId)) return;

    const cleanup = api.subscribeToTaskEvents(
      taskId,
      (evt) => {
        // Log event in system trace
        setEventLogs((prev) => [
          {
            id: `evt-sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            severity: evt.event === 'task_failed' ? 'ERROR' : evt.event === 'approval_required' ? 'WARN' : 'INFO',
            eventType: `SSE_${evt.event.toUpperCase()}`,
            message: `Task ${taskId}: ${evt.event}`,
            taskId,
            details: evt.data,
          },
          ...prev,
        ]);

        if (evt.event === 'task_started' || evt.event === 'task_completed' || evt.event === 'task_failed') {
          const newStatus: TaskStatus =
            evt.event === 'task_completed'
              ? 'completed'
              : evt.event === 'task_failed'
              ? 'failed'
              : 'running';

          if (newStatus === 'completed') {
            setRecentlyCompletedTaskId(taskId);
          }

          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
          );
        }

        if (evt.event === 'approval_required') {
          const apprData = evt.data as Record<string, unknown>;
          const approvalId = String(apprData.approval_id || `appr-${taskId}`);

          setApprovals((prev) => {
            if (prev.some((a) => a.id === approvalId)) return prev;
            return [
              {
                id: approvalId,
                taskId,
                stepId: String(apprData.step_id || ''),
                taskGoal: String(apprData.title || 'Protected Operation'),
                actionTitle: String(apprData.title || 'Protected Operation'),
                toolName: String(apprData.action || 'system.execute'),
                riskLevel: (String(apprData.risk_level || 'high').toLowerCase()) as RiskLevel,
                rationale: 'High-risk operation halted at Gjallarhorn approval gate awaiting explicit human authorization.',
                commandOrPayload: JSON.stringify(apprData.parameters || {}, null, 2),
                parameters: (apprData.parameters as Record<string, unknown>) || {},
                createdAt: new Date().toISOString(),
                status: 'pending',
              },
              ...prev,
            ];
          });

          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              return {
                ...t,
                status: 'awaiting_approval',
                steps: t.steps.map((s) =>
                  s.id === apprData.step_id || s.stepNumber === 1
                    ? { ...s, status: 'awaiting_approval', approvalRequestId: approvalId }
                    : s
                ),
              };
            })
          );
        }

        if (evt.event === 'step_completed') {
          const stepData = evt.data as Record<string, unknown>;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              return {
                ...t,
                steps: t.steps.map((s) =>
                  s.id === stepData.step_id
                    ? { ...s, status: 'completed', output: String(stepData.output || 'Step completed') }
                    : s
                ),
              };
            })
          );
        }
      },
      () => {
        // SSE disconnected
      }
    );

    sseSubscribersRef.current.set(taskId, cleanup);
  }, []);

  // Cleanup SSE subscriptions on unmount
  useEffect(() => {
    const subscribers = sseSubscribersRef.current;
    return () => {
      subscribers.forEach((cleanup) => cleanup());
      subscribers.clear();
    };
  }, []);

  // Initialize Mode and Theme from LocalStorage / System
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const savedMode = (localStorage.getItem('memorag_mode') || localStorage.getItem('ragnarok_mode')) as AudienceMode | null;
        if (savedMode === 'user' || savedMode === 'developer') {
          setModeState(savedMode);
        }

        const savedTheme = (
          localStorage.getItem('memorag_theme') ||
          localStorage.getItem('memorag_preset') ||
          localStorage.getItem('ragnarok_theme')
        ) as AppearancePreset | null;
        const validThemes: AppearancePreset[] = ['light', 'dark', 'oled-light', 'oled-dark'];
        if (savedTheme && validThemes.includes(savedTheme)) {
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

  // --- Derive Truthful Runtime State (8 distinct verified states) ---
  const runtimeState: TruthfulRuntimeState = useMemo(() => {
    if (!isBackendOnline) {
      return hasProbedOnce ? 'Backend Disconnected' : 'Offline Preview';
    }

    // Backend is verified online: evaluate tasks & human approvals
    const hasPendingApproval = approvals.some((a) => a.status === 'pending');
    if (hasPendingApproval) {
      return 'Approval Required';
    }

    const hasRunningTask = tasks.some((t) => t.status === 'running');
    if (hasRunningTask) {
      return 'Task Running';
    }

    const latestTask = tasks[0];
    if (latestTask && latestTask.status === 'failed') {
      return 'Task Failed';
    }

    if (recentlyCompletedTaskId && tasks.some((t) => t.id === recentlyCompletedTaskId && t.status === 'completed')) {
      return 'Task Completed';
    }

    // Distinguish AI Model Ready vs Backend Connected (Backend health != Ollama inference ready)
    if (runtimeStatus?.ollamaStatus === 'connected' && runtimeStatus?.activeModelLoaded) {
      return 'AI Model Ready';
    }

    return 'Backend Connected';
  }, [
    isBackendOnline,
    hasProbedOnce,
    approvals,
    tasks,
    recentlyCompletedTaskId,
    runtimeStatus?.ollamaStatus,
    runtimeStatus?.activeModelLoaded,
  ]);

  // --- Derive Truthful Model Status ('ready' | 'connecting' | 'unavailable' | 'offline' | 'error') ---
  const modelStatus: TruthfulModelStatus = useMemo(() => {
    if (isCheckingBackend && !hasProbedOnce) return 'connecting';
    if (!isBackendOnline) return 'offline';
    if (backendError) return 'error';
    if (runtimeStatus?.ollamaStatus === 'connected' && runtimeStatus?.activeModelLoaded) {
      return 'ready';
    }
    return 'unavailable';
  }, [isCheckingBackend, hasProbedOnce, isBackendOnline, backendError, runtimeStatus]);

  const availableModels: string[] = useMemo(() => {
    const configured = runtimeStatus?.model || 'gemma4:e2b';
    return [configured];
  }, [runtimeStatus]);

  // --- Fetch Incomplete Tasks (/api/tasks/incomplete & /api/tasks) ---
  const fetchIncompleteTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    setTaskError(null);
    try {
      const res = await api.getIncompleteTasks();
      if (res.isLive) {
        setIsTasksLive(true);
        setTasks((prev) => {
          const incompleteIds = new Set(res.data.map((t) => t.id));
          const completedRetained = prev.filter(
            (t) => t.status === 'completed' && !incompleteIds.has(t.id)
          );
          return [...res.data, ...completedRetained];
        });

        // Also fetch live approvals from /api/approvals
        const apprRes = await api.getApprovals();
        if (apprRes.isLive) {
          setIsApprovalsLive(true);
          setApprovals(apprRes.data);
        }

        // Attach SSE for any active tasks
        res.data.forEach((task) => {
          if (task.status === 'running' || task.status === 'awaiting_approval') {
            attachTaskSSE(task.id);
          }
        });
      } else if (res.error) {
        setIsTasksLive(false);
        setTaskError(res.error);
      }
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Failed to fetch incomplete tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  }, [attachTaskSSE]);

  // --- Load Memories (Episodic + Semantic) ---
  const loadMemories = useCallback(async (query?: string) => {
    setIsLoadingMemories(true);
    setMemoryError(null);
    try {
      const res = await api.getMemories(undefined, query);
      if (res.isLive) {
        setIsMemoriesLive(true);
        setMemories(res.data);
      } else {
        setIsMemoriesLive(false);
        if (!isBackendOnline) {
          setMemories([]);
          setMemoryError('FastAPI backend offline at 127.0.0.1:8000. Connect backend to view encrypted memory records.');
        } else {
          setMemoryError(res.error || 'FastAPI memory endpoints offline');
        }
      }
    } catch (err: unknown) {
      setMemoryError(err instanceof Error ? err.message : 'Error loading memories');
    } finally {
      setIsLoadingMemories(false);
    }
  }, [isBackendOnline]);

  // --- Probe Backend Health ---
  const probeBackend = useCallback(async () => {
    setIsCheckingBackend(true);
    setBackendError(null);
    try {
      const health = await api.checkHealth();
      setIsBackendOnline(health.online);
      setHasProbedOnce(true);

      if (health.online) {
        setBackendError(null);
        const [statRes, skillRes] = await Promise.all([
          api.getRuntimeStatus(),
          api.getSkills(),
        ]);
        setRuntimeStatus(statRes.data);
        if (skillRes.isLive) {
          setIsSkillsLive(true);
          setSkills(skillRes.data);
        } else {
          setIsSkillsLive(false);
          setSkills(skillRes.data); // tagged with isMock: true
        }
        await Promise.all([fetchIncompleteTasks(), loadMemories()]);
      } else {
        setBackendError(health.message || `Backend offline at ${api.getBaseUrl()}`);
      }
    } catch (err: unknown) {
      setIsBackendOnline(false);
      setHasProbedOnce(true);
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

  // --- Export Memories (GET /api/memory/export/all) ---
  const exportMemories = async (): Promise<{
    success: boolean;
    content?: string;
    filename?: string;
    error?: string;
  }> => {
    const res = await api.exportMemories();
    if (res.isLive && res.data.content) {
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

  // --- Submit Permission Approval (POST /api/permissions/approve & /api/approvals/{id}) ---
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

    // Update actionProposal status in messages state
    setMessages((prev) =>
      prev.map((m) =>
        m.actionProposal &&
        (m.actionProposal.id === payload.request_id || m.actionProposal.id === payload.requestId)
          ? {
              ...m,
              actionProposal: {
                ...m.actionProposal,
                status: payload.decision === 'approved' ? 'approved' : 'rejected',
              },
            }
          : m
      )
    );

    // Reflect decision in task steps
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

    // Resync incomplete tasks
    if (isBackendOnline) {
      setTimeout(() => fetchIncompleteTasks(), 800);
    }

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

  // --- Abort & Cancel Operations ---
  const abortSendMessage = useCallback(() => {
    if (activeChatAbortRef.current) {
      activeChatAbortRef.current.abort();
      activeChatAbortRef.current = null;
    }
    setIsSendingMessage(false);
  }, []);

  const cancelActiveTask = useCallback(async (taskId?: string) => {
    if (activeChatAbortRef.current) {
      activeChatAbortRef.current.abort();
      activeChatAbortRef.current = null;
    }
    setIsSendingMessage(false);

    if (taskId) {
      try {
        await api.cancelTask(taskId);
      } catch {
        // graceful offline fallback
      }
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-abort-${Date.now()}`,
        role: 'agent',
        content: 'Task was cancelled by operator.',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    if (isBackendOnline) {
      setTimeout(() => fetchIncompleteTasks(), 400);
    }
  }, [isBackendOnline, fetchIncompleteTasks]);

  const clearConversation = useCallback(() => {
    if (activeChatAbortRef.current) {
      activeChatAbortRef.current.abort();
      activeChatAbortRef.current = null;
    }
    setMessages([]);
    setIsSendingMessage(false);
  }, []);

  // --- Send Message ---
  const sendMessage = async (
    prompt: string,
    sendMode: 'chat' | 'task' | 'memory' = 'chat',
    attachments?: MessageAttachment[]
  ) => {
    const controller = new AbortController();
    activeChatAbortRef.current = controller;
    setIsSendingMessage(true);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);

    const newLog: SystemEventLog = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      eventType: 'PROMPT_INGEST',
      message: `User submitted request in ${sendMode} mode`,
      details: { promptLength: prompt.length, attachmentCount: attachments?.length || 0 },
    };
    setEventLogs((prev) => [newLog, ...prev]);

    try {
      const response = await api.sendPrompt(prompt, sendMode, controller.signal, attachments);
      setMessages((prev) => [...prev, response.data]);

      // If backend created an active task, sync tasks and attach SSE
      if (response.data.relatedTaskId) {
        attachTaskSSE(response.data.relatedTaskId);
        await fetchIncompleteTasks();
      }

      if (response.data.actionProposal) {
        const ap = response.data.actionProposal;
        setApprovals((prev) => {
          if (prev.some((a) => a.id === ap.id)) return prev;
          return [
            {
              id: ap.id,
              taskId: response.data.relatedTaskId || `task-${Date.now()}`,
              stepId: `step-${ap.id}`,
              taskGoal: ap.actionTitle,
              actionTitle: ap.actionTitle,
              toolName: ap.toolName,
              riskLevel: ap.riskLevel,
              rationale: ap.description,
              commandOrPayload: JSON.stringify(ap.payload, null, 2),
              parameters: ap.payload,
              createdAt: new Date().toISOString(),
              status: 'pending',
            },
            ...prev,
          ];
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-abort-${Date.now()}`,
            role: 'agent',
            content: 'Generation was stopped by user. Local model halted.',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'agent',
            content: 'I could not communicate with the local agent gateway. Please verify that the local service is running.',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        throw err;
      }
    } finally {
      setIsSendingMessage(false);
      activeChatAbortRef.current = null;
    }
  };

  // --- Create Task ---
  const createTask = async (goal: string, priority: 'low' | 'normal' | 'high' = 'normal') => {
    if (isBackendOnline) {
      const res = await api.createTask(goal, priority);
      if (res.isLive && res.data) {
        setTasks((prev) => [res.data as TaskGraph, ...prev]);
        attachTaskSSE(res.data.id);
        setEventLogs((prev) => [
          {
            id: `evt-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: 'INFO',
            eventType: 'TASK_DISPATCH',
            message: `New task graph initialized on backend: ${goal}`,
            taskId: res.data!.id,
          },
          ...prev,
        ]);
        return;
      }
    }

    // Staging Preview Task
    const newTask: TaskGraph = {
      id: `task-prev-${Date.now().toString().slice(-6)}`,
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
          output: '[Staged Preview] Plan generated with 3 sequential steps.',
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
        message: `[Preview] Staged task graph initialized: ${goal}`,
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
        runtimeState,
        modelStatus,
        availableModels,
        isBackendOnline,
        isCheckingBackend,
        backendError,
        probeBackend,
        isMemoriesLive,
        isTasksLive,
        isSkillsLive,
        isApprovalsLive,
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
        isSendingMessage,
        abortSendMessage,
        cancelActiveTask,
        clearConversation,
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
