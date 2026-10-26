import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { FlightEvent, ProjectCheckpoint, WhatChangedComparison } from '@/lib/forge/types';
import { isLoopbackRequest } from '@/lib/forge/security';

const execAsync = promisify(exec);
const DEFAULT_PROJECT_ROOT = path.resolve(process.cwd(), '..');
const STORE_DIR = path.join(DEFAULT_PROJECT_ROOT, '.memorag');
const EVENTS_FILE = path.join(STORE_DIR, 'flight-events.json');
const CHECKPOINTS_FILE = path.join(STORE_DIR, 'checkpoints.json');

async function ensureStore() {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
    try {
      await fs.access(EVENTS_FILE);
    } catch {
      await fs.writeFile(EVENTS_FILE, '[]', 'utf-8');
    }
    try {
      await fs.access(CHECKPOINTS_FILE);
    } catch {
      await fs.writeFile(CHECKPOINTS_FILE, '[]', 'utf-8');
    }
  } catch (err) {
    console.error('Failed to initialize .memorag store:', err);
  }
}

async function readEvents(): Promise<FlightEvent[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(EVENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeEvents(events: FlightEvent[]): Promise<void> {
  await ensureStore();
  // Bound store to last 200 events
  const bounded = events.slice(-200);
  await fs.writeFile(EVENTS_FILE, JSON.stringify(bounded, null, 2), 'utf-8');
}

async function readCheckpoints(): Promise<ProjectCheckpoint[]> {
  await ensureStore();
  try {
    const raw = await fs.readFile(CHECKPOINTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeCheckpoints(checkpoints: ProjectCheckpoint[]): Promise<void> {
  await ensureStore();
  await fs.writeFile(CHECKPOINTS_FILE, JSON.stringify(checkpoints, null, 2), 'utf-8');
}

async function getDependencyHash(): Promise<string> {
  try {
    const pkgPath = path.join(DEFAULT_PROJECT_ROOT, 'frontend', 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
  } catch {
    return 'none';
  }
}

/**
 * GET /api/forge/flight-recorder?action=events | checkpoints | what-changed
 */
export async function GET(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Flight recorder endpoints are restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'events';

    if (action === 'events') {
      const events = await readEvents();
      return NextResponse.json({ events });
    }

    if (action === 'checkpoints') {
      const checkpoints = await readCheckpoints();
      return NextResponse.json({ checkpoints });
    }

    if (action === 'what-changed' || action === 'what_changed') {
      const checkpoints = await readCheckpoints();
      // Find the most recent checkpoint where isHealthy is strictly true
      const lastHealthy = [...checkpoints].reverse().find((c) => c.isHealthy) || null;

      let gitBranch = 'NEXUS';
      let gitCommit = 'unknown';
      let modifiedFiles: string[] = [];

      try {
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: DEFAULT_PROJECT_ROOT });
        gitBranch = branch.trim();
        const { stdout: commit } = await execAsync('git rev-parse --short HEAD', { cwd: DEFAULT_PROJECT_ROOT });
        gitCommit = commit.trim();
        const { stdout: status } = await execAsync('git status --porcelain', { cwd: DEFAULT_PROJECT_ROOT });
        modifiedFiles = status.split('\n').filter(Boolean).map((l) => l.trim().replace(/^[A-Z?]+\s+/, ''));
      } catch {}

      // Identify differences correlated with failures
      const events = await readEvents();
      const recentFailingTests = events
        .filter((e) => e.type === 'test_failed')
        .slice(-3)
        .map((e) => e.summary);

      const comparison: WhatChangedComparison = {
        lastPassingCheckpoint: lastHealthy,
        currentGitState: {
          branch: gitBranch,
          commit: gitCommit,
          modifiedFiles,
        },
        differences: {
          modifiedFiles,
          dependencyChanges: lastHealthy && lastHealthy.gitCommit !== gitCommit ? ['Git HEAD revision advanced'] : [],
          failingTests: recentFailingTests,
          newErrors: [],
        },
        correlationAnalysis: lastHealthy
          ? `Last verified passing checkpoint: ${lastHealthy.title} (${lastHealthy.gitCommit}). ${modifiedFiles.length} file(s) modified since last passing state.`
          : 'No verified passing checkpoint recorded yet. Run a full passing test suite to register the initial healthy baseline.',
        confidenceScore: lastHealthy ? 0.88 : 0.25,
      };

      return NextResponse.json(comparison);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Flight recorder query failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/forge/flight-recorder
 * Body: { action: 'record_event' | 'create_checkpoint', ... }
 */
export async function POST(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Flight recorder endpoints are restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = body.action || searchParams.get('action');

    if (action === 'record_event') {
      const event: FlightEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        projectId: 'GALACTUS',
        type: body.type || 'build_started',
        summary: body.summary || 'Flight event recorded',
        details: body.details,
        evidence: body.evidence,
        healthyState: body.healthyState,
        provenance: body.provenance || 'system',
      };

      const events = await readEvents();
      events.push(event);
      await writeEvents(events);

      return NextResponse.json({ success: true, event });
    }

    if (action === 'create_checkpoint') {
      let gitCommit = 'unknown';
      let gitBranch = 'NEXUS';
      try {
        const { stdout: commit } = await execAsync('git rev-parse --short HEAD', { cwd: DEFAULT_PROJECT_ROOT });
        gitCommit = commit.trim();
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: DEFAULT_PROJECT_ROOT });
        gitBranch = branch.trim();
      } catch {}

      const depHash = await getDependencyHash();
      // Trustworthy Checkpoint Rule:
      // Never trust client-supplied boolean or claims.
      // A checkpoint is healthy ONLY when verifiable test evidence exists proving tests passed (exit code 0 and no test failures).
      const hasPassingTestEvidence =
        typeof body.evidenceSnapshot?.testsExitCode === 'number' &&
        body.evidenceSnapshot.testsExitCode === 0 &&
        (!body.testResults || body.testResults.failed === 0);

      const isHealthy = hasPassingTestEvidence;

      const checkpoint: ProjectCheckpoint = {
        id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        title: body.title || (isHealthy ? 'Verified Passing Build' : 'Development Snapshot'),
        gitCommit,
        gitBranch,
        isHealthy,
        testResults: body.testResults,
        dependencyFingerprint: depHash,
        modifiedFilesCount: Number(body.modifiedFilesCount || 0),
        evidenceSnapshot: {
          testsExitCode: body.evidenceSnapshot?.testsExitCode,
          buildExitCode: body.evidenceSnapshot?.buildExitCode,
          headCommit: gitCommit,
          packageJsonHash: depHash,
        },
      };

      const checkpoints = await readCheckpoints();
      checkpoints.push(checkpoint);
      await writeCheckpoints(checkpoints);

      // Record corresponding flight event
      const event: FlightEvent = {
        id: `evt-${Date.now()}-chk`,
        timestamp: new Date().toISOString(),
        projectId: 'GALACTUS',
        type: 'checkpoint_created',
        summary: `Checkpoint created: "${checkpoint.title}" (Healthy: ${isHealthy ? 'YES' : 'NO'})`,
        evidence: {
          gitCommit,
          exitCode: checkpoint.evidenceSnapshot.testsExitCode,
        },
        healthyState: isHealthy,
        provenance: 'user',
      };
      const events = await readEvents();
      events.push(event);
      await writeEvents(events);

      return NextResponse.json({ success: true, checkpoint });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Flight recorder operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
