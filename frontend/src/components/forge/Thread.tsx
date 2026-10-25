'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ArrowDown,
  RotateCcw,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { ChatMessage, DiagnosticReport, MessageAttachment } from '@/lib/api/types';
import { MessageItem } from './MessageItem';
import { ToolExecutionCard } from './ToolExecutionCard';
import { ForgeComposer } from './ForgeComposer';

export interface ThreadProps {
  messages: ChatMessage[];
  isSubmitting: boolean;
  onSendMessage: (text: string, attachments?: MessageAttachment[]) => Promise<void> | void;
  onStopGeneration?: () => void;
  onClearThread?: () => void;
  diagnosticReport?: DiagnosticReport | null;
  diagnosticStatus?: string;
  isDiagnosticLoading?: boolean;
  diagnosticError?: string | null;
  onApproveRepair?: (approvalId?: string) => Promise<void> | void;
  onRejectRepair?: (approvalId?: string) => Promise<void> | void;
  onRecoverProject?: () => Promise<boolean | void> | void;
  onOpenFile?: (file: string) => void;
  isResolvingRepair?: boolean;
  isDev?: boolean;
  isBackendOnline?: boolean;
  gitBranch?: string;
}

export const Thread: React.FC<ThreadProps> = ({
  messages,
  isSubmitting,
  onSendMessage,
  onStopGeneration,
  onClearThread,
  diagnosticReport,
  diagnosticStatus,
  isDiagnosticLoading,
  diagnosticError,
  onApproveRepair,
  onRejectRepair,
  onRecoverProject,
  onOpenFile,
  isResolvingRepair = false,
  isDev = true,
  isBackendOnline = true,
  gitBranch,
}) => {
  const [prompt, setPrompt] = useState('');
  const [lastFailedDraft, setLastFailedDraft] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user is scrolled near the bottom (within 100px)
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceToBottom < 100);
  }, []);

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  }, []);

  // Auto-scroll when new messages arrive (only if user was already at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom(true);
    }
  }, [messages, isSubmitting, diagnosticReport, isAtBottom, scrollToBottom]);

  const handleSubmit = async (attachments?: MessageAttachment[]) => {
    const text = prompt.trim();
    const hasAttachments = Boolean(attachments && attachments.length > 0);
    if ((!text && !hasAttachments) || isSubmitting) return;

    setPrompt('');
    setErrorMessage(null);
    setLastFailedDraft(text);

    try {
      await onSendMessage(text, attachments);
      setLastFailedDraft(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setErrorMessage(msg);
      setPrompt(text); // Preserve user's draft on error
    }
  };

  const handleRetry = async () => {
    if (lastFailedDraft) {
      setPrompt(lastFailedDraft);
      await handleSubmit();
    }
  };

  const hasDiagnostic = Boolean(diagnosticReport || isDiagnosticLoading || diagnosticError);

  return (
    <div
      role="region"
      aria-label="Agent Conversation Thread"
      className="flex-1 flex flex-col h-full bg-forge-canvas text-forge-primary overflow-hidden select-none"
    >
      {/* 1. Header Context Strip */}
      <div className="h-10 px-4 border-b border-forge bg-forge-panel flex items-center justify-between text-xs shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-forge-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-accent" />
            <span className="text-[11px] font-mono tracking-tight">workspace: GALACTUS</span>
          </div>

          {isDev && (
            <>
              <span className="text-forge-muted/40">•</span>
              <span className="text-[11px] font-mono text-forge-secondary">
                package: <span className="text-forge-primary">frontend</span>
              </span>
            </>
          )}

          {isDev && gitBranch && (
            <>
              <span className="text-forge-muted/40">•</span>
              <span className="text-[11px] font-mono text-forge-secondary">
                branch: <span className="text-emerald-400">{gitBranch}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-forge-muted">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="text-forge-secondary hidden sm:inline">loopback: 127.0.0.1</span>
          </span>

          <span className="text-forge-muted/40">•</span>

          <span className="text-forge-secondary">
            {isBackendOnline ? 'gemma4:e2b' : 'offline'}
          </span>

          {onClearThread && (
            <>
              <span className="text-forge-muted/40">•</span>
              <button
                type="button"
                onClick={onClearThread}
                className="px-2 py-0.5 rounded text-[11px] font-mono text-forge-secondary hover:text-forge-primary hover:bg-forge-elevated border border-forge transition-colors flex items-center gap-1 cursor-pointer"
                title="Start a fresh conversation"
              >
                <RotateCcw className="w-3 h-3 text-forge-muted" />
                <span>New Chat</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Scrollable Messages Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 custom-scrollbar relative"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Render All Messages in Chronological Order */}
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onApproveProposal={
                onApproveRepair
                  ? async (id: string) => {
                      if (onApproveRepair) await onApproveRepair(id);
                    }
                  : undefined
              }
              onRejectProposal={
                onRejectRepair
                  ? async (id: string) => {
                      if (onRejectRepair) await onRejectRepair(id);
                    }
                  : undefined
              }
              onOpenFile={onOpenFile}
              isResolvingApproval={isResolvingRepair}
            />
          ))}

          {/* Render Inline Tool Execution Card if diagnostic task active */}
          {hasDiagnostic && diagnosticReport && (
            <div className="my-2">
              <ToolExecutionCard
                report={diagnosticReport}
                status={diagnosticStatus}
                isLoading={isDiagnosticLoading}
                error={diagnosticError}
                onApproveRepair={onApproveRepair}
                onRejectRepair={onRejectRepair}
                onRecoverProject={onRecoverProject}
                onOpenFile={onOpenFile}
                isResolving={isResolvingRepair}
                isDev={isDev}
              />
            </div>
          )}

          {/* Active Generation Pending Indicator */}
          {isSubmitting && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2.5 p-3 rounded-xl bg-forge-panel border border-forge text-xs text-forge-secondary animate-pulse max-w-md"
            >
              <div className="w-4 h-4 rounded-full bg-forge-accent/20 border border-forge-accent/40 flex items-center justify-center text-forge-accent shrink-0">
                <Bot className="w-2.5 h-2.5 animate-spin" />
              </div>
              <span className="font-mono text-[11px]">
                Reasoning with local gemma4:e2b &amp; Mimir memory...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll-to-Bottom Button */}
        {!isAtBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-forge-elevated border border-forge text-forge-primary shadow-xl hover:bg-forge-panel transition-all duration-150 cursor-pointer flex items-center gap-1.5 text-xs font-mono z-30"
            title="Scroll to latest message"
          >
            <ArrowDown className="w-3.5 h-3.5 text-forge-accent" />
            <span className="text-[11px] pr-1">Latest</span>
          </button>
        )}
      </div>

      {/* 3. Docked Sticky Composer Area */}
      <div className="p-4 border-t border-forge bg-forge-canvas/90 backdrop-blur-xs shrink-0">
        <div className="max-w-4xl mx-auto">
          <ForgeComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onStop={onStopGeneration}
            errorMessage={errorMessage}
            onRetry={handleRetry}
            compact
            isDev={isDev}
            isBackendOnline={isBackendOnline}
          />
        </div>
      </div>
    </div>
  );
};
