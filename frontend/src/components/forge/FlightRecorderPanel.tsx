'use client';

import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export const FlightRecorderPanel: React.FC = () => {
  const {
    flightEvents,
    checkpoints,
    isLoadingFlightRecorder,
    refreshFlightRecorder,
    createHealthyCheckpoint,
    whatChanged,
    analyzeWhatChanged,
    openFile,
    diagnosticEvents,
    diagnosticReport,
    sseStreamStatus,
  } = useForge();

  const { isBackendOnline, probeBackend, mode } = useRagnarok();
  const isDev = mode === 'developer';

  const [activeSubTab, setActiveSubTab] = useState<'events' | 'checkpoints' | 'whatChanged'>('events');
  const [filterType, setFilterType] = useState<'all' | 'observed' | 'hypothesis' | 'repair' | 'verification'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Distinguish observation vs hypothesis vs repair vs verification
  const isHypothesisEvent = (ev: { summary: string; type: string; provenance: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('hypothesis') || s.includes('inferred') || s.includes('llm_') || s.includes('reasoning');
  };

  const isVerificationEvent = (ev: { summary: string; type: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('verif') || s.includes('test_passed') || s.includes('test_failed') || s.includes('exit code');
  };

  const isRepairEvent = (ev: { summary: string; type: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('repair') || s.includes('patch') || s.includes('approval');
  };

  const filteredEvents = flightEvents.filter((ev) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = ev.summary.toLowerCase().includes(q) ||
        ev.type.toLowerCase().includes(q) ||
        (ev.evidence?.outputExcerpt || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filterType === 'all') return true;
    if (filterType === 'hypothesis') return isHypothesisEvent(ev);
    if (filterType === 'verification') return isVerificationEvent(ev);
    if (filterType === 'repair') return isRepairEvent(ev);
    if (filterType === 'observed') return !isHypothesisEvent(ev) && !isRepairEvent(ev);
    return true;
  });

  const handleRunWhatChanged = async () => {
    setIsAnalyzing(true);
    setActiveSubTab('whatChanged');
    try {
      await analyzeWhatChanged();
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-forge-canvas overflow-hidden text-xs select-text transition-colors duration-150">
      {/* Flight Recorder Header */}
      <div className="h-8 px-3 bg-forge-canvas border-b border-forge flex items-center justify-between text-forge-muted select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-forge-primary font-semibold text-[11px]">
            <History className="w-3.5 h-3.5 text-forge-accent" />
            <span>{isDev ? 'Project Flight Recorder' : 'Activity History'}</span>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1 font-mono tabular-nums text-[10px]">
            <button
              onClick={() => setActiveSubTab('events')}
              className={`px-2 py-0.5 rounded transition-colors select-none active:translate-y-px cursor-pointer ${
                activeSubTab === 'events'
                  ? 'bg-forge-elevated text-forge-primary font-bold border border-forge'
                  : 'text-forge-muted hover:text-forge-secondary'
              }`}
            >
              Timeline ({flightEvents.length})
            </button>
            <button
              onClick={() => setActiveSubTab('checkpoints')}
              className={`px-2 py-0.5 rounded transition-colors select-none active:translate-y-px cursor-pointer ${
                activeSubTab === 'checkpoints'
                  ? 'bg-forge-elevated text-forge-primary font-bold border border-forge'
                  : 'text-forge-muted hover:text-forge-secondary'
              }`}
            >
              {isDev ? `Checkpoints (${checkpoints.length})` : `Saved Points (${checkpoints.length})`}
            </button>
            <button
              onClick={() => setActiveSubTab('whatChanged')}
              className={`px-2 py-0.5 rounded transition-colors select-none active:translate-y-px cursor-pointer ${
                activeSubTab === 'whatChanged'
                  ? 'bg-forge-accent/10 text-forge-accent font-bold border border-forge-accent/30'
                  : 'text-forge-muted hover:text-forge-accent'
              }`}
            >
              {isDev ? 'What Changed?' : 'Recent Changes'}
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Truthful SSE Stream Lifecycle State (Dev Mode Only) */}
          {isDev && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-forge-panel border border-forge text-[10px] font-mono tabular-nums">
              {sseStreamStatus === 'connected' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-forge-secondary font-medium">
                    SSE: Connected {diagnosticEvents.length > 0 ? `(${diagnosticEvents.length} events)` : '(live)'}
                  </span>
                  {diagnosticReport && (
                    <span className="text-forge-muted ml-0.5">[{diagnosticReport.task_id.slice(0, 8)}]</span>
                  )}
                </>
              ) : sseStreamStatus === 'connecting' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-sky-400">SSE: Connecting...</span>
                </>
              ) : sseStreamStatus === 'reconnecting' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-400">SSE: Reconnecting...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  <span className="text-forge-muted">SSE: Disconnected</span>
                  {isBackendOnline && (
                    <button
                      onClick={() => probeBackend()}
                      className="text-forge-accent hover:underline ml-1 cursor-pointer"
                    >
                      Reconnect
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={handleRunWhatChanged}
            disabled={isAnalyzing}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-forge-accent/10 text-forge-accent border border-forge-accent/30 hover:bg-forge-accent/20 transition-colors disabled:opacity-40 cursor-pointer"
            title="Compare current repository state with last checkpoint"
          >
            <RotateCcw className={`w-2.5 h-2.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isDev ? 'Analyze What Changed' : 'View Changes'}</span>
          </button>

          <button
            onClick={() => createHealthyCheckpoint('Manual Flight Checkpoint')}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-forge-elevated border border-forge hover:border-emerald-500/50 hover:text-emerald-500 text-forge-secondary transition-colors cursor-pointer"
            title="Save verified point"
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>{isDev ? 'Take Checkpoint' : 'Save Point'}</span>
          </button>

          <button
            onClick={refreshFlightRecorder}
            className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingFlightRecorder ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub Tab: Timeline Events */}
      {activeSubTab === 'events' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Filter Bar */}
          <div className="h-7 px-3 bg-forge-canvas/80 border-b border-forge flex items-center justify-between text-[10px] font-mono select-none shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-forge-muted mr-1">Filter:</span>
              {(isDev
                ? (['all', 'observed', 'hypothesis', 'repair', 'verification'] as const)
                : (['all', 'repair', 'verification'] as const)
              ).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterType(filter as typeof filterType)}
                  className={`px-1.5 py-0.2 rounded uppercase font-bold transition-colors cursor-pointer ${
                    filterType === filter
                      ? 'bg-forge-elevated text-forge-primary border border-forge'
                      : 'text-forge-muted hover:text-forge-secondary'
                  }`}
                >
                  {filter === 'repair' && !isDev ? 'changes' : filter}
                </button>
              ))}
            </div>

            {/* Quick Search */}
            <div className="flex items-center gap-1 bg-forge-panel border border-forge rounded px-1.5 py-0.5 w-44">
              <Search className="w-2.5 h-2.5 text-forge-muted shrink-0" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[10px] font-mono text-forge-primary placeholder:text-forge-muted focus:outline-hidden"
              />
            </div>
          </div>

          {/* Chronological Event Stream */}
          <div className="flex-1 p-2 overflow-y-auto space-y-1.5 custom-scrollbar">
            {filteredEvents.length === 0 ? (
              <div className="text-center text-muted py-8 select-none">
                <Clock className="w-6 h-6 text-muted/60 mx-auto mb-1.5" />
                <span>No flight recorder events found matching filter.</span>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isHypothesis = isHypothesisEvent(ev);
                const isVerification = isVerificationEvent(ev);
                const isRepair = isRepairEvent(ev);

                return (
                  <div
                    key={ev.id}
                    className={`p-2.5 rounded-md border flex items-start justify-between gap-3 font-mono text-[11px] transition-colors ${
                      isHypothesis
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : isVerification && ev.healthyState === false
                        ? 'bg-rose-500/5 border-rose-500/20'
                        : isVerification && ev.healthyState === true
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : isRepair
                        ? 'bg-purple-500/5 border-purple-500/20'
                        : 'bg-canvas/50 border-subtle'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {/* Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isHypothesis ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : ev.healthyState === true ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : ev.healthyState === false ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-muted" />
                        )}
                      </div>

                      {/* Event Details */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Distinct Badge: Observation vs Hypothesis */}
                          {isHypothesis ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                              [HYPOTHESIS]
                            </span>
                          ) : isVerification ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                              [VERIFICATION]
                            </span>
                          ) : isRepair ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                              [REPAIR]
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              [OBSERVED]
                            </span>
                          )}

                          <span className="px-1 py-0.2 rounded text-[9px] uppercase font-bold bg-elevated border border-subtle text-secondary">
                            {ev.type}
                          </span>

                          <span className="text-main font-medium truncate max-w-md">
                            {ev.summary}
                          </span>
                        </div>

                        {/* Evidence References and Output Snippets */}
                        {ev.evidence?.outputExcerpt && (
                          <div className="text-[10px] text-muted truncate max-w-lg bg-surface/70 p-1.5 rounded border border-subtle">
                            {ev.evidence.outputExcerpt}
                          </div>
                        )}

                        {ev.evidence?.affectedPath && (
                          <button
                            onClick={() => openFile(ev.evidence!.affectedPath!)}
                            className="text-[10px] text-[#cc785c] hover:underline"
                          >
                            Affected File: {ev.evidence.affectedPath}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata: Timestamp & Provenance */}
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="text-[10px] text-muted">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </div>
                      <span className="text-[9px] uppercase px-1 rounded bg-elevated text-muted">
                        src: {ev.provenance}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Sub Tab: Checkpoints List */}
      {activeSubTab === 'checkpoints' && (
        <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
          {checkpoints.length === 0 ? (
            <div className="text-center text-muted py-8">
              No checkpoints recorded yet. Click &quot;Take Checkpoint&quot; to save a verified healthy snapshot.
            </div>
          ) : (
            checkpoints.map((chk) => (
              <div
                key={chk.id}
                className="p-3 rounded-lg border border-subtle bg-canvas space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Boolean(chk.isHealthy && chk.evidenceSnapshot?.testsExitCode === 0 && (!chk.testResults || chk.testResults.failed === 0)) ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <span className="font-semibold text-main text-xs">{chk.title}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        Boolean(chk.isHealthy && chk.evidenceSnapshot?.testsExitCode === 0 && (!chk.testResults || chk.testResults.failed === 0))
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {Boolean(chk.isHealthy && chk.evidenceSnapshot?.testsExitCode === 0 && (!chk.testResults || chk.testResults.failed === 0))
                        ? 'VERIFIED HEALTHY'
                        : chk.evidenceSnapshot?.testsExitCode !== undefined
                        ? `TESTS FAILED (EXIT ${chk.evidenceSnapshot.testsExitCode})`
                        : 'UNVERIFIED / NO EVIDENCE'}
                    </span>
                  </div>

                  <span className="text-[10px] text-muted font-mono">
                    {new Date(chk.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono text-muted">
                  <span>Commit: <code className="text-secondary">{chk.gitCommit.slice(0, 7)}</code></span>
                  <span>Branch: <code className="text-secondary">{chk.gitBranch}</code></span>
                  {chk.testResults && (
                    <span>
                      Tests: <span className="text-emerald-500">{chk.testResults.passed} passed</span> / {chk.testResults.total} total
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sub Tab: What Changed Since Last Passing Build? */}
      {activeSubTab === 'whatChanged' && (
        <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
          {isAnalyzing ? (
            <div className="flex items-center justify-center h-48 text-muted">
              <span className="w-2 h-2 rounded-full bg-[#F04424] animate-ping mr-2" />
              <span>Analyzing Git diff, test outcomes, and dependency fingerprints...</span>
            </div>
          ) : !whatChanged ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted text-center">
              <RotateCcw className="w-8 h-8 text-[#F04424]/60 mb-2" />
              <div className="font-semibold text-main text-xs">No analysis run yet</div>
              <p className="text-[11px] text-muted max-w-sm mt-1">
                Click &quot;Analyze What Changed&quot; to inspect Git changes, modified dependencies, and failing tests against the last verified passing checkpoint.
              </p>
              <button
                onClick={handleRunWhatChanged}
                className="mt-3 px-3 py-1 rounded bg-[#F04424] text-white text-xs font-medium hover:bg-[#F04424]/90 transition-colors"
              >
                Run What Changed Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {whatChanged.lastPassingCheckpoint ? (
                <div className="p-3 rounded-lg border border-subtle bg-canvas space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="font-semibold text-main text-xs">
                        Baseline Checkpoint: {whatChanged.lastPassingCheckpoint.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted font-mono">
                      {new Date(whatChanged.lastPassingCheckpoint.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-muted">
                    Commit: <code className="text-secondary">{whatChanged.lastPassingCheckpoint.gitCommit.slice(0, 7)}</code>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-subtle bg-canvas text-muted text-xs">
                  No prior passing checkpoint found in repository history.
                </div>
              )}

              {/* Correlation Analysis */}
              {whatChanged.correlationAnalysis && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/30 text-xs space-y-1">
                  <div className="font-semibold text-amber-500">Hypothesis / Correlation Analysis:</div>
                  <p className="text-secondary font-sans leading-relaxed">{whatChanged.correlationAnalysis}</p>
                </div>
              )}

              {/* Modified Files */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-muted">Modified Files ({whatChanged.differences.modifiedFiles.length}):</span>
                <div className="space-y-1">
                  {whatChanged.differences.modifiedFiles.map((filePath, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-canvas border border-subtle flex items-center justify-between font-mono text-[11px]"
                    >
                      <button
                        onClick={() => openFile(filePath)}
                        className="text-main hover:underline text-left truncate"
                      >
                        {filePath}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
