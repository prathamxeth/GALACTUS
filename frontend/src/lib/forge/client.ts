/**
 * MEMORAG Forge Typed Client
 * 
 * Interacts with the local execution boundary routes at /api/forge/*
 */

import {
  FileEntry,
  PreflightEnvironmentReport,
  FlightEvent,
  ProjectCheckpoint,
  TerminalCommandResult,
  WhatChangedComparison,
} from './types';

export class ForgeClient {
  private baseUrl = '';

  constructor(customUrl?: string) {
    if (customUrl) this.baseUrl = customUrl.replace(/\/+$/, '');
  }

  async fetchFileTree(root?: string): Promise<FileEntry[]> {
    try {
      const url = root
        ? `${this.baseUrl}/api/forge/fs?action=tree&root=${encodeURIComponent(root)}`
        : `${this.baseUrl}/api/forge/fs?action=tree`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.tree) ? data.tree : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async readFile(filePath: string, root?: string): Promise<{ content: string; size: number; mtime: string } | null> {
    try {
      const url = `${this.baseUrl}/api/forge/fs?action=read&path=${encodeURIComponent(filePath)}${
        root ? `&root=${encodeURIComponent(root)}` : ''
      }`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async writeFile(
    filePath: string,
    content: string,
    approvalToken?: string,
    root?: string
  ): Promise<{ success: boolean; error?: string; approvalRequired?: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/fs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content, approvalToken, root }),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true };
      }
      return {
        success: false,
        error: data.error || `HTTP ${res.status}`,
        approvalRequired: data.approvalRequired,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Filesystem write error',
      };
    }
  }

  async executeTerminal(
    command: string,
    cwd?: string,
    approvalToken?: string
  ): Promise<TerminalCommandResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, cwd, approvalToken }),
      });

      if (res.ok) {
        return await res.json();
      }

      const errData = await res.json().catch(() => ({}));
      return {
        command,
        exitCode: res.status === 403 ? 126 : 1,
        stdout: '',
        stderr: errData.error || `Process failed with HTTP ${res.status}`,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      return {
        command,
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Terminal connection error',
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async fetchPreflightReport(): Promise<PreflightEnvironmentReport | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/inspector`, { cache: 'no-store' });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async fetchFlightEvents(): Promise<FlightEvent[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/flight-recorder?action=events`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.events) ? data.events : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async recordFlightEvent(event: Partial<FlightEvent>): Promise<FlightEvent | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/flight-recorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record_event', ...event }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.event;
      }
      return null;
    } catch {
      return null;
    }
  }

  async fetchCheckpoints(): Promise<ProjectCheckpoint[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/flight-recorder?action=checkpoints`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.checkpoints) ? data.checkpoints : [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async createCheckpoint(
    title: string,
    isHealthy: boolean,
    testResults?: ProjectCheckpoint['testResults'],
    evidenceSnapshot?: ProjectCheckpoint['evidenceSnapshot']
  ): Promise<ProjectCheckpoint | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/flight-recorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_checkpoint',
          title,
          isHealthy,
          testResults,
          evidenceSnapshot,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.checkpoint;
      }
      return null;
    } catch {
      return null;
    }
  }

  async compareWhatChanged(): Promise<WhatChangedComparison | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/forge/flight-recorder?action=what-changed`, {
        cache: 'no-store',
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const forgeApi = new ForgeClient();
