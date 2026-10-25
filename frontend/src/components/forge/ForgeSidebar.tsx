'use client';

import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  Plus,
  Search,
  GitBranch,
  FileCode,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FileExplorer } from './FileExplorer';
import { FlightRecorderPanel } from './FlightRecorderPanel';
import { EnvironmentInspectorPanel } from './EnvironmentInspectorPanel';

export const ForgeSidebar: React.FC = () => {
  const {
    activeLeftTab,
    setActiveTabId,
    diagnosticReport,
    diagnosticStatus,
    startProjectDiagnostics,
    clearDiagnosticSession,
    agentSessions,
    openFile,
    preflightReport,
    problems,
    fileTree,
  } = useForge();

  const { mode } = useRagnarok();
  const isDev = mode === 'developer';

  const [searchQuery, setSearchQuery] = useState('');

  // Flat list of files for quick workspace search
  const flatFiles = useMemo(() => {
    const list: string[] = [];
    const traverse = (entries: typeof fileTree) => {
      for (const entry of entries) {
        if (entry.type === 'file') {
          list.push(entry.path);
        } else if (entry.children) {
          traverse(entry.children);
        }
      }
    };
    traverse(fileTree);
    return list;
  }, [fileTree]);

  // Filtered search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return flatFiles.filter((path) => path.toLowerCase().includes(q)).slice(0, 20);
  }, [flatFiles, searchQuery]);

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  return (
    <div className="w-64 border-r border-forge bg-forge-panel flex flex-col h-full shrink-0 select-none overflow-hidden transition-colors duration-150">
      {/* =====================================================================
          1. DRAWER: AGENT SESSIONS
          ===================================================================== */}
      {activeLeftTab === 'agent' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-9 px-3 border-b border-forge bg-forge-canvas flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-[11px] font-bold tracking-wider text-forge-secondary uppercase flex items-center gap-1.5">
              <BrainCircuit className="w-3.5 h-3.5 text-forge-accent" />
              <span>{isDev ? 'Agent Sessions' : 'Recent Work'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearDiagnosticSession();
                setActiveTabId(null as unknown as string);
              }}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-forge-elevated hover:bg-forge-hover text-forge-primary border border-forge hover:border-forge-accent/40 transition-colors flex items-center gap-1 cursor-pointer"
              title="Start a new request"
            >
              <Plus className="w-3 h-3 text-forge-accent" />
              <span>{isDev ? 'New Task' : 'New Request'}</span>
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar font-sans text-xs">
            {/* Active Session Card */}
            {diagnosticReport ? (
              <div
                onClick={() => setActiveTabId(null as unknown as string)}
                className="p-3 rounded-xl border border-forge-accent/40 bg-forge-elevated space-y-2 cursor-pointer hover:border-forge-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-forge-accent">
                    <span className="w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse" />
                    <span>{isDev ? 'ACTIVE SESSION' : 'IN PROGRESS'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-forge-muted">
                    {isDev ? diagnosticStatus : 'Working'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-forge-primary line-clamp-2">
                  {diagnosticReport.user_request || (isDev ? 'Diagnostic & Verified Repair' : 'Working on request...')}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-forge-secondary">
                  <span>{isDev ? `${diagnosticReport.observed_facts?.length || 0} facts collected` : 'Active request'}</span>
                  <ArrowRight className="w-3 h-3 text-forge-accent" />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-dashed border-forge text-center space-y-2 my-2">
                <span className="text-xs text-forge-muted block">
                  {isDev ? 'No active task running' : 'Ready to start'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTabId(null as unknown as string)}
                  className="px-2.5 py-1 rounded text-xs font-mono font-medium text-forge-accent bg-forge-accent/10 hover:bg-forge-accent/20 border border-forge-accent/30 transition-colors cursor-pointer"
                >
                  {isDev ? 'Open Composer' : 'New Request'}
                </button>
              </div>
            )}

            {/* Recent Sessions History */}
            {agentSessions.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-forge-muted px-1 block">
                  {isDev ? 'Recent Tasks' : 'Recent History'}
                </span>
                {agentSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setActiveTabId(null as unknown as string)}
                    className="p-2.5 rounded-lg border border-forge bg-forge-canvas hover:bg-forge-elevated hover:border-forge-strong transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-forge-secondary truncate max-w-[130px]">
                        {isDev ? `task: ${session.id.slice(0, 10)}` : 'Completed Request'}
                      </span>
                      <span className="text-emerald-400 font-bold">{session.status}</span>
                    </div>
                    <div className="text-xs text-forge-primary font-medium line-clamp-1">
                      {session.goal}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. DRAWER: FILE EXPLORER
          ===================================================================== */}
      {activeLeftTab === 'explorer' && <FileExplorer />}

      {/* =====================================================================
          3. DRAWER: WORKSPACE SEARCH (Dev Mode)
          ===================================================================== */}
      {activeLeftTab === 'search' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="h-9 px-3 border-b border-forge bg-forge-canvas flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-[11px] font-bold tracking-wider text-forge-secondary uppercase flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#cc785c]" />
              <span>Search Workspace</span>
            </span>
          </div>

          <div className="p-3 space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-forge-muted absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by file name or path..."
                className="w-full bg-forge-canvas border border-forge focus:border-forge-accent rounded-lg pl-8 pr-3 py-1.5 text-xs text-forge-primary placeholder:text-forge-muted font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar">
              {searchQuery.trim() === '' ? (
                <div className="text-[11px] text-forge-muted font-mono text-center py-6">
                  Type a query to search files across the workspace.
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-[11px] text-forge-muted font-mono text-center py-6">
                  No matching files found.
                </div>
              ) : (
                searchResults.map((filePath) => (
                  <button
                    key={filePath}
                    type="button"
                    onClick={() => openFile(filePath)}
                    className="w-full text-left p-2 rounded-lg hover:bg-forge-elevated border border-transparent hover:border-forge text-xs font-mono transition-colors flex items-center gap-2 group cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-forge-accent shrink-0" />
                    <span className="truncate text-forge-secondary group-hover:text-forge-primary">
                      {filePath}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. DRAWER: SOURCE CONTROL (GIT) (Dev Mode)
          ===================================================================== */}
      {activeLeftTab === 'git' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="h-9 px-3 border-b border-forge bg-forge-canvas flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-[11px] font-bold tracking-wider text-forge-secondary uppercase flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Source Control</span>
            </span>
            {preflightReport?.git && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {preflightReport.git.branch}
              </span>
            )}
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-2.5 rounded-lg bg-forge-canvas border border-forge space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-forge-muted">Commit:</span>
                <span className="text-forge-primary">{preflightReport?.git?.commit?.slice(0, 7) || 'HEAD'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-forge-muted">Working tree:</span>
                <span className={preflightReport?.git?.isClean ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                  {preflightReport?.git?.isClean ? 'Clean' : 'Modified'}
                </span>
              </div>
            </div>

            {/* Changed Files */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-forge-muted px-1 block">
                Changes ({preflightReport?.git?.modifiedCount || 0})
              </span>
              {preflightReport?.git?.modifiedFiles && preflightReport.git.modifiedFiles.length > 0 ? (
                preflightReport.git.modifiedFiles.map((file) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => openFile(file)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-forge-elevated text-xs font-mono transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate text-forge-secondary group-hover:text-forge-primary max-w-[190px]">
                      {file}
                    </span>
                    <span className="text-[10px] font-bold text-amber-400 font-mono">M</span>
                  </button>
                ))
              ) : (
                <div className="text-[11px] text-forge-muted font-mono text-center py-4">
                  Working tree clean. No uncommitted modifications.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. DRAWER: DIAGNOSTICS & PROBLEMS (Dev Mode)
          ===================================================================== */}
      {activeLeftTab === 'problems' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="h-9 px-3 border-b border-forge bg-forge-canvas flex items-center justify-between text-xs shrink-0">
            <span className="font-mono text-[11px] font-bold tracking-wider text-forge-secondary uppercase flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Diagnostics ({errorCount + warningCount})</span>
            </span>
            <button
              type="button"
              onClick={() => startProjectDiagnostics('.', 'Investigate build and lint problems')}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-forge-accent bg-forge-accent/10 hover:bg-forge-accent/20 border border-forge-accent/30 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Scan</span>
            </button>
          </div>

          <div className="p-2 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            {problems.length === 0 ? (
              <div className="text-center py-8 space-y-1 font-mono text-xs">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <span className="text-forge-primary font-semibold block">0 Problems Detected</span>
                <span className="text-forge-muted text-[10px] block">No syntax or build diagnostics reported.</span>
              </div>
            ) : (
              problems.map((p) => (
                <div
                  key={p.id}
                  onClick={() => p.filePath && openFile(p.filePath)}
                  className="p-2 rounded-lg bg-forge-canvas border border-forge hover:border-forge-strong transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    {p.severity === 'error' ? (
                      <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                    <span className="font-mono text-[11px] font-medium text-forge-primary truncate">
                      {p.message}
                    </span>
                  </div>
                  {p.filePath && (
                    <div className="text-[10px] font-mono text-forge-muted truncate pl-4.5">
                      {p.filePath}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          6. DRAWER: FLIGHT RECORDER & SENTINEL
          ===================================================================== */}
      {activeLeftTab === 'flight' && <FlightRecorderPanel />}

      {/* =====================================================================
          7. DRAWER: ENVIRONMENT INSPECTOR (Only accessible explicitly in Dev Mode)
          ===================================================================== */}
      {activeLeftTab === 'inspector' && <EnvironmentInspectorPanel />}
    </div>
  );
};
