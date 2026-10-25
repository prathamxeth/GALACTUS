'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  RotateCcw,
  Bug,
  GitCompare,
  Brain,
  Wrench,
  Code2,
  Loader2,
  Activity,
  Check,
  X,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';

interface AgentWorkspaceProps {
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
    sendMessage,
    isBackendOnline,
    probeBackend,
    mode,
  } = useRagnarok();

  const isDev = mode === 'developer';

  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [activeTaskView, setActiveTaskView] = useState<'overview' | 'evidence' | 'diff'>('overview');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleSubmitPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = prompt.trim();
    if (!query || isSubmitting) return;

    setPrompt('');
    setIsSubmitting(true);
    try {
      const isDiagnosticQuery = /fail|broken|error|fix|build|test|diagnos|bug/i.test(query);
      if (isDiagnosticQuery) {
        await startProjectDiagnostics('.', query);
      } else {
        await sendMessage(query, 'chat');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = async (action: 'investigate' | 'changes' | 'feature' | 'memory' | 'review_fix') => {
    if (action === 'investigate') {
      await startProjectDiagnostics('.', 'Investigate current build and test health');
    } else if (action === 'changes') {
      setActiveBottomTab('flight');
      await analyzeWhatChanged();
    } else if (action === 'feature') {
      setPrompt('Implement a feature: ');
      textareaRef.current?.focus();
    } else if (action === 'memory') {
      await sendMessage('List current verified project rules and context', 'chat');
    } else if (action === 'review_fix') {
      if (diagnosticReport?.proposed_repair) {
        setActiveTaskView('diff');
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

  const hasDiagnosticTask = Boolean(diagnosticReport || isDiagnosticLoading || diagnosticError);

  const getStatusBadge = () => {
    if (isDiagnosticLoading || diagnosticStatus === 'INSPECTING') {
      return {
        label: isDev ? 'ANALYZING PROJECT' : 'CHECKING FILES',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    }
    if (
      diagnosticStatus === 'AWAITING_APPROVAL' ||
      diagnosticStatus === 'DIAGNOSED' ||
      diagnosticReport?.proposed_repair
    ) {
      return {
        label: isDev ? 'PATCH PROPOSED — REVIEW REQUIRED' : 'CHANGES READY FOR REVIEW',
        color: 'text-forge-accent bg-forge-accent/10 border-forge-accent/30',
        icon: <AlertTriangle className="w-3 h-3 text-forge-accent" />,
      };
    }
    if (diagnosticStatus === 'REPAIRING') {
      return {
        label: isDev ? 'APPLYING PATCH & VERIFYING' : 'APPLYING UPDATES',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    }
    if (diagnosticStatus === 'VERIFIED') {
      return {
        label: isDev ? 'DIAGNOSTIC COMPLETED' : 'UPDATE COMPLETED',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      };
    }
    if (diagnosticStatus === 'FAILED' || diagnosticStatus === 'ERROR') {
      return {
        label: isDev ? 'ANALYSIS FAILED' : 'COULD NOT COMPLETE',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        icon: <XCircle className="w-3 h-3 text-rose-400" />,
      };
    }
    return {
      label: isDev ? (diagnosticStatus || 'READY') : 'READY',
      color: 'text-forge-muted bg-forge-panel border-forge',
      icon: <Activity className="w-3 h-3" />,
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="flex-1 flex flex-col bg-forge-canvas text-forge-primary overflow-y-auto custom-scrollbar select-none transition-colors duration-150">
      {/* 1. Header Workspace Context Strip */}
      <div className="h-10 px-5 border-b border-forge bg-forge-panel flex items-center justify-between text-xs shrink-0 transition-colors duration-150">
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
              <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span>{isBackendOnline ? 'Ready to help' : 'Offline'}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Workspace Body */}
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
              onClick={() => probeBackend()}
              className="px-2.5 py-1 rounded text-[11px] font-mono font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 transition-colors duration-150 active:translate-y-px cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* =========================================================================
            STATE A: ACTIVE TASK SURFACE (When a task or diagnostic has run)
            ========================================================================= */}
        {hasDiagnosticTask ? (
          <div className="space-y-6">
            {/* Task Header */}
            <div className="p-5 rounded-xl border border-forge bg-forge-panel space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border ${statusBadge.color}`}
                    >
                      {statusBadge.icon}
                      {statusBadge.label}
                    </span>
                    {isDev && diagnosticReport?.task_id && (
                      <span className="text-[11px] font-mono text-forge-muted tabular-nums">
                        task: {diagnosticReport.task_id}
                      </span>
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-forge-primary font-sans">
                    {diagnosticReport?.user_request || (isDev ? 'Project Diagnostic & Verified Repair' : 'Workspace Update')}
                  </h2>
                </div>

                {/* Sub-view switcher */}
                <div className="flex items-center p-0.5 rounded-lg bg-forge-canvas border border-forge text-xs font-mono">
                  <button
                    onClick={() => setActiveTaskView('overview')}
                    className={`px-3 py-1 rounded-md transition-colors duration-150 ${
                      activeTaskView === 'overview'
                        ? 'bg-forge-panel text-forge-primary font-medium border border-forge shadow-xs'
                        : 'text-forge-muted hover:text-forge-primary'
                    }`}
                  >
                    {isDev ? 'Overview & Plan' : 'Overview'}
                  </button>
                  <button
                    onClick={() => setActiveTaskView('evidence')}
                    className={`px-3 py-1 rounded-md transition-colors duration-150 ${
                      activeTaskView === 'evidence'
                        ? 'bg-forge-panel text-forge-primary font-medium border border-forge shadow-xs'
                        : 'text-forge-muted hover:text-forge-primary'
                    }`}
                  >
                    {isDev
                      ? `Facts & Evidence (${diagnosticReport?.observed_facts?.length || 0})`
                      : `Details (${diagnosticReport?.observed_facts?.length || 0})`}
                  </button>
                  {diagnosticReport?.proposed_repair && (
                    <button
                      onClick={() => setActiveTaskView('diff')}
                      className={`px-3 py-1 rounded-md transition-colors duration-150 flex items-center gap-1 ${
                        activeTaskView === 'diff'
                          ? 'bg-forge-panel text-forge-accent font-medium border border-forge shadow-xs'
                          : 'text-forge-muted hover:text-forge-accent'
                      }`}
                    >
                      <span>{isDev ? 'Diff' : 'Changes'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-forge-accent" />
                    </button>
                  )}
                </div>
              </div>

              {/* Observable Progress Stepper */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-forge text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
                  <span className="text-[10px] text-forge-muted block">{isDev ? '1. INSPECT' : '1. CHECK'}</span>
                  <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{isDev ? 'Workspace Verified' : 'Files Checked'}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
                  <span className="text-[10px] text-forge-muted block">{isDev ? '2. EVIDENCE' : '2. FINDINGS'}</span>
                  <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                    {diagnosticReport?.observed_facts && diagnosticReport.observed_facts.length > 0 ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Activity className="w-3 h-3 text-amber-400" />
                    )}
                    <span className="tabular-nums">
                      {isDev
                        ? `${diagnosticReport?.observed_facts?.length || 0} Facts Collected`
                        : `${diagnosticReport?.observed_facts?.length || 0} Items Found`}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
                  <span className="text-[10px] text-forge-muted block">{isDev ? '3. PROPOSAL' : '3. SUGGESTION'}</span>
                  <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                    {diagnosticReport?.proposed_repair ? (
                      <CheckCircle2 className="w-3 h-3 text-forge-accent" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-dashed border-forge-strong" />
                    )}
                    <span>
                      {diagnosticReport?.proposed_repair
                        ? (isDev ? 'Patch Ready' : 'Ready to Review')
                        : (isDev ? 'Analyzing' : 'Preparing')}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
                  <span className="text-[10px] text-forge-muted block">{isDev ? '4. VERIFICATION' : '4. FINISH'}</span>
                  <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                    {diagnosticReport?.verification_results?.passed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : diagnosticReport?.verification_results ? (
                      <XCircle className="w-3 h-3 text-rose-400" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-dashed border-forge-strong" />
                    )}
                    <span>
                      {diagnosticReport?.verification_results?.passed
                        ? (isDev ? 'Pass (Exit 0)' : 'Completed')
                        : diagnosticReport?.verification_results
                        ? (isDev ? `Exit ${Object.values(diagnosticReport.verification_results.exit_codes)[0] ?? 1}` : 'Needs Review')
                        : (isDev ? 'Pending Approval' : 'Pending Review')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: Overview & Plan */}
            {activeTaskView === 'overview' && (
              <div className="space-y-6">
                {/* Proposed Repair Action Banner (if active) */}
                {diagnosticReport?.proposed_repair && (
                  <div className="p-5 rounded-xl border border-forge-accent/40 bg-forge-elevated space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-forge-accent/15 text-forge-accent border border-forge-accent/30">
                            {isDev ? 'APPROVAL GATE' : 'REVIEW NEEDED'}
                          </span>
                          <span className="text-xs font-mono text-forge-muted">
                            {isDev
                              ? `risk: ${diagnosticReport.proposed_repair.risk_level?.toUpperCase() || 'LOW'}`
                              : `Priority: ${diagnosticReport.proposed_repair.risk_level === 'high' ? 'High' : 'Normal'}`}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-forge-primary">
                          {isDev
                            ? `Proposed Patch for ${diagnosticReport.proposed_repair.files_to_modify?.join(', ') || 'project files'}`
                            : `Suggested updates for ${diagnosticReport.proposed_repair.files_to_modify?.join(', ') || 'files'}`}
                        </h3>
                        {isDev ? (
                          <p className="text-xs text-forge-secondary leading-relaxed">
                            Verification command after patch application:{' '}
                            <code className="text-forge-primary font-mono bg-forge-panel px-1.5 py-0.5 rounded border border-forge">
                              {diagnosticReport.proposed_repair.expected_verification_commands?.[0] || 'npm test'}
                            </code>
                          </p>
                        ) : (
                          <p className="text-xs text-forge-secondary leading-relaxed">
                            These updates have been prepared safely and will be verified automatically when applied.
                          </p>
                        )}
                      </div>

                      {/* Explicit Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={handleRejectRepair}
                          disabled={isResolving}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-forge-panel hover:bg-rose-500/10 text-rose-400 border border-forge hover:border-rose-500/40 transition-colors duration-150 active:translate-y-px cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{isDev ? 'Reject Patch' : 'Dismiss'}</span>
                        </button>
                        <button
                          onClick={handleApproveRepair}
                          disabled={isResolving}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-colors duration-150 active:translate-y-px cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          {isResolving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{isDev ? 'Approve & Apply' : 'Apply Changes'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hypotheses Grid */}
                {diagnosticReport?.hypotheses && diagnosticReport.hypotheses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-forge-muted">
                      {isDev ? 'Diagnostic Hypotheses (Ranked by Confidence)' : 'Identified Issues & Causes'}
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {diagnosticReport.hypotheses.map((hyp, i) => (
                        <div
                          key={hyp.finding_id || i}
                          className="p-3.5 rounded-lg bg-forge-panel border border-forge space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-forge-primary">{hyp.summary}</span>
                            <span className="text-[11px] font-mono text-forge-muted tabular-nums">
                              {isDev
                                ? `confidence: ${Math.round((hyp.confidence || 0.8) * 100)}%`
                                : `${Math.round((hyp.confidence || 0.8) * 100)}% match`}
                            </span>
                          </div>
                          {hyp.limitations && (
                            <p className="text-xs text-forge-secondary font-mono leading-relaxed pl-2 border-l border-forge-strong">
                              {hyp.limitations}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification Result Output */}
                {diagnosticReport?.verification_results && (
                  <div className="p-4 rounded-xl bg-forge-panel border border-forge space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                        {diagnosticReport.verification_results.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>
                          {diagnosticReport.verification_results.passed
                            ? (isDev ? 'Verification Succeeded' : 'All Checks Passed')
                            : (isDev ? 'Verification Failed with Non-Zero Exit' : 'Some Checks Did Not Pass')}
                        </span>
                      </div>
                      {isDev && (
                        <span className="text-[11px] font-mono text-forge-muted tabular-nums">
                          {Object.entries(diagnosticReport.verification_results.exit_codes).map(([cmd, code]) => `${cmd}: exit ${code}`).join(', ') || 'exit 0'}
                        </span>
                      )}
                    </div>

                    {isDev && diagnosticReport.verification_results.outputs && Object.keys(diagnosticReport.verification_results.outputs).length > 0 && (
                      <pre className="p-3 rounded bg-forge-canvas border border-forge text-[11px] font-mono text-forge-secondary leading-5 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {Object.entries(diagnosticReport.verification_results.outputs).map(([cmd, out]) => `$ ${cmd}\n${out}`).join('\n\n')}
                      </pre>
                    )}

                    {!diagnosticReport.verification_results.passed && (
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-xs text-forge-muted">
                          {isDev
                            ? 'Project state can be safely restored without affecting unrelated files.'
                            : 'You can undo these changes and return to the previous safe state.'}
                        </span>
                        <button
                          onClick={() => recoverDiagnosticProject()}
                          className="px-3 py-1 rounded text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors duration-150 active:translate-y-px cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{isDev ? 'Restore Safe Checkpoint' : 'Undo Changes'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Evidence Viewer */}
            {activeTaskView === 'evidence' && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-forge-muted">
                  Observed Facts & Telemetry
                </h4>
                <div className="p-4 rounded-xl bg-forge-panel border border-forge space-y-2">
                  {diagnosticReport?.observed_facts && diagnosticReport.observed_facts.length > 0 ? (
                    diagnosticReport.observed_facts.map((ev, i) => (
                      <div
                        key={ev.finding_id || i}
                        className="p-2.5 rounded bg-forge-elevated border border-forge text-xs font-mono text-forge-secondary flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-forge-accent font-bold">›</span>
                          <span className="leading-relaxed select-text">{ev.summary}</span>
                        </div>
                        <span className="text-[10px] text-forge-muted shrink-0 font-mono">
                          {ev.category} ({Math.round((ev.confidence || 1) * 100)}%)
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-forge-muted font-mono py-4 text-center">
                      No external error traces recorded during this diagnostic cycle.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Diff Review */}
            {activeTaskView === 'diff' && diagnosticReport?.proposed_repair && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-forge-muted">
                    Review Proposed File Modifications
                  </h4>
                  <div className="flex items-center gap-2">
                    {diagnosticReport.proposed_repair.files_to_modify?.map((file, i) => (
                      <button
                        key={i}
                        onClick={() => (onOpenFile ? onOpenFile(file) : openFile(file))}
                        className="px-2 py-0.5 rounded text-[11px] font-mono text-forge-secondary bg-forge-elevated border border-forge hover:border-forge-accent hover:text-forge-primary transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <FileCode className="w-3 h-3 text-forge-accent" />
                        <span>Open in Editor ({file})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-forge-panel border border-forge overflow-x-auto">
                  <pre className="text-xs font-mono leading-5 select-text">
                    {(
                      diagnosticReport.proposed_repair.exact_patch ||
                      diagnosticReport.proposed_repair.actions?.[0]?.diff_patch ||
                      diagnosticReport.proposed_repair.explanation ||
                      'No diff content available.'
                    )
                      .split('\n')
                      .map((line: string, idx: number) => {
                        const isAdd = line.startsWith('+');
                        const isDel = line.startsWith('-');
                        const isMeta = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                        return (
                          <div
                            key={idx}
                            className={`px-2 py-0.5 ${
                              isAdd
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : isDel
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                                : isMeta
                                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/5'
                                : 'text-forge-secondary'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                  </pre>
                </div>
              </div>
            )}
            {/* Docked Agent Follow-up Composer in Active Task State */}
            <div className="pt-4 border-t border-forge">
              <form onSubmit={handleSubmitPrompt} className="rounded-xl border border-forge bg-forge-panel p-3 space-y-2 focus-within:border-forge-accent/60 transition-colors">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitPrompt();
                    }
                  }}
                  rows={2}
                  placeholder={
                    isDev
                      ? 'Ask follow-up, request adjustment, or instruct next step...'
                      : 'Describe what you would like to change or do next...'
                  }
                  className="w-full bg-transparent text-xs text-forge-primary placeholder:text-forge-muted focus:outline-none resize-none font-sans leading-relaxed"
                />
                <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-forge-muted">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-forge-elevated border border-forge text-forge-secondary text-[10px]">
                      @workspace
                    </span>
                    <span className="text-[10px]">Enter to send • Shift+Enter for newline</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || isSubmitting}
                    className="px-3 py-1 rounded-md text-xs font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
                  >
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STATE B: DEFAULT AGENT HOME STATE (Focused & Intelligent)
             ========================================================================= */
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
            <div className="rounded-2xl border border-forge bg-forge-panel shadow-2xl p-4 space-y-3 focus-within:border-forge-accent/60 transition-colors duration-150">
              <form onSubmit={handleSubmitPrompt}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitPrompt();
                    }
                  }}
                  rows={3}
                  placeholder={
                    isDev
                      ? 'Ask MEMORAG to investigate test failures, review proposed fixes, or build features...'
                      : 'Describe what you want to create, fix, or change...'
                  }
                  className="w-full bg-transparent text-sm text-forge-primary placeholder:text-forge-muted focus:outline-none resize-none leading-relaxed font-sans"
                />

                <div className="flex items-center justify-between pt-2 border-t border-forge/50">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-forge-muted">
                    <span className="px-2 py-0.5 rounded bg-forge-elevated border border-forge text-forge-secondary">
                      @workspace
                    </span>
                    <span>
                      {isDev
                        ? `${isBackendOnline ? 'gemma4:e2b • Ollama local' : 'Model Offline'}`
                        : `${isBackendOnline ? 'Ready to help' : 'Offline'}`}
                    </span>
                    <span className="text-forge-muted/40">•</span>
                    <span>Enter to send</span>
                  </div>

                  <button
                    type="submit"
                    disabled={!prompt.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-colors duration-150 active:translate-y-px cursor-pointer disabled:opacity-40 shadow-xs"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 5 Starter Actions */}
            <div className="space-y-3">
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
        )}
      </div>
    </div>
  );
};
