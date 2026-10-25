'use client';

import React, { useRef, useMemo, useState } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  GitCommit,
  SplitSquareVertical,
  BrainCircuit,
  Home,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { AgentWorkspace } from './AgentWorkspace';

export const CodeEditor: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    activeFile,
    openFile,
    closeTab,
    setActiveTabId,
    updateFileContent,
    saveActiveFile,
    applyProposedPatch,
    rejectProposedPatch,
  } = useForge();

  const { mode } = useRagnarok();
  const isDev = mode === 'developer';

  const [isApplying, setIsApplying] = useState(false);
  const [diffMode, setDiffMode] = useState<'diff' | 'editor'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Line count computation
  const lineCount = useMemo(() => {
    if (!activeFile) return 1;
    return activeFile.content.split('\n').length;
  }, [activeFile]);

  // Diff rendering lines
  const parsedDiffLines = useMemo(() => {
    if (!activeFile?.proposedPatch?.diff) return [];
    return activeFile.proposedPatch.diff.split('\n').map((line, idx) => {
      let type: 'add' | 'del' | 'meta' | 'ctx' = 'ctx';
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        type = 'meta';
      } else if (line.startsWith('+')) {
        type = 'add';
      } else if (line.startsWith('-')) {
        type = 'del';
      }
      return { id: idx, line, type };
    });
  }, [activeFile]);

  if (!activeFile) {
    return <AgentWorkspace onOpenFile={openFile} />;
  }

  const patch = activeFile.proposedPatch;

  return (
    <div className="flex-1 flex flex-col bg-forge-canvas overflow-hidden transition-colors duration-150">
      {/* Tab Strip */}
      <div className="h-9 bg-forge-canvas border-b border-forge flex items-center overflow-x-auto select-none shrink-0 no-scrollbar">
        {/* Pinned Tab */}
        <button
          type="button"
          onClick={() => setActiveTabId(null as unknown as string)}
          className="flex items-center gap-1.5 px-3 h-full border-r border-forge text-xs cursor-pointer transition-colors shrink-0 text-forge-muted hover:text-forge-primary hover:bg-forge-elevated"
          title={isDev ? 'Return to Agent Workspace' : 'Return to Home'}
        >
          {isDev ? (
            <BrainCircuit className="w-3.5 h-3.5 text-forge-accent" />
          ) : (
            <Home className="w-3.5 h-3.5 text-forge-accent" />
          )}
          <span>{isDev ? 'Agent' : 'Home'}</span>
        </button>

        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3 h-full border-r border-forge text-xs cursor-pointer transition-colors shrink-0 group ${
                isActive
                  ? 'bg-forge-panel text-forge-primary font-medium border-t-2 border-t-forge-accent'
                  : 'text-forge-muted hover:text-forge-secondary hover:bg-forge-hover'
              }`}
            >
              <span className="truncate max-w-[140px] font-mono text-[11px]">
                {tab.name}
              </span>

              {tab.proposedPatch && (
                <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-forge-accent/10 text-forge-accent border border-forge-accent/30">
                  DIFF
                </span>
              )}

              {tab.isDirty && !tab.proposedPatch && (
                <span className="w-2 h-2 rounded-full bg-forge-accent" title="Unsaved changes" />
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-forge-elevated text-forge-muted hover:text-forge-primary transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor Breadcrumbs & Save Action */}
      <div className="h-7 px-3 bg-forge-panel border-b border-forge flex items-center justify-between text-xs text-forge-muted font-mono shrink-0 select-none">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-forge-secondary">{activeFile.path}</span>
          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-forge-elevated border border-forge text-forge-muted">
            {activeFile.language}
          </span>
          <span className="text-[10px] text-forge-muted/70 hidden md:inline font-mono">
            • Buffer Editor • Dirty Tracking • In-line Diff Viewer
          </span>
          {activeFile.isDirty && (
            <span className="text-[10px] text-amber-500 font-medium">● Unsaved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {patch && (
            <button
              onClick={() => setDiffMode(diffMode === 'diff' ? 'editor' : 'diff')}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-forge-elevated border border-forge text-forge-primary hover:border-forge-strong transition-colors cursor-pointer"
            >
              <SplitSquareVertical className="w-3 h-3 text-forge-accent" />
              <span>{diffMode === 'diff' ? 'Show Code' : 'Review Diff'}</span>
            </button>
          )}

          <button
            onClick={() => saveActiveFile()}
            disabled={!activeFile.isDirty}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-forge-elevated border border-forge hover:border-forge-strong text-forge-primary disabled:opacity-30 transition-colors cursor-pointer"
            title="Save file (⌘S)"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Proposed Patch Review Banner (Approval Gating) */}
      {patch && (
        <div className="bg-forge-accent/5 border-b border-forge-accent/30 p-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-forge-accent shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-forge-primary">
                    {isDev ? 'Approval Required: Proposed Patch' : 'Review Suggested Changes'}
                  </h4>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold ${
                      patch.riskLevel === 'high'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        : patch.riskLevel === 'medium'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isDev ? `Risk: ${patch.riskLevel}` : `Priority: ${patch.riskLevel}`}
                  </span>
                </div>
                <p className="text-xs text-forge-secondary mt-0.5 leading-relaxed font-sans">
                  {patch.rationale}
                </p>
                <div className="text-[10px] text-forge-muted font-mono mt-1">
                  {isDev
                    ? `Approval ID: ${patch.approvalId} • No files are modified on disk until you explicitly approve.`
                    : 'No files are changed until you approve.'}
                </div>
              </div>
            </div>

            {/* Accept / Reject Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => rejectProposedPatch(activeFile.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-xs border border-forge bg-forge-canvas hover:bg-forge-elevated text-forge-secondary hover:text-forge-primary transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-forge-muted" />
                <span>{isDev ? 'Reject' : 'Dismiss'}</span>
              </button>

              <button
                onClick={async () => {
                  setIsApplying(true);
                  try {
                    await applyProposedPatch(activeFile.id);
                  } finally {
                    setIsApplying(false);
                  }
                }}
                disabled={isApplying}
                className="flex items-center gap-1 px-3 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isApplying ? 'Applying...' : isDev ? 'Approve & Apply' : 'Apply Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Diff Viewer OR Monospace Code Editor */}
      <div className="flex-1 flex overflow-hidden">
        {patch && diffMode === 'diff' ? (
          /* Visual Diff View */
          <div className="flex-1 overflow-y-auto font-mono text-xs p-4 bg-forge-canvas custom-scrollbar select-text">
            <div className="mb-2 text-[11px] text-forge-muted flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-[#cc785c]" />
              <span>Diff for {activeFile.path}</span>
            </div>
            <div className="border border-forge rounded-md overflow-hidden bg-forge-panel">
              {parsedDiffLines.map((d) => (
                <div
                  key={d.id}
                  className={`px-3 py-0.5 leading-5 font-mono text-[11px] whitespace-pre-wrap ${
                    d.type === 'add'
                      ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                      : d.type === 'del'
                      ? 'bg-rose-500/10 text-rose-400 border-l-2 border-rose-500'
                      : d.type === 'meta'
                      ? 'bg-blue-500/10 text-blue-400'
                      : 'text-forge-secondary'
                  }`}
                >
                  {d.line}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Real interactive text editor with line numbers */
          <div className="flex-1 flex overflow-hidden">
            {/* Line Numbers Gutter */}
            <div className="w-12 bg-forge-canvas border-r border-forge text-right py-3 pr-2.5 font-mono text-xs text-forge-muted/60 select-none overflow-hidden shrink-0">
              {Array.from({ length: lineCount }).map((_, idx) => (
                <div key={idx} className="leading-6 text-[11px]">
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Editor Area */}
            <textarea
              ref={textareaRef}
              value={activeFile.content}
              onChange={(e) => updateFileContent(activeFile.id, e.target.value)}
              className="flex-1 p-3 bg-forge-panel font-mono text-xs leading-6 text-forge-primary focus:outline-hidden resize-none overflow-y-auto custom-scrollbar select-text"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </div>
  );
};
