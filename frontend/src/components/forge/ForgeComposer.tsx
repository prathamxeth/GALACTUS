'use client';

import React, { KeyboardEvent } from 'react';
import {
  Send,
  Square,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useTextareaResize } from '@/hooks/use-textarea-resize';

export interface ForgeComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  isSubmitting: boolean;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  compact?: boolean;
  isDev?: boolean;
  isBackendOnline?: boolean;
}

export const ForgeComposer: React.FC<ForgeComposerProps> = ({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  onStop,
  placeholder,
  disabled = false,
  errorMessage = null,
  onRetry,
  compact = false,
  isDev = true,
  isBackendOnline = true,
}) => {
  const textareaRef = useTextareaResize(value, compact ? 1 : 2);

  const canSubmit = Boolean(value.trim()) && !isSubmitting && !disabled;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        onSubmit();
      }
    }
  };

  const defaultPlaceholder = compact
    ? isDev
      ? 'Ask follow-up, request fix, or instruct agent...'
      : 'Describe what you would like to do next...'
    : isDev
    ? 'Ask MEMORAG to investigate test failures, review proposed fixes, or build features...'
    : 'Describe what you want to create, fix, or change...';

  return (
    <div
      role="region"
      aria-label="Agent Message Composer"
      className="w-full space-y-2 select-none"
    >
      {/* Error Banner with Retry (Preserving User Draft) */}
      {errorMessage && (
        <div
          role="alert"
          className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 flex items-center justify-between gap-2 animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="truncate">{errorMessage}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isSubmitting}
              className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Main Composer Box */}
      <div
        className={`rounded-xl border bg-forge-panel transition-[border-color,box-shadow] duration-150 ${
          compact ? 'p-2.5' : 'p-3.5 shadow-xl'
        } border-forge focus-within:border-forge-accent/60 focus-within:ring-1 focus-within:ring-forge-accent/20`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
        >
          {/* Accessible auto-resizing textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || (isSubmitting && !onStop)}
            rows={compact ? 1 : 2}
            aria-label="Message prompt"
            placeholder={placeholder || defaultPlaceholder}
            className="w-full bg-transparent text-xs sm:text-[13px] text-forge-primary placeholder:text-forge-muted focus:outline-hidden resize-none leading-relaxed font-sans custom-scrollbar select-text"
          />

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-forge/50 text-[11px] font-mono text-forge-muted">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded bg-forge-elevated border border-forge text-forge-secondary text-[10px]">
                @workspace
              </span>
              <span className="hidden sm:inline text-forge-muted/70">
                {isDev
                  ? `${isBackendOnline ? 'gemma4:e2b • Ollama local' : 'Offline'}`
                  : `${isBackendOnline ? 'Ready to help' : 'Offline'}`}
              </span>
              <span className="text-forge-muted/40 hidden sm:inline">•</span>
              <span className="text-[10px] hidden sm:inline">
                Enter to send • Shift+Enter for newline
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Stop / Cancel Action (Visible ONLY during active execution) */}
              {isSubmitting && onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                  title="Cancel active generation"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              {/* Send Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="Send message"
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-colors duration-150 active:translate-y-px cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs ${
                  compact ? 'h-7' : 'h-8'
                }`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
