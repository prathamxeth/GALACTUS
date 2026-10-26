'use client';

import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Play,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  FileCode,
  Flame,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { MemoryRecord } from '@/lib/api/types';
import { api } from '@/lib/api/client';

export const ForgeCompanion: React.FC = () => {
  const {
    openFile,
    diagnosticReport,
    diagnosticStatus,
    isDiagnosticLoading,
    diagnosticError,
    projectConnected,
    connectedProjectRoot,
    setConnectedProjectRoot,
    startProjectDiagnostics,
    resolveDiagnosticRepair,
    recoverDiagnosticProject,
    preflightReport,
    flightEvents,
  } = useForge();

  const {
    memories,
    isBackendOnline,
    probeBackend,
  } = useRagnarok();

  const [activeTab, setActiveTab] = useState<'diagnostics' | 'flight' | 'memory'>('diagnostics');
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [flightSearchQuery, setFlightSearchQuery] = useState('');
  const [userRequestInput, setUserRequestInput] = useState('Find why build/test fails');
  const [projectRootInput, setProjectRootInput] = useState('.');
  const [showDiffPreview, setShowDiffPreview] = useState(true);
  const [isResolvingRepair, setIsResolvingRepair] = useState(false);

  // If a diagnostic report arrives, ensure user sees it
  useEffect(() => {
    if (diagnosticReport) {
      const timer = setTimeout(() => {
        setActiveTab('diagnostics');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [diagnosticReport]);

  const handleStartDiagnostics = async () => {
    if (isDiagnosticLoading) return;
    await startProjectDiagnostics(projectRootInput || connectedProjectRoot || '.', userRequestInput);
  };

  const handleApproveRepair = async () => {
    if (!diagnosticReport?.proposed_repair) return;
    const approvalId = diagnosticReport.proposed_repair.approval_id || diagnosticReport.proposed_repair.proposal_id;
    setIsResolvingRepair(true);
    try {
      await resolveDiagnosticRepair(approvalId, 'approved');
    } finally {
      setIsResolvingRepair(false);
    }
  };

  const handleRejectRepair = async () => {
    if (!diagnosticReport?.proposed_repair) return;
    const approvalId = diagnosticReport.proposed_repair.approval_id || diagnosticReport.proposed_repair.proposal_id;
    setIsResolvingRepair(true);
    try {
      await resolveDiagnosticRepair(approvalId, 'rejected');
    } finally {
      setIsResolvingRepair(false);
    }
  };

  const getMemoryContent = (m: MemoryRecord): string => {
    if (m.type === 'episodic') {
      return m.content || m.title || 'Episodic event';
    }
    return `${m.subject}: ${m.statement}`;
  };

  const filteredMemories = memories.filter((m) => {
    if (!memorySearchQuery.trim()) return true;
    const q = memorySearchQuery.toLowerCase();
    const content = getMemoryContent(m);
    return content.toLowerCase().includes(q) || (m.type || '').toLowerCase().includes(q);
  });

  return (
    <aside className="w-88 border-l border-subtle bg-surface flex flex-col h-full select-text shrink-0 text-xs">
      {/* Companion Header */}
      <div className="h-11 px-3 border-b border-subtle flex items-center justify-between bg-canvas shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[#F04424]/10 border border-[#F04424]/30 flex items-center justify-center text-[#F04424]">
            <BrainCircuit className="w-3 h-3" />
          </div>
          <div>
            <div className="font-semibold text-main text-xs flex items-center gap-1.5">
              <span>MEMORAG Companion</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
                title={isBackendOnline ? 'Backend Online' : 'Backend Disconnected'}
              />
            </div>
            <div className="text-[10px] text-muted font-mono truncate">
              {isBackendOnline
                ? (preflightReport?.backend.url?.replace(/^https?:\/\//, '') || api.getBaseUrl().replace(/^https?:\/\//, ''))
                : 'Offline / Unreachable'}
            </div>
          </div>
        </div>

        {/* Tab Switcher: Diagnostics vs Flight vs Memory */}
        <div className="flex items-center p-0.5 rounded bg-surface border border-subtle text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'diagnostics'
                ? 'bg-elevated font-medium text-main shadow-xs'
                : 'text-muted hover:text-main'
            }`}
          >
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('flight')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'flight'
                ? 'bg-elevated font-medium text-main shadow-xs'
                : 'text-muted hover:text-main'
            }`}
          >
            Flight ({flightEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'memory'
                ? 'bg-elevated font-medium text-main shadow-xs'
                : 'text-muted hover:text-main'
            }`}
          >
            Mimir ({memories.length})
          </button>
        </div>
      </div>

      {/* Tab 0: Real Backend Diagnostics & Transparent Repair */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls Strip: Project Root & Trigger */}
          <div className="p-3 border-b border-subtle bg-canvas space-y-2 shrink-0">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted">
              <span>Diagnostic Target:</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                  diagnosticStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : diagnosticStatus === 'FAILED'
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                    : diagnosticStatus === 'INSPECTING'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse'
                    : 'bg-elevated text-secondary border border-subtle'
                }`}
              >
                {diagnosticStatus}
              </span>
            </div>

            <div className="space-y-1.5">
              <input
                type="text"
                value={projectRootInput}
                onChange={(e) => {
                  setProjectRootInput(e.target.value);
                  setConnectedProjectRoot(e.target.value);
                }}
                placeholder="Project root path (e.g. .)"
                className="w-full bg-surface border border-subtle rounded px-2.5 py-1 text-xs font-mono text-main placeholder:text-muted focus:outline-hidden"
              />
              <input
                type="text"
                value={userRequestInput}
                onChange={(e) => setUserRequestInput(e.target.value)}
                placeholder="User request (e.g. Find why build/test fails)"
                className="w-full bg-surface border border-subtle rounded px-2.5 py-1 text-xs font-sans text-main placeholder:text-muted focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleStartDiagnostics}
                disabled={isDiagnosticLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#F04424] hover:bg-[#F04424]/90 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                {isDiagnosticLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Project...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Project Diagnosis</span>
                  </>
                )}
              </button>

              {!projectConnected && (
                <button
                  onClick={() => probeBackend()}
                  className="px-2.5 py-1.5 rounded bg-elevated border border-subtle hover:border-strong text-muted hover:text-main text-[11px] font-mono transition-colors"
                  title="Retry backend connection probe"
                >
                  Retry
                </button>
              )}
            </div>

            {/* Offline or Error Banner */}
            {!projectConnected && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Backend at {preflightReport?.backend.url?.replace(/^https?:\/\//, '') || api.getBaseUrl().replace(/^https?:\/\//, '')} unreachable. Project not connected.</span>
              </div>
            )}

            {diagnosticError && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-words">{diagnosticError}</span>
              </div>
            )}
          </div>

          {/* Diagnostic Report Content */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
            {!diagnosticReport ? (
              <div className="text-center text-muted py-10 select-none space-y-2">
                <Flame className="w-8 h-8 text-[#F04424]/60 mx-auto" />
                <div className="font-semibold text-main text-xs">No Active Diagnostic Report</div>
                <p className="text-[11px] text-muted max-w-xs mx-auto">
                  Click &quot;Run Project Diagnosis&quot; to probe local toolchains, test outputs, Git diffs, and generate transparent repair proposals.
                </p>
              </div>
            ) : (
              <>
                {/* 1. Observed Facts (Verified Evidence) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-main flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Observed Facts & Evidence ({diagnosticReport.observed_facts.length})
                    </span>
                    <span className="text-[9px] font-mono text-muted uppercase">Verified</span>
                  </div>

                  {diagnosticReport.observed_facts.length === 0 ? (
                    <div className="p-2 rounded bg-canvas border border-subtle text-muted text-[11px]">
                      No failures observed in workspace inspection.
                    </div>
                  ) : (
                    diagnosticReport.observed_facts.map((fact) => (
                      <div
                        key={fact.finding_id}
                        className="p-2.5 rounded-lg bg-canvas border border-subtle space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase">
                            [OBSERVED FACT]
                          </span>
                          <span className="text-muted">{fact.source_type}</span>
                        </div>

                        <p className="text-secondary font-medium text-xs leading-tight">
                          {fact.summary}
                        </p>

                        {fact.evidence_refs && fact.evidence_refs.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {fact.evidence_refs.map((ref, idx) => (
                              <button
                                key={idx}
                                onClick={() => openFile(ref)}
                                className="flex items-center gap-1 text-[10px] font-mono text-muted hover:text-main px-1.5 py-0.2 rounded bg-surface border border-subtle"
                              >
                                <span>{ref}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* 2. Inferred Cause (Hypothesis - Visually Distinct) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-amber-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Inferred Cause (Hypothesis)
                    </span>
                    <span className="text-[9px] font-mono text-amber-500 uppercase">Unverified Reasoning</span>
                  </div>

                  {diagnosticReport.hypotheses.length === 0 ? (
                    <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20 text-muted text-[11px]">
                      No hypothesis inferred yet.
                    </div>
                  ) : (
                    diagnosticReport.hypotheses.map((hyp) => (
                      <div
                        key={hyp.finding_id}
                        className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/30 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold uppercase">
                            [HYPOTHESIS]
                          </span>
                          <span className="text-amber-500 font-bold">
                            {Math.round(hyp.confidence * 100)}% Confidence
                          </span>
                        </div>

                        <p className="text-secondary font-medium leading-relaxed font-sans">
                          {hyp.summary}
                        </p>

                        <div className="text-[10px] text-muted italic border-t border-amber-500/20 pt-1">
                          Inferred by on-device LLM reasoning. This cause is treated as an unverified hypothesis until approved and verified.
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Proposed Repair (Approval-Gated) */}
                {diagnosticReport.proposed_repair && (
                  <div className="space-y-2 pt-1 border-t border-subtle">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-main flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#F04424]" />
                        Proposed Repair
                      </span>
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold ${
                          diagnosticReport.proposed_repair.risk_level === 'high' || diagnosticReport.proposed_repair.risk_level === 'critical'
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                            : diagnosticReport.proposed_repair.risk_level === 'medium'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        }`}
                      >
                        Risk: {diagnosticReport.proposed_repair.risk_level}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-canvas border border-subtle space-y-2">
                      <h4 className="font-semibold text-main text-xs">
                        {diagnosticReport.proposed_repair.summary}
                      </h4>
                      <p className="text-secondary text-xs leading-relaxed font-sans">
                        {diagnosticReport.proposed_repair.explanation}
                      </p>

                      {/* Affected Files */}
                      {diagnosticReport.proposed_repair.files_to_modify && diagnosticReport.proposed_repair.files_to_modify.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-mono text-muted uppercase">Affected Files:</span>
                          <div className="flex flex-wrap gap-1">
                            {diagnosticReport.proposed_repair.files_to_modify.map((file, idx) => (
                              <button
                                key={idx}
                                onClick={() => openFile(file)}
                                className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-subtle text-main hover:border-strong transition-colors"
                              >
                                <FileCode className="w-3 h-3 text-[#cc785c]" />
                                <span>{file}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Verification Commands Required */}
                      {diagnosticReport.proposed_repair.expected_verification_commands && diagnosticReport.proposed_repair.expected_verification_commands.length > 0 && (
                        <div className="text-[10px] font-mono text-muted space-y-0.5 pt-1">
                          <span className="uppercase">Verification Commands:</span>
                          <div className="bg-surface p-1.5 rounded border border-subtle text-secondary">
                            {diagnosticReport.proposed_repair.expected_verification_commands.join(' && ')}
                          </div>
                        </div>
                      )}

                      {/* Diff Toggle */}
                      {diagnosticReport.proposed_repair.exact_patch && (
                        <div className="space-y-1 pt-1">
                          <button
                            onClick={() => setShowDiffPreview(!showDiffPreview)}
                            className="text-[10px] font-mono text-[#F04424] hover:underline"
                          >
                            {showDiffPreview ? 'Hide Proposed Diff' : 'View Proposed Diff'}
                          </button>
                          {showDiffPreview && (
                            <pre className="p-2 rounded bg-surface border border-subtle font-mono text-[10px] text-secondary overflow-x-auto max-h-40 whitespace-pre">
                              {diagnosticReport.proposed_repair.exact_patch}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Approval Actions */}
                      {diagnosticReport.status === 'AWAITING_APPROVAL' || diagnosticReport.proposed_repair.status === 'PENDING_APPROVAL' ? (
                        <div className="flex items-center gap-2 pt-2 border-t border-subtle">
                          <button
                            onClick={handleRejectRepair}
                            disabled={isResolvingRepair}
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-surface border border-subtle hover:bg-elevated text-secondary text-xs transition-colors disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5 text-muted" />
                            <span>Reject Repair</span>
                          </button>

                          <button
                            onClick={handleApproveRepair}
                            disabled={isResolvingRepair}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isResolvingRepair ? 'Executing...' : 'Approve & Apply'}</span>
                          </button>
                        </div>
                      ) : diagnosticReport.proposed_repair.status === 'REJECTED' ? (
                        <div className="p-2 rounded bg-elevated border border-subtle text-muted text-[11px] text-center font-mono">
                          Repair was explicitly REJECTED. Project files left untouched.
                        </div>
                      ) : (
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] text-center font-mono font-medium">
                          Repair status: {diagnosticReport.proposed_repair.status}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Truthful Verification Results */}
                {diagnosticReport.verification_results && (
                  <div className="space-y-1.5 pt-2 border-t border-subtle">
                    <span className="text-[10px] uppercase font-mono font-bold text-main">
                      Verification Outcome
                    </span>

                    <div
                      className={`p-3 rounded-lg border space-y-2 ${
                        diagnosticReport.verification_results.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          {diagnosticReport.verification_results.passed ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>VERIFIED REPAIR: All Checks Passed</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-rose-500" />
                              <span>VERIFICATION FAILED: Non-zero exit code</span>
                            </>
                          )}
                        </div>
                      </div>

                      <p className="text-secondary text-xs">
                        {diagnosticReport.verification_results.summary}
                      </p>

                      {/* Commands and Exit Codes */}
                      <div className="text-[10px] font-mono space-y-1 bg-surface/50 p-2 rounded border border-subtle">
                        <div className="text-muted uppercase">Executed Commands:</div>
                        {diagnosticReport.verification_results.commands_executed.map((cmd, idx) => (
                          <div key={idx} className="flex items-center justify-between text-secondary">
                            <span>{cmd}</span>
                            <span className="font-bold">
                              Exit: {diagnosticReport.verification_results?.exit_codes[cmd] ?? 0}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Rollback Recovery Button if failed */}
                      {!diagnosticReport.verification_results.passed && (
                        <button
                          onClick={recoverDiagnosticProject}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback Recovery (Restore Clean State)</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Sentinel Flight Recorder Events */}
      {activeTab === 'flight' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-subtle bg-canvas shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-subtle text-xs">
              <Search className="w-3 h-3 text-muted shrink-0" />
              <input
                type="text"
                placeholder="Search flight events..."
                value={flightSearchQuery}
                onChange={(e) => setFlightSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-main placeholder:text-muted focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
            {flightEvents.length === 0 ? (
              <div className="text-center text-muted py-8 select-none">
                <Flame className="w-8 h-8 text-[#F04424]/60 mx-auto mb-2" />
                <span className="text-secondary font-medium">No Flight Events Recorded</span>
                <p className="text-[10px] text-muted mt-1 max-w-xs mx-auto">
                  Sentinel Flight Recorder logs all autonomous task steps, tool executions, and file modifications with cryptographic tamper evidence.
                </p>
              </div>
            ) : (
              flightEvents
                .filter((ev) =>
                  !flightSearchQuery.trim()
                    ? true
                    : ev.summary.toLowerCase().includes(flightSearchQuery.toLowerCase()) ||
                      ev.type.toLowerCase().includes(flightSearchQuery.toLowerCase())
                )
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-md bg-canvas border border-subtle space-y-1.5 hover:border-strong transition-colors text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span className="px-1.5 py-0.2 rounded bg-elevated border border-subtle font-bold text-secondary uppercase">
                        {ev.type}
                      </span>
                      <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    <p className="text-secondary font-sans leading-relaxed select-text">
                      {ev.summary}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-subtle/50">
                      <span className="text-[9px] uppercase font-bold text-forge-accent">
                        Provenance: {ev.provenance || 'observed'}
                      </span>
                      {ev.evidence?.affectedPath && (
                        <span className="truncate max-w-[130px] text-secondary">
                          {ev.evidence.affectedPath}
                        </span>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Persistent Project Memory (Mimir Vault) */}
      {activeTab === 'memory' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-subtle bg-canvas shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-subtle text-xs">
              <Search className="w-3 h-3 text-muted shrink-0" />
              <input
                type="text"
                placeholder="Search persistent memories..."
                value={memorySearchQuery}
                onChange={(e) => setMemorySearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-main placeholder:text-muted focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
            {filteredMemories.length === 0 ? (
              <div className="text-center text-muted py-8 select-none">
                <BrainCircuit className="w-8 h-8 text-[#cc785c]/60 mx-auto mb-2" />
                <span className="text-secondary font-medium">No memories found</span>
                <p className="text-[10px] text-muted mt-1 max-w-xs mx-auto">
                  Encrypted semantic memories from prior runs, decisions, and preferences will be cited here.
                </p>
              </div>
            ) : (
              filteredMemories.map((m) => {
                const contentText = getMemoryContent(m);
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-md bg-canvas border border-subtle space-y-1.5 hover:border-strong transition-colors"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                      <span className="px-1.5 py-0.2 rounded bg-elevated border border-subtle uppercase font-bold text-secondary">
                        {m.type || 'fact'}
                      </span>
                      <span>ID: {String(m.id).slice(0, 8)}</span>
                    </div>

                    <p className="text-xs text-secondary leading-relaxed font-sans select-text">
                      {contentText}
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[9px] font-mono text-muted">
                      <span>Encrypted at rest</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`[Memory ${m.id}]: "${contentText}"`);
                        }}
                        className="text-[#cc785c] hover:underline cursor-pointer"
                        title="Copy memory citation to clipboard"
                      >
                        Copy Citation
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
