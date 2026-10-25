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
  Clock,
  HelpCircle,
} from 'lucide-react';

export type ApprovalStatusCategory = 'pending' | 'approved' | 'rejected' | 'unknown';

export interface ApprovalStatusMeta {
  category: ApprovalStatusCategory;
  label: 'Awaiting approval' | 'Approved' | 'Rejected' | 'Unknown';
  badgeClass: string;
  isActionable: boolean;
}

/**
 * Explicit Approval Status Mapper
 * 1. pending / awaiting approval -> 'Awaiting approval' (neutral/amber)
 * 2. approved / authorized -> 'Approved' (green)
 * 3. rejected -> 'Rejected' (red)
 * 4. unknown -> 'Unknown' (never green, neutral/zinc)
 * Strictly avoids inferring authorization from truthy objects or flags.
 */
export function mapApprovalStatus(rawStatus: unknown): ApprovalStatusMeta {
  if (typeof rawStatus !== 'string') {
    return {
      category: 'unknown',
      label: 'Unknown',
      badgeClass: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
      isActionable: false,
    };
  }

  const s = rawStatus.trim().toLowerCase();

  // 1. Pending / awaiting approval
  if (
    s === 'pending' ||
    s === 'awaiting_approval' ||
    s === 'awaiting approval' ||
    s === 'awaiting-approval' ||
    s === 'paused_approval' ||
    s === 'pending_approval' ||
    s === 'paused'
  ) {
    return {
      category: 'pending',
      label: 'Awaiting approval',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      isActionable: true,
    };
  }

  // 2. Approved / authorized
  if (
    s === 'approved' ||
    s === 'authorized' ||
    s === 'verified' ||
    s === 'executed'
  ) {
    return {
      category: 'approved',
      label: 'Approved',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      isActionable: false,
    };
  }

  // 3. Rejected
  if (
    s === 'rejected' ||
    s === 'denied' ||
    s === 'cancelled' ||
    s === 'canceled'
  ) {
    return {
      category: 'rejected',
      label: 'Rejected',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      isActionable: false,
    };
  }

  // 4. Unknown (Never Green)
  return {
    category: 'unknown',
    label: 'Unknown',
    badgeClass: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50',
    isActionable: false,
  };
}

export interface InlineApprovalCardProps {
  approvalId: string;
  actionTitle: string;
  toolName?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | string;
  description?: string | null;
  filesToModify?: string[];
  command?: string | null;
  payload?: Record<string, unknown> | string | null;
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
  payload,
  diff,
  status = 'pending',
  onApprove,
  onReject,
  isResolving = false,
  onOpenFile,
  className = '',
}) => {
  const statusMeta = mapApprovalStatus(status);

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
        statusMeta.category === 'pending'
          ? 'border-forge-accent/50 bg-forge-panel shadow-lg'
          : statusMeta.category === 'approved'
          ? 'border-emerald-500/30 bg-forge-panel'
          : statusMeta.category === 'rejected'
          ? 'border-rose-500/30 bg-forge-panel'
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

        {/* Explicit Status Badge */}
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${statusMeta.badgeClass}`}
            data-testid="approval-status-badge"
            data-status={statusMeta.category}
          >
            {statusMeta.category === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {statusMeta.category === 'rejected' && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
            {statusMeta.category === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
            {statusMeta.category === 'unknown' && <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{statusMeta.label}</span>
          </span>
        </div>
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

      {/* Command / Payload Preview */}
      {(command || payload) && (
        <div className="space-y-1 pt-1">
          <span className="text-[10px] font-mono uppercase text-forge-muted block flex items-center gap-1">
            <Terminal className="w-3 h-3 text-forge-muted" />
            <span>Command / Payload:</span>
          </span>
          <code className="block p-2 rounded bg-forge-canvas border border-forge text-[11px] font-mono text-forge-primary break-all whitespace-pre-wrap">
            {command || (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))}
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

      {/* Action Buttons (when pending / awaiting approval) */}
      {statusMeta.isActionable && (
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
