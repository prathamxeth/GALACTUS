'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';

export const ProblemsPanel: React.FC = () => {
  const { problems, clearProblems, openFile, diagnosticReport } = useForge();
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const filteredProblems = problems.filter((p) => {
    if (filter === 'all') return true;
    return p.severity === filter;
  });

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden text-xs select-text">
      {/* Problems Header */}
      <div className="h-8 px-3 bg-canvas border-b border-subtle flex items-center justify-between text-muted select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-main font-semibold text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Problems</span>
          </div>

          {/* Severity Filters */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'all'
                  ? 'bg-elevated text-main font-bold border border-subtle'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              All ({problems.length})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'error'
                  ? 'bg-rose-500/10 text-rose-500 font-bold border border-rose-500/30'
                  : 'text-muted hover:text-rose-400'
              }`}
            >
              Errors ({errorCount})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'warning'
                  ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30'
                  : 'text-muted hover:text-amber-400'
              }`}
            >
              Warnings ({warningCount})
            </button>

            {diagnosticReport && (
              <span className="text-[10px] font-mono text-muted pl-2 border-l border-subtle">
                Task: <code className="text-secondary">{diagnosticReport.task_id.slice(0, 10)}</code> ({diagnosticReport.observed_facts.length} observed)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={clearProblems}
          className="p-1 rounded text-muted hover:text-main hover:bg-elevated transition-colors"
          title="Clear all problems"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Problems List */}
      <div className="flex-1 p-2 overflow-y-auto space-y-1 custom-scrollbar">
        {filteredProblems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted py-8 select-none">
            <ShieldCheck className="w-8 h-8 text-emerald-500/80 mb-2" />
            <span className="text-secondary font-medium">No problems detected</span>
            <span className="text-[10px] text-muted mt-0.5">
              Workspace diagnostics, test errors, and build failures will appear here.
            </span>
          </div>
        ) : (
          filteredProblems.map((p) => (
            <div
              key={p.id}
              className={`p-2 rounded border transition-colors flex items-start justify-between gap-3 ${
                p.severity === 'error'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  : p.severity === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                  : 'bg-blue-500/5 border-blue-500/20 text-blue-400'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                {p.severity === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                )}
                {p.severity === 'warning' && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                )}
                {p.severity === 'info' && (
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-elevated border border-subtle text-secondary font-bold">
                      {p.source}
                    </span>
                    <span className="text-[11px] font-mono text-main leading-tight break-words">
                      {p.message}
                    </span>
                  </div>

                  {p.suggestedAction && (
                    <div className="text-[10px] text-muted italic">
                      Suggestion: {p.suggestedAction}
                    </div>
                  )}
                </div>
              </div>

              {p.filePath && (
                <button
                  onClick={() => openFile(p.filePath!)}
                  className="flex items-center gap-1 text-[10px] font-mono text-muted hover:text-main px-1.5 py-0.5 rounded bg-elevated border border-subtle shrink-0"
                  title={`Open ${p.filePath}`}
                >
                  <span className="truncate max-w-[120px]">{p.filePath.split('/').pop()}</span>
                  {p.line && <span>:{p.line}</span>}
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
