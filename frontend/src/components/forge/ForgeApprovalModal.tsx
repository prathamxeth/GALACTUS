'use client';

import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';

export const ForgeApprovalModal: React.FC = () => {
  const { pendingForgeApproval, resolveForgeApproval } = useForge();

  if (!pendingForgeApproval) return null;

  const { title, description, targetPath, command, riskLevel, diff } =
    pendingForgeApproval;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg rounded-xl bg-surface border border-[#F04424]/40 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="p-4 border-b border-subtle bg-canvas flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#F04424] shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-main">{title}</h3>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold ${
                    riskLevel === 'high'
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                      : riskLevel === 'medium'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                  }`}
                >
                  Risk: {riskLevel}
                </span>
              </div>
              <p className="text-xs text-secondary mt-1 leading-relaxed font-sans">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Action Details */}
        <div className="p-4 space-y-3 bg-surface text-xs font-mono select-text">
          {targetPath && (
            <div className="p-2.5 rounded bg-canvas border border-subtle space-y-1">
              <span className="text-[10px] uppercase text-muted font-bold block">
                Target Workspace File:
              </span>
              <span className="text-secondary break-all">{targetPath}</span>
            </div>
          )}

          {command && (
            <div className="p-2.5 rounded bg-canvas border border-subtle space-y-1">
              <span className="text-[10px] uppercase text-muted font-bold block">
                Command to Execute:
              </span>
              <code className="text-[#F04424] break-all">{command}</code>
            </div>
          )}

          {diff && (
            <div className="p-2.5 rounded bg-canvas border border-subtle space-y-1 max-h-36 overflow-y-auto">
              <span className="text-[10px] uppercase text-muted font-bold block">
                Proposed Diff:
              </span>
              <pre className="text-[11px] text-secondary whitespace-pre-wrap">{diff}</pre>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Autonomous LLMs cannot approve their own mutations. Your explicit approval is required before changes are executed on disk.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-canvas border-t border-subtle flex items-center justify-end gap-2.5 select-none">
          <button
            onClick={() => resolveForgeApproval(false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-subtle bg-surface hover:bg-elevated text-secondary hover:text-main transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 text-muted" />
            <span>Deny & Cancel</span>
          </button>

          <button
            onClick={() => resolveForgeApproval(true)}
            className="flex items-center gap-1 px-4 py-1.5 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Authorize & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
