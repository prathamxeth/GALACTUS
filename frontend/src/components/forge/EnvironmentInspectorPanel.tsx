'use client';

import React from 'react';
import {
  Cpu,
  GitBranch,
  Terminal,
  Activity,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';

export const EnvironmentInspectorPanel: React.FC = () => {
  const { preflightReport, isPreflightLoading, refreshPreflight } = useForge();

  if (!preflightReport) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-[#F04424] mb-2" />
        <span className="text-xs">Sampling on-device environment metrics...</span>
      </div>
    );
  }

  const { os, resources, git, toolchains, backend, security } = preflightReport;

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden text-xs select-text">
      {/* Inspector Header */}
      <div className="h-8.5 px-3.5 bg-canvas border-b border-subtle flex items-center justify-between text-muted select-none shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-main font-semibold text-xs">System Environment Check</span>
          <span className="text-xs text-muted font-mono">
            Collected: {new Date(preflightReport.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <button
          onClick={refreshPreflight}
          disabled={isPreflightLoading}
          className="p-1 rounded-md text-muted hover:text-main hover:bg-elevated transition-colors cursor-pointer"
          title="Resample all local telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPreflightLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
        {/* Hardware & System */}
        <div className="p-3.5 rounded-xl border border-subtle bg-canvas space-y-2.5">
          <div className="flex items-center gap-2 text-main font-semibold text-xs">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Host Hardware &amp; Kernel</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Platform</span>
              <span className="text-secondary font-bold">{os.platform} ({os.arch})</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Kernel</span>
              <span className="text-secondary font-bold truncate">{os.release}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">CPU Cores</span>
              <span className="text-secondary font-bold">{os.cpus} Cores</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">System Memory</span>
              <span className="text-secondary font-bold">
                {resources.freeRamMb}MB free / {resources.totalRamMb}MB
              </span>
            </div>
          </div>
        </div>

        {/* Local Toolchains */}
        <div className="p-3.5 rounded-xl border border-subtle bg-canvas space-y-2.5">
          <div className="flex items-center gap-2 text-main font-semibold text-xs">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Developer Toolchains &amp; Compilers</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Node.js</span>
                <span className="text-secondary font-bold">{toolchains.node.version}</span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">npm</span>
                <span className="text-secondary font-bold">{toolchains.npm.version}</span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Python</span>
                <span className="text-secondary font-bold">{toolchains.python.version}</span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>

            <div className="p-2.5 rounded-lg bg-surface border border-subtle flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Git</span>
                <span className="text-secondary font-bold">{toolchains.git.version}</span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Git Working Tree */}
        <div className="p-3.5 rounded-xl border border-subtle bg-canvas space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-main font-semibold text-xs">
              <GitBranch className="w-3.5 h-3.5 text-[#cc785c]" />
              <span>Git Repository State</span>
            </div>
            <span className="font-mono text-xs text-muted">
              Commit: <code className="text-secondary">{git.commit}</code>
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-surface border border-subtle font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted">Active Branch:</span>
              <span className="text-main font-bold">{git.branch}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Working Tree Status:</span>
              <span>
                {git.isClean ? (
                  <span className="text-emerald-500 font-bold">Clean</span>
                ) : (
                  <span className="text-amber-500 font-bold">{git.modifiedCount} modified files</span>
                )}
              </span>
            </div>

            {git.modifiedFiles.length > 0 && (
              <div className="mt-2 pt-2 border-t border-subtle text-xs text-muted space-y-0.5">
                <span className="block uppercase text-[10px] text-muted font-semibold tracking-wider">Uncommitted Files:</span>
                {git.modifiedFiles.slice(0, 5).map((f, i) => (
                  <div key={i} className="text-secondary truncate">
                    • {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FastAPI & Ollama Inference Connectivity */}
        <div className="p-3.5 rounded-xl border border-subtle bg-canvas space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-main font-semibold text-xs">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>FastAPI Backend &amp; Local Model</span>
            </div>
            <span className="text-xs font-mono text-muted">{backend.url}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">HTTP Reachability</span>
              <span className="flex items-center gap-1.5 text-emerald-500 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {backend.reachable ? 'Connected' : 'Unreachable'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Latency</span>
              <span className="text-secondary font-bold">{backend.latencyMs}ms</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-subtle">
              <span className="block text-[10px] text-muted uppercase tracking-wider font-semibold">Active Model</span>
              <span className="text-main font-bold truncate">{backend.model}</span>
            </div>
          </div>
        </div>

        {/* Security Boundary Enforcement */}
        <div className="p-3.5 rounded-xl border border-subtle bg-canvas space-y-2">
          <div className="flex items-center gap-2 text-main font-semibold text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Local Execution Boundary Policy</span>
          </div>
          <div className="text-xs text-muted space-y-1.5 font-mono leading-relaxed">
            <div>• <strong className="text-secondary">Project Root:</strong> {security.projectRoot}</div>
            <div>• <strong className="text-secondary">Isolation Mode:</strong> {security.isolationMode} (Node.js Route Handlers on loopback 127.0.0.1)</div>
            <div>• <strong className="text-secondary">Path Traversal Defense:</strong> Enforced (rejects <code className="text-[#ea2804]">..</code> outside workspace root)</div>
            <div>• <strong className="text-secondary">Modifications Gating:</strong> {security.approvalRequiredForModifications ? 'Approval Token Required' : 'Open'}</div>
            <div>• <strong className="text-secondary">Process Limits:</strong> 25s execution timeout, 1MB max stdout buffer</div>
          </div>
        </div>
      </div>
    </div>
  );
};
