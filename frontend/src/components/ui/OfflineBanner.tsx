'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from './Button';
import { useRagnarok } from '@/lib/context/RagnarokContext';

interface OfflineBannerProps {
  isLive: boolean;
  isChecking?: boolean;
  onRetry?: () => void;
  backendUrl?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isLive,
  isChecking = false,
  onRetry,
  backendUrl = 'http://127.0.0.1:8000',
}) => {
  const { mode, runtimeState, runtimeStatus, backendError } = useRagnarok();
  const isDev = mode === 'developer';

  // State 1: Approval Required
  if (runtimeState === 'Approval Required') {
    return (
      <aside
        aria-label="Approval required banner"
        className="w-full bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
          <span>
            <strong className="font-semibold">Human Authorization Required:</strong>{' '}
            {isDev
              ? 'DAG execution paused at Gjallarhorn approval gate. Explicit authorization required to resume.'
              : 'A task requires your approval before modifying files or running commands.'}
          </span>
        </div>
        <span className="text-[11px] font-mono font-medium text-amber-800 dark:text-amber-300">
          PAUSED_APPROVAL
        </span>
      </aside>
    );
  }

  // State 2: Task Running
  if (runtimeState === 'Task Running') {
    return (
      <aside
        aria-label="Task running banner"
        className="w-full bg-purple-500/15 border-b border-purple-500/30 px-4 py-2 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 animate-spin" />
          <span>
            <strong className="font-semibold">Task Running:</strong>{' '}
            {isDev
              ? 'Executing autonomous DAG workflow. Real-time telemetry streaming over SSE.'
              : 'Executing your request step by step.'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-purple-700 dark:text-purple-300">
          SSE Stream Active
        </span>
      </aside>
    );
  }

  // State 3: Task Failed
  if (runtimeState === 'Task Failed') {
    return (
      <aside
        aria-label="Task failed banner"
        className="w-full bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 flex items-center justify-between text-xs text-rose-900 dark:text-rose-200"
      >
        <div className="flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>
            <strong className="font-semibold">Task Failed:</strong>{' '}
            {isDev
              ? 'Workflow execution halted. Operation was denied or an execution error was caught.'
              : 'The operation was halted safely.'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-rose-700 dark:text-rose-300">
          Execution Halted
        </span>
      </aside>
    );
  }

  // State 4: AI Model Ready
  if (runtimeState === 'AI Model Ready') {
    return (
      <div className="w-full bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {isDev ? (
              <>
                Connected to Sovereign Backend at{' '}
                <code className="font-mono text-emerald-800 dark:text-emerald-200">
                  {backendUrl}
                </code>{' '}
                • AI Model Ready ({runtimeStatus?.model || 'gemma4:e2b'})
              </>
            ) : (
              'Connected to AI service running on this device • Model Ready'
            )}
          </span>
        </div>
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 opacity-90">
          {isDev ? 'Local Loopback Active (0 Outbound Bytes)' : 'Running locally'}
        </span>
      </div>
    );
  }

  // State 5: Backend Connected (Ollama not ready / model not loaded)
  if (runtimeState === 'Backend Connected' || isLive) {
    return (
      <div className="w-full bg-sky-500/10 border-b border-sky-500/20 px-4 py-2 flex items-center justify-between text-xs text-sky-800 dark:text-sky-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>
            {isDev ? (
              <>
                FastAPI Backend Online at{' '}
                <code className="font-mono text-sky-900 dark:text-sky-200">
                  {backendUrl}
                </code>{' '}
                (Inference engine in standby • Model {runtimeStatus?.model || 'gemma4:e2b'})
              </>
            ) : (
              'Connected to local system service • Ready for requests'
            )}
          </span>
        </div>
        <span className="text-[11px] text-sky-700 dark:text-sky-400 opacity-90">
          {isDev ? 'Backend Connected' : 'System Ready'}
        </span>
      </div>
    );
  }

  // State 6 & 7: Backend Disconnected & Offline Preview
  const isDisconnected = runtimeState === 'Backend Disconnected';

  return (
    <aside
      aria-label="Backend status banner"
      className="w-full bg-amber-500/10 border-b border-amber-500/25 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold text-amber-950 dark:text-amber-100">
            {isDisconnected
              ? isDev
                ? 'Backend Disconnected:'
                : 'Service Disconnected:'
              : isDev
              ? 'Offline Preview Mode:'
              : 'Preview Mode Active:'}
          </span>{' '}
          <span className="opacity-90">
            {isDev ? (
              <>
                FastAPI server at{' '}
                <code className="font-mono bg-black/10 dark:bg-black/40 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">
                  {backendUrl}
                </code>{' '}
                {backendError ? `(${backendError})` : 'is currently offline.'}
              </>
            ) : (
              'The background AI service is currently starting up or resting.'
            )}{' '}
          </span>
          <span className="text-dim text-[11px] block sm:inline">
            {isDev
              ? '(Showing isolated test fixtures. No real actions dispatched.)'
              : '(Showing demonstration items so you can explore the interface safely.)'}
          </span>
        </div>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          loading={isChecking}
          icon={<RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />}
          className="text-xs py-1 border-amber-500/40 hover:bg-amber-500/15 text-amber-900 dark:text-amber-200"
        >
          {isDev ? 'Test Endpoint' : 'Check Connection'}
        </Button>
      )}
    </aside>
  );
};
