import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { isLoopbackRequest } from '@/lib/forge/security';

const execAsync = promisify(exec);

const DEFAULT_PROJECT_ROOT = path.resolve(process.cwd(), '..');

// Approved command binaries
const ALLOWED_BINARIES = new Set([
  'git',
  'npm',
  'npx',
  'node',
  'python',
  'python3',
  'pytest',
  'cat',
  'ls',
  'grep',
  'pwd',
  'echo',
]);

// Dangerous pattern guards
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  />\s*\/dev\//,
  /\|\s*bash/,
  /\|\s*sh/,
  /sudo\s+/,
  /mkfs/,
  /chmod\s+-R\s+777/,
];

function isCommandPermitted(cmdStr: string): { allowed: boolean; reason?: string } {
  const trimmed = cmdStr.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Empty command' };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { allowed: false, reason: `Command rejected by safety policy: matches forbidden pattern (${pattern})` };
    }
  }

  // Extract initial binary
  const binary = trimmed.split(/[\s|&;]+/)[0].trim().toLowerCase();
  const baseBinary = path.basename(binary);

  if (!ALLOWED_BINARIES.has(baseBinary)) {
    return {
      allowed: false,
      reason: `Command binary '${baseBinary}' is not in the Forge permitted toolchain allowlist (${Array.from(ALLOWED_BINARIES).join(', ')})`,
    };
  }

  return { allowed: true };
}

/**
 * POST /api/forge/terminal
 * Body: { command: string, cwd?: string, approvalToken?: string }
 */
export async function POST(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Terminal execution is restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  const startTime = performance.now();
  try {
    const body = await req.json();
    const { command, cwd: requestedCwd, approvalToken } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Missing command string' }, { status: 400 });
    }

    const permission = isCommandPermitted(command);
    if (!permission.allowed) {
      return NextResponse.json(
        {
          error: permission.reason,
          code: 'COMMAND_DISALLOWED',
          command,
        },
        { status: 403 }
      );
    }

    // High-risk commands (e.g. commands involving destructive changes) require approval token
    const isHighRisk =
      command.includes('reset --hard') ||
      command.includes('clean -fd') ||
      command.includes('install -g') ||
      body.requiresApproval;

    if (isHighRisk && !approvalToken) {
      return NextResponse.json(
        {
          error: 'Approval required for this high-risk terminal operation.',
          approvalRequired: true,
          command,
        },
        { status: 403 }
      );
    }

    let workingDir = requestedCwd
      ? path.resolve(DEFAULT_PROJECT_ROOT, requestedCwd)
      : DEFAULT_PROJECT_ROOT;

    // Verify cwd stays inside project root
    if (!workingDir.startsWith(DEFAULT_PROJECT_ROOT)) {
      return NextResponse.json(
        { error: 'Working directory outside project root is forbidden' },
        { status: 403 }
      );
    }

    // For npm/npx commands, locate the package.json directory if running at monorepo root
    const trimmedCmd = command.trim();
    const isNpmCommand = trimmedCmd.startsWith('npm ') || trimmedCmd.startsWith('npx ') || trimmedCmd === 'npm' || trimmedCmd === 'npx';
    if (isNpmCommand && !requestedCwd) {
      if (!fs.existsSync(path.join(workingDir, 'package.json'))) {
        const candidates = ['frontend', 'web', 'client', 'app', 'ui'];
        for (const candidate of candidates) {
          const candidatePath = path.join(workingDir, candidate);
          if (fs.existsSync(path.join(candidatePath, 'package.json'))) {
            workingDir = candidatePath;
            break;
          }
        }
      }
    }

    // Include .venv/bin in PATH for python/pytest tools
    const venvBin = path.join(DEFAULT_PROJECT_ROOT, '.venv/bin');
    const extraPath = fs.existsSync(venvBin) ? `${venvBin}:` : '';
    const reportedCwd = path.relative(DEFAULT_PROJECT_ROOT, workingDir) || '.';

    // Execute with timeout and buffer limits
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 25000, // 25s max
        maxBuffer: 1024 * 1024, // 1MB buffer
        env: {
          ...process.env,
          PATH: `${extraPath}${process.env.PATH || ''}`,
          PAGER: 'cat',
          CI: '1',
        },
      });

      const durationMs = Math.round(performance.now() - startTime);

      return NextResponse.json({
        command,
        exitCode: 0,
        stdout: stdout || '',
        stderr: stderr || '',
        durationMs,
        cwd: reportedCwd,
        timestamp: new Date().toISOString(),
      });
    } catch (execErr: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const err = execErr as { code?: number | string; stdout?: string; stderr?: string; message?: string };

      const exitCode = typeof err.code === 'number' ? err.code : 1;
      const stdout = err.stdout || '';
      const stderr = err.stderr || err.message || '';

      return NextResponse.json({
        command,
        exitCode,
        stdout,
        stderr,
        durationMs,
        cwd: reportedCwd,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terminal execution failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
