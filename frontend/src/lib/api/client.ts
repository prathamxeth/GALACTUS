/**
 * Ragnarok Typed API Client Boundary
 * 
 * Centralized client connecting the Next.js frontend to the Python FastAPI backend.
 * Base URL: Read from NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL with fallback to http://127.0.0.1:8000.
 * 
 * Endpoints:
 * - GET /api/health — backend health & local Ollama status
 * - GET /api/memory/episodic — chronological memory events
 * - GET /api/memory/semantic?query= — saved facts & preferences
 * - POST /api/memory/semantic — create fact (category, fact_key, fact_content, is_verified, tokens)
 * - DELETE /api/memory/{id} — delete using exact ID returned by backend
 * - GET /api/memory/export — export memories
 * - GET /api/tasks/incomplete — incomplete & PAUSED_APPROVAL tasks
 * - POST /api/permissions/approve — submit approval payload
 * - GET /api/skills — registered skills with mock/incomplete markers
 */

import {
  AgentRuntimeStatus,
  ApprovalRequest,
  ChatMessage,
  EpisodicMemory,
  MemoryRecord,
  PrivacySettings,
  SemanticMemory,
  SkillDefinition,
  TaskGraph,
  CreateSemanticFactRequest,
  PermissionApprovalPayload,
  PermissionApprovalResponse,
  BackendIncompleteTask,
  BackendEpisodicMemory,
  BackendSemanticMemory,
} from './types';
import {
  DEMO_APPROVALS,
  DEMO_CHAT_MESSAGES,
  DEMO_MEMORIES,
  DEMO_PRIVACY_SETTINGS,
  DEMO_RUNTIME_STATUS,
  DEMO_TASKS,
} from './fixtures';

export interface HealthCheckResult {
  online: boolean;
  url: string;
  latencyMs?: number;
  message?: string;
  ollamaStatus?: 'connected' | 'disconnected' | 'degraded' | string;
  activeModel?: string;
  version?: string;
}

export interface ApiResponse<T> {
  data: T;
  isLive: boolean;
  error?: string;
  statusCode?: number;
}

const DEFAULT_BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://127.0.0.1:8000';

export class RagnarokApiClient {
  private baseUrl: string;

  constructor(customUrl?: string) {
    this.baseUrl = customUrl || DEFAULT_BACKEND_URL;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * GET /api/health (with fallback to /health)
   * Probe backend health and local Ollama status
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      // Try /api/health first
      let res = await fetch(`${this.baseUrl}/api/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });

      // If /api/health 404s, try fallback /health
      if (res.status === 404) {
        res = await fetch(`${this.baseUrl}/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
      }

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (res.ok) {
        let body: Record<string, unknown> = {};
        try {
          body = await res.json();
        } catch {
          // non-json response
        }

        const ollamaObj = (body.ollama as Record<string, unknown>) || {};
        return {
          online: true,
          url: this.baseUrl,
          latencyMs,
          version: typeof body.version === 'string' ? body.version : undefined,
          ollamaStatus:
            typeof ollamaObj.status === 'string'
              ? ollamaObj.status
              : typeof body.ollamaStatus === 'string'
              ? body.ollamaStatus
              : 'connected',
          activeModel:
            typeof ollamaObj.active_model === 'string'
              ? ollamaObj.active_model
              : typeof body.model === 'string'
              ? body.model
              : 'llama3.2:3b-instruct-q8_0',
        };
      }

      return {
        online: false,
        url: this.baseUrl,
        latencyMs,
        message: `FastAPI responded with HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      return {
        online: false,
        url: this.baseUrl,
        message: err instanceof Error ? err.message : 'Backend unreachable (Connection refused)',
      };
    }
  }

  /**
   * GET /api/memory/episodic
   * Retrieve chronological episodic memory events
   */
  async getEpisodicMemories(): Promise<ApiResponse<EpisodicMemory[]>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/api/memory/episodic`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        const items: BackendEpisodicMemory[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const normalized: EpisodicMemory[] = items.map((item, idx) => ({
          id: String(item.id ?? `epi-${idx}`),
          type: 'episodic',
          title: item.title || item.event_type || `Event #${item.id || idx}`,
          content: item.content || item.description || '',
          timestamp: item.timestamp || item.created_at || new Date().toISOString(),
          sourceEvent: item.source_event || item.source || 'system_event',
          importanceScore: item.importance_score ?? item.importanceScore ?? 0.8,
          tags: Array.isArray(item.tags) ? item.tags : [],
          pinned: Boolean(item.pinned),
          isBackendRecord: true,
        }));

        return { data: normalized, isLive: true };
      }

      return {
        data: [],
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      return {
        data: [],
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to fetch episodic memories',
      };
    }
  }

  /**
   * GET /api/memory/semantic?query=
   * Retrieve saved facts and preferences with search filter support
   */
  async getSemanticMemories(query?: string): Promise<ApiResponse<SemanticMemory[]>> {
    try {
      const q = query ? `?query=${encodeURIComponent(query.trim())}` : '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/api/memory/semantic${q}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        const items: BackendSemanticMemory[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const normalized: SemanticMemory[] = items.map((item, idx) => ({
          id: String(item.id ?? `sem-${idx}`),
          type: 'semantic',
          category: (['fact', 'preference', 'entity', 'rule'].includes(item.category)
            ? item.category
            : 'fact') as SemanticMemory['category'],
          subject: item.fact_key || item.subject || `Fact #${item.id || idx}`,
          statement: item.fact_content || item.statement || '',
          factKey: item.fact_key,
          isVerified: item.is_verified ?? false,
          tokens: item.tokens ?? 0,
          confidence: 0.95,
          updatedAt: item.updated_at || item.created_at || new Date().toISOString(),
          accessCount: 1,
          decayFactor: 0.1,
          isBackendRecord: true,
        }));

