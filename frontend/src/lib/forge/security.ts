import { NextRequest } from 'next/server';

/**
 * Validates that an incoming HTTP request originates strictly from loopback.
 * By default, remote LAN execution is denied unless explicitly enabled via FORGE_ALLOW_REMOTE_EXECUTION=true.
 */
export function isLoopbackRequest(req: NextRequest): boolean {
  if (process.env.FORGE_ALLOW_REMOTE_EXECUTION === 'true') {
    return true;
  }

  const hostHeader = req.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0].toLowerCase();
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const clientIp = forwarded.split(',')[0].trim() || req.headers.get('x-real-ip') || '';

  const isLoopbackHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  const isLoopbackIp =
    !clientIp ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1';

  return isLoopbackHost && isLoopbackIp;
}

/**
 * Sanitizes data to ensure no sensitive credentials, tokens, or keys are logged.
 */
export function sanitizeLogData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    'token',
    'approvaltoken',
    'authorization',
    'password',
    'secret',
    'key',
    'privatekey',
    'content',
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      sanitized[k] = sanitizeLogData(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}
