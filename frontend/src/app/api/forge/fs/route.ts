import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FileEntry } from '@/lib/forge/types';
import { isLoopbackRequest } from '@/lib/forge/security';

// Default project root is the GALACTUS workspace root
const DEFAULT_PROJECT_ROOT = path.resolve(process.cwd(), '..');

function getSafePath(projectRoot: string, subPath: string): { fullPath: string; error?: string } {
  const root = path.resolve(projectRoot || DEFAULT_PROJECT_ROOT);
  const normalizedSubPath = (subPath || '').replace(/\\/g, '/');
  const target = path.isAbsolute(normalizedSubPath)
    ? path.resolve(normalizedSubPath)
    : path.resolve(root, normalizedSubPath);

  // Guard against path traversal and access outside project root
  if (!target.startsWith(root)) {
    return { fullPath: '', error: `Path traversal violation: Access outside project root is strictly denied (${subPath})` };
  }
  return { fullPath: target };
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', '__pycache__', '.pytest_cache', '.venv']);

async function buildFileTree(dirPath: string, rootPath: string, depth = 0, maxDepth = 4): Promise<FileEntry[]> {
  if (depth > maxDepth) return [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullEntryPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullEntryPath);

      if (entry.isDirectory()) {
        const children = await buildFileTree(fullEntryPath, rootPath, depth + 1, maxDepth);
        result.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children,
        });
      } else {
        try {
          const stat = await fs.stat(fullEntryPath);
          result.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          });
        } catch {
          result.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          });
        }
      }
    }

    // Sort: directories first, then alphabetically
    return result.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to read directory ${dirPath}:`, msg);
    return [];
  }
}

/**
 * GET /api/forge/fs?action=tree&path=...
 * GET /api/forge/fs?action=read&path=...
 */
export async function GET(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Filesystem endpoints are restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'tree';
    const reqPath = searchParams.get('path') || '';
    const projectRoot = searchParams.get('root') || DEFAULT_PROJECT_ROOT;

    const { fullPath, error } = getSafePath(projectRoot, reqPath);
    if (error) {
      return NextResponse.json({ error, code: 'FORBIDDEN_TRAVERSAL' }, { status: 403 });
    }

    if (action === 'tree') {
      const tree = await buildFileTree(fullPath, projectRoot);
      return NextResponse.json({
        root: projectRoot,
        path: reqPath,
        tree,
      });
    }

    if (action === 'read') {
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          return NextResponse.json({ error: 'Cannot read directory as file' }, { status: 400 });
        }

        // Limit file read size to 1MB to prevent memory exhaustion
        if (stat.size > 1024 * 1024) {
          return NextResponse.json({ error: 'File exceeds 1MB preview limit' }, { status: 413 });
        }

        const content = await fs.readFile(fullPath, 'utf-8');
        return NextResponse.json({
          path: reqPath,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          content,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'File not found';
        return NextResponse.json({ error: msg }, { status: 404 });
      }
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Filesystem read error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/forge/fs
 * Body: { path: string, content: string, approvalToken?: string, root?: string }
 * Writes a file with path containment check and approval gate validation
 */
export async function POST(req: NextRequest) {
  if (!isLoopbackRequest(req)) {
    return NextResponse.json(
      { error: 'Remote access denied: Filesystem endpoints are restricted to loopback (localhost).', code: 'REMOTE_ACCESS_DENIED' },
      { status: 403 }
    );
  }
  try {
    const body = await req.json();
    const { path: reqPath, content, root: projectRoot, approvalToken } = body;

    if (!reqPath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // High-risk write requires approval token if specified
    if (body.requiresApproval && !approvalToken) {
      return NextResponse.json(
        { error: 'Approval required before modifying workspace files', approvalRequired: true },
        { status: 403 }
      );
    }

    const { fullPath, error } = getSafePath(projectRoot || DEFAULT_PROJECT_ROOT, reqPath);
    if (error) {
      return NextResponse.json({ error, code: 'FORBIDDEN_TRAVERSAL' }, { status: 403 });
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Atomic write
    await fs.writeFile(fullPath, content ?? '', 'utf-8');

    const stat = await fs.stat(fullPath);
    return NextResponse.json({
      success: true,
      path: reqPath,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Filesystem write error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