        return { data: normalized, isLive: true };
      }

      return {
        data: [],
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      return {
        data: [],
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to fetch semantic memories',
      };
    }
  }

  /**
   * POST /api/memory/semantic
   * Create a fact using category, fact_key, fact_content, is_verified, and tokens
   */
  async createSemanticFact(
    fact: CreateSemanticFactRequest
  ): Promise<ApiResponse<SemanticMemory | null>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: fact.category,
          fact_key: fact.fact_key,
          fact_content: fact.fact_content,
          is_verified: Boolean(fact.is_verified),
          tokens: Number(fact.tokens) || Math.ceil(fact.fact_content.length / 4),
        }),
      });

      if (res.ok) {
        const created: BackendSemanticMemory = await res.json();
        const normalized: SemanticMemory = {
          id: String(created.id ?? `sem-${Date.now()}`),
          type: 'semantic',
          category: (created.category as SemanticMemory['category']) || fact.category,
          subject: created.fact_key || fact.fact_key,
          statement: created.fact_content || fact.fact_content,
          factKey: created.fact_key || fact.fact_key,
          isVerified: created.is_verified ?? fact.is_verified,
          tokens: created.tokens ?? fact.tokens,
          confidence: 1.0,
          updatedAt: created.updated_at || new Date().toISOString(),
          accessCount: 1,
          decayFactor: 0.05,
          isBackendRecord: true,
        };
        return { data: normalized, isLive: true };
      }

      let errDetail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errDetail = errJson.detail || errJson.message || errDetail;
      } catch {
        // non-json error
      }
      return { data: null, isLive: false, error: errDetail, statusCode: res.status };
    } catch (err: unknown) {
      return {
        data: null,
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to create semantic fact',
      };
    }
  }

  /**
   * DELETE /api/memory/{id}
   * Delete using the exact ID returned by the backend
   */
  async deleteMemory(id: string | number): Promise<ApiResponse<{ deleted: boolean; id: string }>> {
    const strId = String(id);
    try {
      // Primary route: /api/memory/{id}
      let res = await fetch(`${this.baseUrl}/api/memory/${encodeURIComponent(strId)}`, {
        method: 'DELETE',
      });

      // Fallback route: /api/memories/{id}
      if (res.status === 404) {
        res = await fetch(`${this.baseUrl}/api/memories/${encodeURIComponent(strId)}`, {
          method: 'DELETE',
        });
      }

      if (res.ok) {
        return { data: { deleted: true, id: strId }, isLive: true };
      }

      return {
        data: { deleted: false, id: strId },
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Failed to delete memory ${strId}`,
      };
    } catch (err: unknown) {
      return {
        data: { deleted: false, id: strId },
        isLive: false,
        error: err instanceof Error ? err.message : `Failed to delete memory ${strId}`,
      };
    }
  }

  /**
   * GET /api/memory/export
   * Export memories handling real response format (JSON or raw text)
   */
  async exportMemories(): Promise<ApiResponse<{ content: string; filename: string; mimeType: string }>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/memory/export`, {
        cache: 'no-store',
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let content = '';

        if (contentType.includes('application/json')) {
          const json = await res.json();
          content = JSON.stringify(json, null, 2);
        } else {
          content = await res.text();
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        return {
          data: {
            content,
            filename: `ragnarok_memory_export_${dateStr}.json`,
            mimeType: 'application/json',
          },
          isLive: true,
        };
      }

      return {
        data: { content: '', filename: '', mimeType: 'text/plain' },
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Export endpoint returned error`,
      };
    } catch (err: unknown) {
      return {
        data: { content: '', filename: '', mimeType: 'text/plain' },
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to export memories',
      };
    }
  }

  /**
   * GET /api/tasks/incomplete
   * Retrieve incomplete tasks and tasks paused awaiting approval (PAUSED_APPROVAL)
   */
  async getIncompleteTasks(): Promise<ApiResponse<TaskGraph[]>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.baseUrl}/api/tasks/incomplete`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        const items: BackendIncompleteTask[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const normalized: TaskGraph[] = items.map((task, idx) => {
          const rawStatus = String(task.status || 'running');
          const isApprovalPaused =
            rawStatus === 'PAUSED_APPROVAL' || rawStatus === 'awaiting_approval';

          const mappedStatus: TaskGraph['status'] = isApprovalPaused
            ? 'awaiting_approval'
            : rawStatus === 'completed'
            ? 'completed'
            : rawStatus === 'failed'
            ? 'failed'
            : 'running';

          const action = task.action_details || task.actionDetails;
          const approvalReqId =
            task.approval_request_id ||
            task.approvalRequestId ||
            (isApprovalPaused ? `appr-${task.id || idx}` : undefined);

          // Normalize steps safely
          const steps = (task.steps || []).map((step, sIdx) => ({
            id: String(step.id || `step-${idx}-${sIdx}`),
            stepNumber: Number(step.stepNumber ?? sIdx + 1),
            title: step.title || `Execution Step ${sIdx + 1}`,
            skillName: step.skillName || action?.tool_name || action?.toolName || 'agent.action',
            status: step.status || (isApprovalPaused && sIdx === 0 ? 'awaiting_approval' : 'running'),
            parameters: step.parameters || action?.parameters || {},
            output: step.output,
            error: step.error,
            reflectionAttempt: Number(step.reflectionAttempt ?? 0),
            approvalRequestId: step.approvalRequestId || approvalReqId,
          }));

          // If no steps returned by backend, construct step from action_details if paused
          if (steps.length === 0 && isApprovalPaused && action) {
            steps.push({
              id: `step-${task.id}-approval`,
              stepNumber: 1,
              title: action.action_title || action.actionTitle || 'Protected System Operation',
              skillName: action.tool_name || action.toolName || 'system.operation',
              status: 'awaiting_approval',
              parameters: action.parameters || {},
              output: action.rationale || action.description,
              error: undefined,
              reflectionAttempt: 0,
              approvalRequestId: approvalReqId,
            });
          }

          return {
            id: String(task.id || `task-inc-${idx}`),
            goal: task.goal || 'Incomplete Autonomous Workflow',
            status: mappedStatus,
            createdAt: task.created_at || task.createdAt || new Date().toISOString(),
            updatedAt: task.updated_at || task.updatedAt || new Date().toISOString(),
            priority: task.priority || 'normal',
            steps,
            errorMessage: task.error_message || task.errorMessage,
          };
        });

        return { data: normalized, isLive: true };
      }

      return {
        data: [],
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Failed to fetch incomplete tasks`,
      };
    } catch (err: unknown) {
      return {
        data: [],
        isLive: false,
        error: err instanceof Error ? err.message : 'Backend tasks/incomplete unreachable',
      };
    }
  }

  /**
   * POST /api/permissions/approve
   * Submit documented approval payload
   */
  async submitPermissionApproval(
    payload: PermissionApprovalPayload
  ): Promise<ApiResponse<PermissionApprovalResponse>> {
    try {
      // Documented body: { request_id, approved, decision, notes }
      const body = {
        request_id: payload.request_id,
        requestId: payload.request_id,
        task_id: payload.task_id,
        approved: payload.approved,
        decision: payload.decision,
        notes: payload.notes || '',
      };

      // Try POST /api/permissions/approve
      let res = await fetch(`${this.baseUrl}/api/permissions/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // If /api/permissions/approve returns 404, fallback to /api/approvals/{requestId}
      if (res.status === 404 && payload.request_id) {
        res = await fetch(`${this.baseUrl}/api/approvals/${encodeURIComponent(payload.request_id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: payload.decision, notes: payload.notes }),
        });
      }

      if (res.ok) {
        let respData: Record<string, unknown> = {};
        try {
          respData = await res.json();
        } catch {
          // non-json OK
        }

        return {
          data: {
            success: true,
            status: payload.decision === 'approved' ? 'approved' : 'denied',
            message: typeof respData.message === 'string' ? respData.message : 'Permission decision registered',
          },
          isLive: true,
        };
      }

      let errDetail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errDetail = errJson.detail || errJson.message || errDetail;
      } catch {
        // non-json
      }

      return {
        data: { success: false, status: 'pending', message: errDetail },
        isLive: false,
        statusCode: res.status,
        error: errDetail,
      };
    } catch (err: unknown) {
      return {
        data: { success: false, status: 'pending' },
        isLive: false,
        error: err instanceof Error ? err.message : 'Failed to submit permission approval',
      };
    }
  }

  /**
   * GET /api/skills
   * Show registered skills, clearly marking mock or incomplete data
   */
  async getSkills(): Promise<ApiResponse<SkillDefinition[]>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${this.baseUrl}/api/skills`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const raw = await res.json();
        const items: Record<string, unknown>[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const normalized: SkillDefinition[] = items.map((s, idx) => ({
          id: String(s.id || `skill-${idx}`),
          name: String(s.name || `skill_${idx}`),
          displayName: String(s.displayName || s.display_name || s.name || `Skill #${idx}`),
          description: String(s.description || 'Registered agent skill'),
          category: (['system', 'filesystem', 'network', 'communication', 'developer'].includes(
            String(s.category)
          )
            ? s.category
            : 'developer') as SkillDefinition['category'],
          isSandboxed: Boolean(s.isSandboxed ?? s.is_sandboxed ?? true),
          requiresApproval: Boolean(s.requiresApproval ?? s.requires_approval ?? false),
          riskLevel: (['low', 'medium', 'high', 'critical'].includes(String(s.riskLevel || s.risk_level))
            ? s.riskLevel || s.risk_level
            : 'low') as SkillDefinition['riskLevel'],
          parameters: Array.isArray(s.parameters)
            ? (s.parameters as SkillDefinition['parameters'])
            : [],
          executionCount: Number(s.executionCount ?? s.execution_count ?? 0),
          lastExecutedAt: typeof s.lastExecutedAt === 'string' ? s.lastExecutedAt : undefined,
          enabled: Boolean(s.enabled ?? true),
          isMock: Boolean(s.isMock ?? s.is_mock ?? false),
          isIncomplete: Boolean(s.isIncomplete ?? s.is_incomplete ?? false),
        }));

        return { data: normalized, isLive: true };
      }

      return {
        data: [],
        isLive: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Failed to fetch skills registry`,
      };
    } catch (err: unknown) {
      return {
        data: [],
        isLive: false,
        error: err instanceof Error ? err.message : 'Skills registry endpoint unreachable',
      };
    }
  }

  // --- Supplementary & Legacy Compatibility Methods ---

  async getTasks(): Promise<ApiResponse<TaskGraph[]>> {
    // Forward to getIncompleteTasks for live sync
    const incompleteRes = await this.getIncompleteTasks();
    if (incompleteRes.isLive) {
      return incompleteRes;
    }
    // Return empty list with error if offline
    return {
      data: DEMO_TASKS,
      isLive: false,
      error: incompleteRes.error || `FastAPI backend at ${this.baseUrl} is offline.`,
    };
  }

  async getMemories(type?: 'episodic' | 'semantic'): Promise<ApiResponse<MemoryRecord[]>> {
    if (type === 'episodic') {
      const res = await this.getEpisodicMemories();
      return { data: res.data, isLive: res.isLive, error: res.error };
    }
    if (type === 'semantic') {
      const res = await this.getSemanticMemories();
      return { data: res.data, isLive: res.isLive, error: res.error };
    }
    const [epi, sem] = await Promise.all([
      this.getEpisodicMemories(),
      this.getSemanticMemories(),
    ]);
    const merged = [...epi.data, ...sem.data];
    return {
      data: merged.length > 0 ? merged : DEMO_MEMORIES,
      isLive: epi.isLive || sem.isLive,
      error: !epi.isLive && !sem.isLive ? 'Backend memory endpoints unreachable.' : undefined,
    };
  }

  async getApprovals(): Promise<ApiResponse<ApprovalRequest[]>> {
    const incomplete = await this.getIncompleteTasks();
    if (incomplete.isLive) {
      const approvalList: ApprovalRequest[] = [];
      for (const t of incomplete.data) {
        if (t.status === 'awaiting_approval') {
          for (const s of t.steps) {
            if (s.status === 'awaiting_approval') {
              approvalList.push({
                id: s.approvalRequestId || `appr-${t.id}`,
                taskId: t.id,
                stepId: s.id,
                taskGoal: t.goal,
                actionTitle: s.title,
                toolName: s.skillName,
                riskLevel: 'high',
                rationale: s.output || 'Protected operation requires explicit human consent.',
                commandOrPayload: JSON.stringify(s.parameters, null, 2),
                parameters: s.parameters,
                createdAt: t.updatedAt,
                status: 'pending',
              });
            }
          }
        }
      }
      return { data: approvalList, isLive: true };
    }
    return {
      data: DEMO_APPROVALS,
      isLive: false,
      error: `FastAPI backend at ${this.baseUrl} is offline.`,
    };
  }

  async resolveApproval(
    requestId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ): Promise<ApiResponse<{ success: boolean; status: string }>> {
    const res = await this.submitPermissionApproval({
      request_id: requestId,
      approved: decision === 'approved',
      decision: decision === 'approved' ? 'approved' : 'denied',
      notes,
    });
    return {
      data: { success: res.data.success, status: res.data.status },
      isLive: res.isLive,
      error: res.error,
    };
  }

  async getRuntimeStatus(): Promise<ApiResponse<AgentRuntimeStatus>> {
    const health = await this.checkHealth();
    if (health.online) {
      return {
        data: {
          ...DEMO_RUNTIME_STATUS,
          online: true,
          model: health.activeModel || 'llama3.2:3b-instruct-q8_0',
          ollamaStatus: (health.ollamaStatus as AgentRuntimeStatus['ollamaStatus']) || 'connected',
          latencyMs: health.latencyMs || 45,
        },
        isLive: true,
      };
    }
    return {
      data: DEMO_RUNTIME_STATUS,
      isLive: false,
      error: `FastAPI backend at ${this.baseUrl} is unreachable.`,
    };
  }

  async sendPrompt(
    prompt: string,
    mode: 'chat' | 'task' | 'memory' = 'chat'
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        return { data, isLive: true };
      }
    } catch {
      // offline
    }
    return {
      data: {
        id: `msg-${Date.now()}`,
        role: 'agent',
        content: `[Offline Staging Mode] Request "${prompt}" staged. Real inference requires the live FastAPI backend at ${this.baseUrl}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        thoughtTrace: `Status: Backend offline. No live model responded.`,
      },
      isLive: false,
      error: `FastAPI backend at ${this.baseUrl} is offline.`,
    };
  }

  async getPrivacySettings(): Promise<ApiResponse<PrivacySettings>> {
    return { data: DEMO_PRIVACY_SETTINGS, isLive: false };
  }

  async updatePrivacySettings(
    settings: Partial<PrivacySettings>
  ): Promise<ApiResponse<PrivacySettings>> {
    return { data: { ...DEMO_PRIVACY_SETTINGS, ...settings }, isLive: false };
  }
}

export const api = new RagnarokApiClient();
export { DEMO_CHAT_MESSAGES };
