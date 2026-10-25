'use client';

import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCode,
  Terminal,
} from 'lucide-react';

export interface InlineApprovalCardProps {
  approvalId: string;
  actionTitle: string;
  toolName?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | string;
  description?: string | null;
  filesToModify?: string[];
  command?: string | null;
  diff?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | 'denied' | string;
  onApprove: () => Promise<void> | void;
  onReject: () => Promise<void> | void;
  isResolving?: boolean;
  onOpenFile?: (file: string) => void;
  className?: string;
}

export const InlineApprovalCard: React.FC<InlineApprovalCardProps> = ({
  approvalId,
  actionTitle,
  toolName = 'system.execute',
  riskLevel = 'high',
  description,
  filesToModify = [],
  command,
  diff,
  status = 'pending',
  onApprove,
  onReject,
  isResolving = false,
  onOpenFile,
  className = '',
}) => {
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected' || status === 'denied';

  const normalizedRisk = riskLevel.toLowerCase();
  const riskBadgeStyles =
    normalizedRisk === 'high' || normalizedRisk === 'critical'
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      : normalizedRisk === 'medium'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  return (
    <div
      role="region"
      aria-label={`Approval Gate: ${actionTitle}`}
      data-approval-id={approvalId}
      className={`rounded-xl border transition-colors select-text ${
        isPending
          ? 'border-forge-accent/50 bg-forge-panel shadow-lg'
          : 'border-forge bg-forge-elevated/60'
      } p-4 space-y-3 font-sans ${className}`}
    >
      {/* Header Banner */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-forge-accent/10 border border-forge-accent/25 text-forge-accent shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-forge-accent">
                Approval Gate
              </span>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold border ${riskBadgeStyles}`}
              >
                Risk: {riskLevel}
              </span>
              {toolName && (
                <span className="text-[10px] font-mono text-forge-muted">
                  tool: {toolName}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-forge-primary leading-snug">
              {actionTitle}
            </h4>
            {description && (
              <p className="text-xs text-forge-secondary leading-relaxed font-sans">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Resolved Indicator (if not pending) */}
        {!isPending && (
          <div className="shrink-0">
            {isApproved ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorized</span>
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <XCircle className="w-3.5 h-3.5" />
                <span>Rejected</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono text-forge-muted">
                {status}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Target Files List */}
      {filesToModify && filesToModify.length > 0 && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-mono uppercase text-forge-muted block">
            Target Files:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {filesToModify.map((file, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenFile && onOpenFile(file)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-forge-elevated border border-forge text-forge-secondary hover:text-forge-primary hover:border-forge-accent transition-colors cursor-pointer"
                title={`Open ${file} in editor`}
              >
                <FileCode className="w-3 h-3 text-forge-accent" />
                <span>{file}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Command Preview */}
      {command && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-mono uppercase text-forge-muted block flex items-center gap-1">
            <Terminal className="w-3 h-3 text-forge-muted" />
            <span>Command to execute:</span>
          </span>
          <code className="block p-2 rounded bg-forge-canvas border border-forge text-[11px] font-mono text-forge-primary break-all">
            {command}
          </code>
        </div>
      )}

      {/* Proposed Diff Preview */}
      {diff && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-mono uppercase text-forge-muted block">
            Proposed Diff:
          </span>
          <pre className="p-2.5 rounded-lg bg-forge-canvas border border-forge text-[10px] font-mono text-forge-secondary max-h-36 overflow-y-auto whitespace-pre custom-scrollbar">
            {diff}
          </pre>
        </div>
      )}

      {/* Protected Loopback Invariant Note */}
      <div className="flex items-center gap-1.5 text-[10px] text-forge-muted font-mono pt-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>Gjallarhorn Gate: Local mutations require explicit operator authorization.</span>
      </div>

      {/* Action Buttons (when pending) */}
      {isPending && (
        <div className="pt-2 border-t border-forge flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onReject}
            disabled={isResolving}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-forge-elevated hover:bg-rose-500/10 text-rose-400 border border-forge hover:border-rose-500/40 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 active:translate-y-px"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            type="button"
            onClick={onApprove}
            disabled={isResolving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-forge-accent hover:bg-forge-accent/90 text-white transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs active:translate-y-px"
          >
            {isResolving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Approve &amp; Apply</span>
          </button>
        </div>
      )}
    </div>
  );
};
