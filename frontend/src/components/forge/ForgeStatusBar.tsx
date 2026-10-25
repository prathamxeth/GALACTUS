'use client';

import React from 'react';
import {
  FolderGit2,
  AlertCircle,
  AlertTriangle,
  Terminal,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export const ForgeStatusBar: React.FC = () => {
  const {
    preflightReport,
    activeFile,
    problems,
    activeBottomTab,
    setActiveBottomTab,
    checkpoints,
    diagnosticReport,
    diagnosticStatus,
  } = useForge();

  const { mode, preset, isBackendOnline, modelStatus } = useRagnarok();
  const isDev = mode === 'developer';

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;
  const lastHealthy = checkpoints.find((c) => c.isHealthy);

  const themeLabel =
    preset === 'oled-dark'
      ? 'OLED Dark'
      : preset === 'oled-light'
      ? 'OLED Light'
      : preset === 'light'
      ? 'Light'
      : 'Dark';

  return (
    <footer
      className="h-6 bg-forge-canvas border-t border-forge px-3 flex items-center justify-between text-[11px] font-mono tabular-nums text-forge-muted select-none shrink-0 z-20 transition-colors duration-150"
      aria-label="Status Bar"
    >
      {/* Left Region */}
      <div className="flex items-center gap-3">
        {/* Workspace Root */}
        <div className="flex items-center gap-1 text-forge-primary font-semibold">
          <FolderGit2 className="w-3 h-3 text-[#cc785c]" />
          <span>GALACTUS</span>
        </div>

        {/* Dev Mode Only: Git Branch State & Problems */}
        {isDev && (
          <>
            {preflightReport?.git && (
              <div className="flex items-center gap-1 text-forge-secondary">
                <span>git:({preflightReport.git.branch})</span>
                {preflightReport.git.modifiedCount > 0 && (
                  <span className="text-amber-400 font-bold ml-0.5">
                    *{preflightReport.git.modifiedCount}
                  </span>
                )}
              </div>
            )}

            {/* Problems Counter */}
            <button
              type="button"
              onClick={() => setActiveBottomTab('problems')}
              className={`flex items-center gap-1 px-1.5 py-0.2 rounded hover:bg-forge-hover transition-colors cursor-pointer ${
                errorCount > 0 ? 'text-rose-400 font-bold' : 'text-forge-muted hover:text-forge-primary'
              }`}
              title="Toggle Problems"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{errorCount} errors</span>
              {warningCount > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400 ml-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>{warningCount}</span>
                </span>
              )}
            </button>

            {/* Terminal Tab Switcher (Truthfully labeled as Runner) */}
            <button
              type="button"
              onClick={() => setActiveBottomTab('terminal')}
              className={`flex items-center gap-1 px-1.5 py-0.2 rounded hover:bg-forge-hover transition-colors cursor-pointer ${
                activeBottomTab === 'terminal' ? 'text-forge-primary font-bold' : 'text-forge-muted'
              }`}
              title="Toggle Bounded Command Runner"
            >
              <Terminal className="w-3 h-3 text-forge-accent" />
              <span>Runner</span>
            </button>

            {/* Checkpoint Status */}
            {lastHealthy && (
              <button
                type="button"
                onClick={() => setActiveBottomTab('flight')}
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                title={`Last passing checkpoint: ${lastHealthy.title}`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Pass ({lastHealthy.gitCommit.slice(0, 7)})</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Center: Status State */}
      <div className="flex items-center gap-2 text-[10px]">
        {diagnosticReport ? (
          <span className="flex items-center gap-1 text-forge-accent font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse" />
            <span>{isDev ? `Agent: ${diagnosticStatus}` : 'Working on your request...'}</span>
          </span>
        ) : modelStatus === 'ready' ? (
          <span className="text-forge-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{isDev ? 'Agent: Ready' : 'Ready'}</span>
          </span>
        ) : modelStatus === 'connecting' ? (
          <span className="text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Agent: Connecting...</span>
          </span>
        ) : modelStatus === 'unavailable' ? (
          <span className="text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Agent: Model Unavailable</span>
          </span>
        ) : (
          <span className="text-rose-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Agent: Offline</span>
          </span>
        )}
      </div>

      {/* Right Region */}
      <div className="flex items-center gap-3">
        {/* Dev Mode Only: Active file line/col and loopback info */}
        {isDev ? (
          <>
            {activeFile && (
              <div className="flex items-center gap-2 text-forge-secondary">
                <span>Ln {activeFile.cursorLine || 1}, Col {activeFile.cursorCol || 1}</span>
                <span className="text-forge-muted/30">|</span>
                <span className="uppercase text-[10px]">{activeFile.language}</span>
                <span className="text-forge-muted/30">|</span>
                <span>UTF-8</span>
              </div>
            )}

            {/* Backend Connectivity */}
            <div className="flex items-center gap-1 text-forge-secondary">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendOnline ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span>{isBackendOnline ? '127.0.0.1:8000' : 'Backend Offline'}</span>
            </div>

            {/* Theme Preset Badge */}
            <span className="text-[9px] uppercase px-1 rounded bg-forge-panel text-forge-secondary border border-forge">
              {themeLabel}
            </span>
          </>
        ) : (
          /* User Mode: Clean and peaceful */
          <div className="flex items-center gap-2 text-forge-secondary text-[10px]">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-forge-accent" />
              <span>User Mode</span>
            </span>
            <span className="text-forge-muted/30">•</span>
            <span>{themeLabel}</span>
          </div>
        )}
      </div>
    </footer>
  );
};
