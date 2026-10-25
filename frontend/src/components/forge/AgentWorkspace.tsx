'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Bug,
  GitCompare,
  Brain,
  Wrench,
  Code2,
  ArrowRight,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { Thread } from './Thread';
import { ForgeComposer } from './ForgeComposer';

export interface AgentWorkspaceProps {
  onOpenFile?: (path: string) => void;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ onOpenFile }) => {
  const {
    diagnosticReport,
    diagnosticStatus,
    isDiagnosticLoading,
    diagnosticError,
    startProjectDiagnostics,
    resolveDiagnosticRepair,
    recoverDiagnosticProject,
    preflightReport,
    analyzeWhatChanged,
    openFile,
    checkpoints,
    setActiveBottomTab,
  } = useForge();

  const {
    messages,
    sendMessage,
    isSendingMessage,
    abortSendMessage,
    clearConversation,
    isBackendOnline,
    probeBackend,
    mode,
  } = useRagnarok();

  const isDev = mode === 'developer';

  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const effectiveOpenFile = onOpenFile || openFile;

  // Check if active conversation or task exists
  const hasDiagnosticTask = Boolean(diagnosticReport || isDiagnosticLoading || diagnosticError);
  const hasActiveConversation = messages.length > 0 || hasDiagnosticTask;

  const handleSubmitPrompt = async (customQuery?: string) => {
    const query = (customQuery || prompt).trim();
    if (!query || isSubmitting || isSendingMessage) return;

    setPrompt('');
    setComposerError(null);
    setIsSubmitting(true);

    try {
      const isDiagnosticQuery = /fail|broken|error|fix|build|test|diagnos|bug/i.test(query);
      if (isDiagnosticQuery) {
        await startProjectDiagnostics('.', query);
      } else {
        await sendMessage(query, 'chat');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process request';
      setComposerError(msg);
      setPrompt(query); // Preserve draft on failure
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = async (
    action: 'investigate' | 'changes' | 'feature' | 'memory' | 'review_fix'
  ) => {
    if (action === 'investigate') {
      await startProjectDiagnostics('.', 'Investigate current build and test health');
    } else if (action === 'changes') {
      setActiveBottomTab('flight');
      await analyzeWhatChanged();
    } else if (action === 'feature') {
      setPrompt('Implement a feature: ');
    } else if (action === 'memory') {
      await sendMessage('List current verified project rules and context', 'chat');
    } else if (action === 'review_fix') {
      if (diagnosticReport?.proposed_repair) {
        // Already proposed
      } else {
        await startProjectDiagnostics('.', 'Find and prepare verified fix');
      }
    }
  };

  const handleApproveRepair = async () => {
    if (!diagnosticReport?.proposed_repair) return;
    const approvalId =
      diagnosticReport.proposed_repair.approval_id || diagnosticReport.proposed_repair.proposal_id;
    setIsResolving(true);
    try {
      await resolveDiagnosticRepair(approvalId, 'approved');
    } finally {
      setIsResolving(false);
    }
  };

  const handleRejectRepair = async () => {
    if (!diagnosticReport?.proposed_repair) return;
    const approvalId =
      diagnosticReport.proposed_repair.approval_id || diagnosticReport.proposed_repair.proposal_id;
    setIsResolving(true);
    try {
      await resolveDiagnosticRepair(approvalId, 'rejected');
    } finally {
      setIsResolving(false);
    }
  };

  const handleClearThread = () => {
    clearConversation();
    abortSendMessage();
  };

  // =========================================================================
  // VIEW A: ACTIVE CONVERSATION THREAD (When messages or tasks exist)
  // =========================================================================
  if (hasActiveConversation) {
    return (
      <Thread
        messages={messages}
        isSubmitting={isSubmitting || isSendingMessage || isDiagnosticLoading}
        onSendMessage={handleSubmitPrompt}
        onStopGeneration={abortSendMessage}
        onClearThread={handleClearThread}
        diagnosticReport={diagnosticReport}
        diagnosticStatus={diagnosticStatus}
        isDiagnosticLoading={isDiagnosticLoading}
        diagnosticError={diagnosticError}
        onApproveRepair={handleApproveRepair}
        onRejectRepair={handleRejectRepair}
        onRecoverProject={recoverDiagnosticProject}
        onOpenFile={effectiveOpenFile}
        isResolvingRepair={isResolving}
        isDev={isDev}
        isBackendOnline={isBackendOnline}
        gitBranch={preflightReport?.git?.branch}
      />
    );
  }

  // =========================================================================
  // VIEW B: DEFAULT AGENT HOME EMPTY STATE (Pristine OLED Hero)
  // =========================================================================
  return (
    <div
      role="region"
      aria-label="Agent Workspace"
      className="flex-1 flex flex-col bg-forge-canvas text-forge-primary overflow-y-auto custom-scrollbar select-none transition-colors duration-150"
    >
      {/* 1. Header Workspace Context Strip */}
      <div className="h-10 px-5 border-b border-forge bg-forge-panel flex items-center justify-between text-xs shrink-0 transition-colors">
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

          {isDev && preflightReport?.git && (
            <>
              <span className="text-forge-muted/40">•</span>
              <span className="text-[11px] font-mono text-forge-secondary">
                branch: <span className="text-emerald-400">{preflightReport.git.branch}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-forge-muted">
          {isDev ? (
            <>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="text-forge-secondary">loopback: 127.0.0.1</span>
              </span>
              <span className="text-forge-muted/40">|</span>
              <span className="text-forge-secondary">
                model: {isBackendOnline ? 'gemma4:e2b' : 'offline'}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-forge-secondary">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-400' : 'bg-rose-500'}`}
              />
              <span>{isBackendOnline ? 'Ready to help' : 'Offline'}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Empty State Body */}
      <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Backend Offline Banner */}
        {!isBackendOnline && (
          <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Backend disconnected at http://127.0.0.1:8000. Reconnection attempts in progress.
              </span>
            </div>
            <button
              type="button"
              onClick={() => probeBackend()}
              className="px-2.5 py-1 rounded text-[11px] font-mono font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 transition-colors duration-150 active:translate-y-px cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="space-y-8 my-auto py-6">
          {/* Center Heading */}
          <div className="text-center space-y-2">
            <h1 className="font-heading text-2xl sm:text-3xl font-medium tracking-tight text-forge-primary">
              What would you like to accomplish?
            </h1>
            <p className="text-xs sm:text-sm text-forge-muted max-w-md mx-auto leading-relaxed">
              Describe what you want to build, understand, or fix.
            </p>
          </div>

          {/* Primary Agent Composer */}
          <div className="max-w-2xl mx-auto w-full">
            <ForgeComposer
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleSubmitPrompt}
              isSubmitting={isSubmitting || isSendingMessage}
              onStop={abortSendMessage}
              errorMessage={composerError}
              onRetry={handleSubmitPrompt}
              isDev={isDev}
              isBackendOnline={isBackendOnline}
            />
          </div>

          {/* 5 Starter Quick Actions */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-forge-muted block">
              {isDev ? 'Quick Actions' : 'Getting Started'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* 1. Investigate a build or test failure */}
              <button
                type="button"
                onClick={() => handleActionClick('investigate')}
                disabled={isDiagnosticLoading}
                className="p-3 rounded-xl border border-forge bg-forge-panel hover:bg-forge-elevated hover:border-forge-strong transition-colors duration-150 active:translate-y-px text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-forge-elevated text-forge-accent border border-forge group-hover:border-forge-accent/40 shrink-0">
                  <Bug className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-forge-primary group-hover:text-forge-accent flex items-center gap-1">
                    <span>{isDev ? 'Investigate failure' : 'Fix an issue'}</span>
                    <ArrowRight className="w-3 h-3 text-forge-muted group-hover:text-forge-accent transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <p className="text-[10px] text-forge-muted leading-relaxed">
                    {isDev
                      ? 'Run live diagnostics on current build, test, and exit codes.'
                      : 'Find and fix issues or errors in your files.'}
                  </p>
                </div>
              </button>

              {/* 2. Understand recent changes */}
              <button
                type="button"
                onClick={() => handleActionClick('changes')}
                className="p-3 rounded-xl border border-forge bg-forge-panel hover:bg-forge-elevated hover:border-forge-strong transition-colors duration-150 active:translate-y-px text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-forge-elevated text-purple-400 border border-forge group-hover:border-purple-500/40 shrink-0">
                  <GitCompare className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-forge-primary group-hover:text-forge-accent flex items-center gap-1">
                    <span>{isDev ? 'Recent changes' : 'Review recent changes'}</span>
                    <ArrowRight className="w-3 h-3 text-forge-muted group-hover:text-purple-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <p className="text-[10px] text-forge-muted leading-relaxed">
                    {isDev
                      ? 'Inspect file differences since the last passing build.'
                      : 'See what was updated or edited in your files.'}
                  </p>
                </div>
              </button>

              {/* 3. Implement a feature */}
              <button
                type="button"
                onClick={() => handleActionClick('feature')}
                className="p-3 rounded-xl border border-forge bg-forge-panel hover:bg-forge-elevated hover:border-forge-strong transition-colors duration-150 active:translate-y-px text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-forge-elevated text-amber-400 border border-forge group-hover:border-amber-500/40 shrink-0">
                  <Code2 className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-forge-primary group-hover:text-forge-accent flex items-center gap-1">
                    <span>{isDev ? 'Implement feature' : 'Create something new'}</span>
                    <ArrowRight className="w-3 h-3 text-forge-muted group-hover:text-amber-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <p className="text-[10px] text-forge-muted leading-relaxed">
                    {isDev
                      ? 'Plan and write code changes across multiple files.'
                      : 'Describe an idea or feature to add to your project.'}
                  </p>
                </div>
              </button>

              {/* 4. Review a proposed change */}
              <button
                type="button"
                onClick={() => handleActionClick('review_fix')}
                className="p-3 rounded-xl border border-forge bg-forge-panel hover:bg-forge-elevated hover:border-forge-strong transition-colors duration-150 active:translate-y-px text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-forge-elevated text-emerald-400 border border-forge group-hover:border-emerald-500/40 shrink-0">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-forge-primary group-hover:text-forge-accent flex items-center gap-1">
                    <span>{isDev ? 'Review proposed fix' : 'Review suggestions'}</span>
                    <ArrowRight className="w-3 h-3 text-forge-muted group-hover:text-emerald-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <p className="text-[10px] text-forge-muted leading-relaxed">
                    {isDev
                      ? 'Evaluate active patch proposals, diffs, and verification.'
                      : 'Check suggested updates before applying them to your files.'}
                  </p>
                </div>
              </button>

              {/* 5. Continue with project memory */}
              <button
                type="button"
                onClick={() => handleActionClick('memory')}
                className="p-3 rounded-xl border border-forge bg-forge-panel hover:bg-forge-elevated hover:border-forge-strong transition-colors duration-150 active:translate-y-px text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-1.5 rounded-lg bg-forge-elevated text-blue-400 border border-forge group-hover:border-blue-500/40 shrink-0">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-forge-primary group-hover:text-forge-accent flex items-center gap-1">
                    <span>{isDev ? 'Project memory' : 'Project notes & rules'}</span>
                    <ArrowRight className="w-3 h-3 text-forge-muted group-hover:text-blue-400 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                  <p className="text-[10px] text-forge-muted leading-relaxed">
                    {isDev
                      ? 'Access verified patterns and preferences from Mimir.'
                      : 'View saved preferences, notes, and rules for this project.'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Contextual Verified Checkpoints (Dev Mode) */}
          {isDev && checkpoints.length > 0 && (
            <div className="pt-4 border-t border-forge/50 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-forge-muted block">
                Verified Checkpoints
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {checkpoints.slice(0, 3).map((cp) => (
                  <div
                    key={cp.id}
                    className="px-2.5 py-1 rounded-lg bg-forge-panel border border-forge text-xs font-mono flex items-center gap-2 text-forge-secondary"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-forge-primary font-medium">{cp.title}</span>
                    <span className="text-[10px] text-forge-muted tabular-nums">
                      git: {cp.gitCommit.slice(0, 7)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
