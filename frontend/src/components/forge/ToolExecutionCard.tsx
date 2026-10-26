'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  RotateCcw,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  GitCompare,
} from 'lucide-react';
import { DiagnosticReport } from '@/lib/api/types';
import { InlineApprovalCard } from './InlineApprovalCard';

export interface ToolExecutionCardProps {
  report: DiagnosticReport;
  status?: string;
  isLoading?: boolean;
  error?: string | null;
  onApproveRepair?: () => Promise<void> | void;
  onRejectRepair?: () => Promise<void> | void;
  onRecoverProject?: () => Promise<boolean | void> | void;
  onOpenFile?: (file: string) => void;
  isResolving?: boolean;
  isDev?: boolean;
}

export const ToolExecutionCard: React.FC<ToolExecutionCardProps> = ({
  report,
  status = 'READY',
  isLoading = false,
  error = null,
  onApproveRepair,
  onRejectRepair,
  onRecoverProject,
  onOpenFile,
  isResolving = false,
  isDev = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'diff'>('overview');
  const [isExpanded, setIsExpanded] = useState(true);

  const getStatusBadge = () => {
    if (isLoading || status === 'INSPECTING') {
      return {
        label: isDev ? 'ANALYZING PROJECT' : 'CHECKING FILES',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    }
    if (
      status === 'AWAITING_APPROVAL' ||
      status === 'DIAGNOSED' ||
      report?.proposed_repair
    ) {
      return {
        label: isDev ? 'PATCH PROPOSED — REVIEW REQUIRED' : 'CHANGES READY FOR REVIEW',
        color: 'text-forge-accent bg-forge-accent/10 border-forge-accent/30',
        icon: <AlertTriangle className="w-3 h-3 text-forge-accent" />,
      };
    }
    if (status === 'REPAIRING') {
      return {
        label: isDev ? 'APPLYING PATCH & VERIFYING' : 'APPLYING UPDATES',
        color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
      };
    }
    if (status === 'VERIFIED') {
      return {
        label: isDev ? 'DIAGNOSTIC COMPLETED' : 'UPDATE COMPLETED',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      };
    }
    if (status === 'FAILED' || status === 'ERROR' || error) {
      return {
        label: isDev ? 'ANALYSIS FAILED' : 'COULD NOT COMPLETE',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
        icon: <XCircle className="w-3 h-3 text-rose-400" />,
      };
    }
    return {
      label: isDev ? (status || 'READY') : 'READY',
      color: 'text-forge-muted bg-forge-panel border-forge',
      icon: <Activity className="w-3 h-3" />,
    };
  };

  const badge = getStatusBadge();

  return (
    <div
      role="region"
      aria-label="Agent Task Execution Card"
      className="rounded-xl border border-forge bg-forge-panel shadow-sm overflow-hidden select-text transition-colors"
    >
      {/* 1. Header Accordion Bar */}
      <div className="p-4 border-b border-forge flex items-center justify-between gap-3 bg-forge-panel select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border shrink-0 ${badge.color}`}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </span>
          <h3 className="text-sm font-semibold text-forge-primary truncate font-sans">
            {report?.user_request || (isDev ? 'Diagnostic Execution Plan' : 'Workspace Check')}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {report?.task_id && isDev && (
            <span className="text-[11px] font-mono text-forge-muted hidden sm:inline tabular-nums">
              id: {report.task_id.slice(0, 12)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse card' : 'Expand card'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* 2. 4-Step Progress Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            {/* Step 1: Inspect */}
            <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
              <span className="text-[10px] text-forge-muted block">
                {isDev ? '1. INSPECT' : '1. CHECK'}
              </span>
              <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{isDev ? 'Workspace Verified' : 'Files Checked'}</span>
              </div>
            </div>

            {/* Step 2: Evidence */}
            <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
              <span className="text-[10px] text-forge-muted block">
                {isDev ? '2. EVIDENCE' : '2. FINDINGS'}
              </span>
              <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                {report?.observed_facts && report.observed_facts.length > 0 ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Activity className="w-3 h-3 text-amber-400" />
                )}
                <span className="tabular-nums truncate">
                  {report?.observed_facts?.length || 0} Facts Found
                </span>
              </div>
            </div>

            {/* Step 3: Proposal */}
            <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
              <span className="text-[10px] text-forge-muted block">
                {isDev ? '3. PROPOSAL' : '3. SUGGESTION'}
              </span>
              <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                {report?.proposed_repair ? (
                  <CheckCircle2 className="w-3 h-3 text-forge-accent" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-dashed border-forge-strong" />
                )}
                <span className="truncate">
                  {report?.proposed_repair ? 'Patch Ready' : 'Analyzing'}
                </span>
              </div>
            </div>

            {/* Step 4: Verification */}
            <div className="p-2.5 rounded-lg bg-forge-elevated border border-forge space-y-1">
              <span className="text-[10px] text-forge-muted block">
                {isDev ? '4. VERIFICATION' : '4. FINISH'}
              </span>
              <div className="text-[11px] text-forge-primary font-semibold flex items-center gap-1">
                {report?.verification_results?.passed ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : report?.verification_results ? (
                  <XCircle className="w-3 h-3 text-rose-400" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-dashed border-forge-strong" />
                )}
                <span className="truncate">
                  {report?.verification_results?.passed
                    ? 'Pass (Exit 0)'
                    : report?.verification_results
                    ? 'Exit Non-Zero'
                    : 'Pending Approval'}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-view Switcher Tabs */}
          <div className="flex items-center justify-between border-b border-forge pb-2">
            <div className="flex items-center gap-1 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-forge-elevated font-medium text-forge-primary border border-forge shadow-xs'
                    : 'text-forge-muted hover:text-forge-primary'
                }`}
              >
                Overview &amp; Plan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('evidence')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'evidence'
                    ? 'bg-forge-elevated font-medium text-forge-primary border border-forge shadow-xs'
                    : 'text-forge-muted hover:text-forge-primary'
                }`}
              >
                Facts ({report?.observed_facts?.length || 0})
              </button>
              {report?.proposed_repair && (
                <button
                  type="button"
                  onClick={() => setActiveTab('diff')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'diff'
                      ? 'bg-forge-elevated font-medium text-forge-accent border border-forge shadow-xs'
                      : 'text-forge-muted hover:text-forge-accent'
                  }`}
                >
                  <GitCompare className="w-3 h-3" />
                  <span>Diff</span>
                </button>
              )}
            </div>

            {report?.proposed_repair?.files_to_modify && report.proposed_repair.files_to_modify.length > 0 && (
              <div className="flex items-center gap-1">
                {report.proposed_repair.files_to_modify.map((file, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpenFile && onOpenFile(file)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono text-forge-secondary bg-forge-elevated border border-forge hover:border-forge-accent hover:text-forge-primary transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Open ${file} in editor`}
                  >
                    <FileCode className="w-3 h-3 text-forge-accent" />
                    <span>{file}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: OVERVIEW & PLAN */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Proposed Repair Inline Approval Card if active */}
              {report?.proposed_repair && onApproveRepair && onRejectRepair && (
                <InlineApprovalCard
                  approvalId={
                    report.proposed_repair.approval_id || report.proposed_repair.proposal_id || 'approval-0'
                  }
                  actionTitle={
                    report.proposed_repair.summary ||
                    `Proposed Patch for ${report.proposed_repair.files_to_modify?.join(', ') || 'workspace'}`
                  }
                  riskLevel={report.proposed_repair.risk_level || 'medium'}
                  description={
                    report.proposed_repair.explanation ||
                    'Review the proposed updates carefully before authorizing execution.'
                  }
                  filesToModify={report.proposed_repair.files_to_modify}
                  command={report.proposed_repair.expected_verification_commands?.[0]}
                  diff={report.proposed_repair.exact_patch}
                  status={report.status === 'AWAITING_APPROVAL' ? 'pending' : report.status === 'VERIFIED' ? 'approved' : report.status === 'REJECTED' ? 'rejected' : 'pending'}
                  onApprove={onApproveRepair}
                  onReject={onRejectRepair}
                  isResolving={isResolving}
                  onOpenFile={onOpenFile}
                />
              )}

              {/* Hypotheses */}
              {report?.hypotheses && report.hypotheses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-forge-muted">
                    Ranked Hypotheses
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {report.hypotheses.map((hyp, i) => (
                      <div
                        key={hyp.finding_id || i}
                        className="p-3 rounded-lg bg-forge-elevated border border-forge text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-forge-primary">{hyp.summary}</span>
                          <span className="text-[10px] font-mono text-forge-muted tabular-nums">
                            {Math.round((hyp.confidence || 0.8) * 100)}% confidence
                          </span>
                        </div>
                        {hyp.limitations && (
                          <p className="text-[11px] text-forge-secondary font-mono leading-relaxed pl-2 border-l border-forge-strong">
                            {hyp.limitations}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Results */}
              {report?.verification_results && (
                <div className="p-3.5 rounded-xl bg-forge-elevated border border-forge space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                      {report.verification_results.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>
                        {report.verification_results.passed
                          ? 'Verification Succeeded (All checks passed)'
                          : 'Verification Failed with Non-Zero Exit Code'}
                      </span>
                    </div>
                    {report.verification_results.exit_codes && (
                      <span className="text-[10px] font-mono text-forge-muted">
                        {Object.entries(report.verification_results.exit_codes)
                          .map(([cmd, code]) => `${cmd}: exit ${code}`)
                          .join(', ')}
                      </span>
                    )}
                  </div>

                  {report.verification_results.outputs && Object.keys(report.verification_results.outputs).length > 0 && (
                    <pre className="p-2.5 rounded bg-forge-canvas border border-forge text-[10px] font-mono text-forge-secondary leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                      {Object.entries(report.verification_results.outputs)
                        .map(([cmd, out]) => `$ ${cmd}\n${out}`)
                        .join('\n\n')}
                    </pre>
                  )}

                  {!report.verification_results.passed && onRecoverProject && (
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-forge-muted">
                        Undo updates to restore the previous clean checkpoint.
                      </span>
                      <button
                        type="button"
                        onClick={onRecoverProject}
                        className="px-3 py-1 rounded text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore Safe Checkpoint</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EVIDENCE */}
          {activeTab === 'evidence' && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-forge-muted">
                Observed Facts &amp; Telemetry
              </h4>
              <div className="p-3 rounded-xl bg-forge-elevated border border-forge space-y-2">
                {report?.observed_facts && report.observed_facts.length > 0 ? (
                  report.observed_facts.map((fact, i) => (
                    <div
                      key={fact.finding_id || i}
                      className="p-2 rounded bg-forge-canvas border border-forge text-xs font-mono text-forge-secondary flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-forge-accent font-bold">›</span>
                        <span className="leading-relaxed select-text">{fact.summary}</span>
                      </div>
                      <span className="text-[10px] text-forge-muted shrink-0 font-mono">
                        {fact.category} ({Math.round((fact.confidence || 1) * 100)}%)
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-forge-muted font-mono py-3 text-center">
                    No error traces recorded in this cycle.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DIFF */}
          {activeTab === 'diff' && report?.proposed_repair && (
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-forge-canvas border border-forge overflow-x-auto">
                <pre className="text-[11px] font-mono leading-5 select-text custom-scrollbar">
                  {(
                    report.proposed_repair.exact_patch ||
                    report.proposed_repair.actions?.[0]?.diff_patch ||
                    report.proposed_repair.explanation ||
                    'No diff content available.'
                  )
                    .split('\n')
                    .map((line: string, idx: number) => {
                      const isAdd = line.startsWith('+');
                      const isDel = line.startsWith('-');
                      const isMeta =
                        line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');
                      return (
                        <div
                          key={idx}
                          className={`px-2 py-0.5 ${
                            isAdd
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : isDel
                              ? 'bg-rose-500/10 text-rose-400'
                              : isMeta
                              ? 'text-purple-400 bg-purple-500/5'
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
        </div>
      )}
    </div>
  );
};
