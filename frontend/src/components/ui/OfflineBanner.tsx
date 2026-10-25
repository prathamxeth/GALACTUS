'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
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
  const { mode } = useRagnarok();
  const isDev = mode === 'developer';

  if (isLive) {
    return (
      <div className="w-full bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {isDev ? (
              <>
                Connected to Sovereign Local FastAPI Backend at{' '}
                <code className="font-mono text-emerald-800 dark:text-emerald-200">
                  {backendUrl}
                </code>
              </>
            ) : (
              'Connected to AI service running on this device'
            )}
          </span>
        </div>
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 opacity-90">
          {isDev ? 'Local Loopback Active (Ollama)' : 'Running locally'}
        </span>
      </div>
    );
  }

  return (
    <aside
      aria-label="Backend status banner"
      className="w-full bg-amber-500/10 border-b border-amber-500/25 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold text-amber-950 dark:text-amber-100">
            {isDev ? 'Offline Staging Preview Active:' : 'Preview Mode Active:'}
          </span>{' '}
          <span className="opacity-90">
            {isDev ? (
              <>
                FastAPI server at{' '}
                <code className="font-mono bg-black/10 dark:bg-black/40 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">
                  {backendUrl}
                </code>{' '}
                is currently offline.
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
