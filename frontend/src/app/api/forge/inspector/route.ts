import { NextRequest, NextResponse } from 'next/server';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { PreflightEnvironmentReport } from '@/lib/forge/types';
import { isLoopbackRequest } from '@/lib/forge/security';

const execAsync = promisify(exec);
const DEFAULT_PROJECT_ROOT = path.resolve(process.cwd(), '..');

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://127.0.0.1:8000';

async function safeExec(cmd: string, cwd = DEFAULT_PROJECT_ROOT): Promise<{ output: string; ok: boolean }> {
  try {
    const { stdout } = await execAsync(cmd, { cwd, timeout: 5000 });
    return { output: stdout.trim(), ok: true };
  } catch {
    return { output: '', ok: false };
  }
}

/**
 * GET /api/forge/inspector
 * Generates an on-device capability report with real hardware, git, and toolchain telemetry.
 */
export async function GET(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Inspector endpoint is restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  const timestamp = new Date().toISOString();

  // 1. Hardware & OS
  const totalRamMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeRamMb = Math.round(os.freemem() / 1024 / 1024);
  const processMemoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  // 2. Git status
  const gitBranch = await safeExec('git rev-parse --abbrev-ref HEAD');
  const gitCommit = await safeExec('git rev-parse --short HEAD');
  const gitStatus = await safeExec('git status --porcelain');

  const modifiedFiles = gitStatus.output
    ? gitStatus.output.split('\n').filter(Boolean).map((line) => line.trim())
    : [];

  // 3. Toolchain versions
  const npmVersion = await safeExec('npm --version');
  const pythonVersion = await safeExec('python3 --version');
  const gitVersion = await safeExec('git --version');

  // 4. Backend & Ollama connectivity probe
  let backendReachable = false;
  let backendLatencyMs = 0;
  let activeModel = 'unavailable';
  let ollamaStatus = 'disconnected';
  let activeModelLoaded = false;
  let serviceName: string | undefined = undefined;

  const startProbe = performance.now();
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/+$/, '')}/api/agent/status`, {
      signal: AbortSignal.timeout(3500),
      cache: 'no-store',
    });
    backendLatencyMs = Math.round(performance.now() - startProbe);

    if (res.ok) {
      const data = await res.json();
      backendReachable = true;
      activeModel = data.model || 'gemma4:e2b';
      ollamaStatus = data.ollama || 'connected';
      activeModelLoaded = data.ollama === 'connected';
      serviceName = data.service || 'MEMORAG Sovereign Agent';
    }
  } catch {
    backendReachable = false;
  }

  const report: PreflightEnvironmentReport = {
    timestamp,
    os: {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
    },
    resources: {
      totalRamMb,
      freeRamMb,
      processMemoryMb,
    },
    git: {
      installed: gitVersion.ok,
      branch: gitBranch.ok ? gitBranch.output : 'unknown',
      commit: gitCommit.ok ? gitCommit.output : 'unknown',
      isClean: modifiedFiles.length === 0,
      modifiedCount: modifiedFiles.length,
      modifiedFiles: modifiedFiles.slice(0, 15),
    },
    toolchains: {
      node: {
        version: process.version,
        available: true,
      },
      npm: {
        version: npmVersion.ok ? npmVersion.output : 'unavailable',
        available: npmVersion.ok,
      },
      python: {
        version: pythonVersion.ok ? pythonVersion.output : 'unavailable',
        available: pythonVersion.ok,
      },
      git: {
        version: gitVersion.ok ? gitVersion.output : 'unavailable',
        available: gitVersion.ok,
      },
    },
    backend: {
      url: BACKEND_URL,
      reachable: backendReachable,
      latencyMs: backendLatencyMs,
      model: activeModel,
      ollamaStatus,
      activeModelLoaded,
      serviceName,
    },
    security: {
      projectRoot: DEFAULT_PROJECT_ROOT,
      isolationMode: 'constrained_loopback',
      approvalRequiredForModifications: true,
    },
  };

  return NextResponse.json(report);
}
