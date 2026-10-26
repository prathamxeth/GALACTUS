'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';
import {
  Send,
  Square,
  Loader2,
  AlertCircle,
  RotateCcw,
  Paperclip,
  X,
  FileText,
  ChevronDown,
  Check,
  Cpu,
} from 'lucide-react';
import { useTextareaResize } from '@/hooks/use-textarea-resize';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { MessageAttachment } from '@/lib/api/types';

export interface ForgeComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (attachments?: MessageAttachment[]) => Promise<void> | void;
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

const MAX_ATTACHMENT_SIZE = 1024 * 1024; // 1 MB
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.rs',
  '.go', '.txt', '.html', '.css', '.toml', '.yaml', '.yml', '.sh',
];

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
  const { modelStatus, availableModels, runtimeStatus } = useRagnarok();
  const textareaRef = useTextareaResize(value, compact ? 1 : 2);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const canSubmit = (Boolean(value.trim()) || attachments.length > 0) && !isSubmitting && !disabled;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        handleSubmit();
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentError(null);
    const newAttachments: MessageAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate size
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setAttachmentError(`File "${file.name}" exceeds 1MB limit. Attachments must be under 1MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Validate extension
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      const isAllowed = ALLOWED_EXTENSIONS.includes(ext) || file.type.startsWith('text/');
      if (!isAllowed) {
        setAttachmentError(`File "${file.name}" has an unsupported format. Supported formats: code and text files (.ts, .js, .json, .md, .py, etc.).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        const textContent = await file.text();
        newAttachments.push({
          name: file.name,
          path: file.name,
          size: file.size,
          content: textContent,
          type: file.type || 'text/plain',
        });
      } catch {
        setAttachmentError(`Failed to read content of "${file.name}".`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const currentAttachments = [...attachments];
    setAttachments([]);
    try {
      await onSubmit(currentAttachments);
    } catch {
      // Re-instate attachments if submission failed
      setAttachments(currentAttachments);
    }
  };

  const defaultPlaceholder = compact
    ? isDev
      ? 'Ask a question, describe a change, or instruct the agent...'
      : 'Describe what you would like to do next...'
    : isDev
    ? 'Ask a question, investigate build failures, review proposed changes, or build features...'
    : 'Describe what you want to create, fix, or change...';

  const activeModel = runtimeStatus?.model || availableModels[0] || 'gemma4:e2b';

  const modelStatusDotColor =
    modelStatus === 'ready'
      ? 'bg-emerald-400'
      : modelStatus === 'connecting'
      ? 'bg-amber-400 animate-pulse'
      : modelStatus === 'degraded'
      ? 'bg-amber-400'
      : modelStatus === 'unavailable'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  return (
    <div
      role="region"
      aria-label="Agent Message Composer"
      className="w-full space-y-2 select-none"
    >
      {/* Error Banner with Retry (Preserving User Draft) */}
      {(errorMessage || attachmentError) && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="truncate">{errorMessage || attachmentError}</span>
          </div>
          {onRetry && !attachmentError && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
          {attachmentError && (
            <button
              type="button"
              onClick={() => setAttachmentError(null)}
              className="p-1 rounded text-rose-300 hover:text-white"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Composer Box (assistant-ui inspired rounded card) */}
      <div
        className={`rounded-2xl border bg-forge-panel/95 backdrop-blur-md transition-all duration-150 relative ${
          compact ? 'p-3' : 'p-4 shadow-xl'
        } border-forge focus-within:border-forge-accent/60 focus-within:ring-2 focus-within:ring-forge-accent/20 shadow-md`}
      >
        {/* Attached Files Chips Bar */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-forge/50 mb-2.5">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-forge-elevated border border-forge text-xs font-mono text-forge-secondary animate-in fade-in duration-100"
              >
                <FileText className="w-3.5 h-3.5 text-forge-accent shrink-0" />
                <span className="font-medium truncate max-w-[160px]">{att.name}</span>
                <span className="text-[11px] text-forge-muted tabular-nums">
                  {Math.max(1, Math.round(att.size / 1024))}KB
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-0.5 rounded hover:bg-forge-hover hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove attachment"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) handleSubmit();
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
            className="w-full bg-transparent text-[13.5px] sm:text-[14px] text-forge-primary placeholder:text-forge-muted/70 focus:outline-hidden resize-none leading-relaxed font-sans custom-scrollbar select-text min-h-[38px] max-h-[220px]"
          />

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-2.5 border-t border-forge/50 text-xs font-mono text-forge-muted">
            <div className="flex items-center gap-1.5">
              {/* Attach File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isSubmitting}
                className="p-1.5 rounded-lg text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40"
                title="Attach file (<1MB)"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileSelect}
                className="hidden"
                tabIndex={-1}
              />

              {/* Functional Model Selector Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-forge-elevated transition-colors cursor-pointer text-xs"
                  title="View model status & configured runtime"
                  aria-haspopup="dialog"
                  aria-expanded={isModelMenuOpen}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${modelStatusDotColor}`} />
                  <span className="text-forge-secondary font-medium">{activeModel}</span>
                  <ChevronDown className="w-3 h-3 text-forge-muted" />
                </button>

                {isModelMenuOpen && (
                  <div
                    role="dialog"
                    aria-label="Model Configuration"
                    className="absolute bottom-full left-0 mb-2 w-72 p-3.5 rounded-2xl bg-forge-elevated border border-forge shadow-2xl space-y-3 z-40 text-xs font-sans animate-in fade-in slide-in-from-bottom-2 duration-150"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-forge font-mono text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-forge-primary">
                        <Cpu className="w-3.5 h-3.5 text-forge-accent" />
                        <span>Configured Model</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsModelMenuOpen(false)}
                        className="p-0.5 rounded text-forge-muted hover:text-forge-primary"
                        aria-label="Close model configuration"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono text-forge-muted uppercase tracking-wider">
                        Active Local Engine
                      </div>
                      <div className="p-2.5 rounded-xl bg-forge-panel border border-forge flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-mono text-xs font-semibold text-forge-primary flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${modelStatusDotColor}`} />
                            <span>{activeModel}</span>
                          </div>
                          <div className="text-[11px] font-mono text-forge-muted">
                            {isBackendOnline ? (runtimeStatus?.ollamaEndpoint || 'http://127.0.0.1:11434') : 'Offline (http://127.0.0.1:8000)'}
                          </div>
                        </div>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-forge-panel/70 border border-forge text-xs leading-relaxed text-forge-muted">
                      <span className="font-medium text-forge-secondary">Status: </span>
                      {modelStatus === 'ready'
                        ? 'Model loaded and ready.'
                        : modelStatus === 'connecting'
                        ? 'Connecting to runtime...'
                        : modelStatus === 'degraded'
                        ? 'Fallback mode active.'
                        : 'Runtime service unavailable.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Stop / Cancel Action (Visible ONLY during active execution) */}
              {isSubmitting && onStop && (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
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
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-all duration-150 active:translate-y-px cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs ${
                  compact ? 'h-8' : 'h-8.5'
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
