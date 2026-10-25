'use client';

import React from 'react';
import {
  FolderGit2,
  Command,
  Columns2,
  PanelBottom,
  Bot,
  Sun,
  Moon,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';

interface ForgeTopBarProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isBottomPanelOpen?: boolean;
  onToggleBottomPanel?: () => void;
}

export const ForgeTopBar: React.FC<ForgeTopBarProps> = ({
  isBottomPanelOpen = true,
  onToggleBottomPanel,
}) => {
  const {
    preflightReport,
    setIsCommandPaletteOpen,
    diagnosticReport,
    diagnosticStatus,
    isCompanionOpen,
    setIsCompanionOpen,
    workbenchLayout,
    toggleWorkbenchLayout,
  } = useForge();

  const { mode, setMode, preset, setPreset, isBackendOnline } = useRagnarok();

  const isDev = mode === 'developer';
  const hasActiveTask = Boolean(diagnosticReport);

  const isDark = preset === 'oled-dark' || preset === 'dark';
  const toggleTheme = () => {
    if (isDark) {
      setPreset('oled-light');
    } else {
      setPreset('oled-dark');
    }
  };

  return (
    <header className="h-10 border-b border-forge bg-forge-canvas px-3 flex items-center justify-between select-none z-30 shrink-0 font-sans text-xs transition-colors duration-150">
      {/* Left: Product Identity & Workspace Root */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-1.5 font-semibold text-xs tracking-tight">
          <span className="w-2 h-2 rounded-full bg-forge-accent" />
          <span className="font-heading text-sm text-forge-primary font-medium tracking-tight">
            MEMORAG
          </span>
          <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-forge-panel border border-forge text-forge-muted">
            Forge
          </span>
        </div>

        <span className="text-forge-muted/40">•</span>

        {/* Selected Workspace Root */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-forge-secondary">
          <FolderGit2 className="w-3.5 h-3.5 text-[#cc785c]" />
          <span className="text-forge-primary font-semibold">GALACTUS</span>

          {/* Dev Mode Only: Git Branch Telemetry */}
          {isDev && preflightReport?.git && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/30">
              {preflightReport.git.branch}
            </span>
          )}
        </div>
      </div>

      {/* Center: Search / Ask Agent OR Active Task Indicator */}
      <div className="flex items-center gap-2 max-w-md w-full justify-center">
        {hasActiveTask ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-forge-panel border border-forge text-[11px] font-mono text-forge-secondary max-w-sm truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse" />
            <span className="text-forge-primary font-medium truncate">
              {diagnosticReport?.user_request || (isDev ? 'Diagnostic Active Task' : 'Working on request...')}
            </span>
            <span className="text-[10px] text-amber-400 shrink-0 uppercase font-bold">
              {isDev ? `[${diagnosticStatus}]` : '• In Progress'}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center justify-between w-full max-w-xs px-2.5 py-1 rounded-lg text-xs bg-forge-panel border border-forge hover:border-forge-strong transition-colors text-forge-muted hover:text-forge-secondary shadow-xs cursor-pointer"
            title="Open Command Palette (⌘K)"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Command className="w-3 h-3 text-forge-muted" />
              <span className="truncate text-[11px] font-mono">
                {isDev ? 'Search files or ask agent...' : 'Search or describe what you want to do... (⌘K)'}
              </span>
            </div>
            <kbd className="text-[9px] font-mono px-1 py-0.2 bg-forge-elevated border border-forge rounded text-forge-muted">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Right: User/Dev Switch, Theme Toggle, & Controls */}
      <div className="flex items-center gap-2">
        {/* User / Dev View Switcher */}
        <div className="flex items-center rounded-lg bg-forge-panel border border-forge p-0.5 text-xs select-none">
          <button
            type="button"
            onClick={() => setMode('user')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              !isDev
                ? 'bg-forge-accent text-white font-semibold shadow-xs'
                : 'text-forge-muted hover:text-forge-primary'
            }`}
            title="User View: Focused everyday workspace"
          >
            <Sparkles className="w-3 h-3" />
            <span>User</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('developer')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              isDev
                ? 'bg-forge-elevated text-forge-primary border border-forge-strong font-semibold shadow-xs'
                : 'text-forge-muted hover:text-forge-primary'
            }`}
            title="Dev View: Full workbench with terminal, diagnostics, problems, and git"
          >
            <Terminal className="w-3 h-3" />
            <span>Dev</span>
          </button>
        </div>

        {/* Dedicated Light / Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="px-2 py-1 rounded-md bg-forge-panel border border-forge text-forge-secondary hover:text-forge-primary hover:bg-forge-hover transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1.5"
          title={`Switch to ${isDark ? 'Light' : 'Dark'}`}
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {/* Status Indicator */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-forge-panel border border-forge text-[11px] font-mono text-forge-secondary"
          title={isDev ? 'Ollama Local Inference Engine' : 'Workspace Status'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isBackendOnline ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
          />
          {isDev ? (
            <>
              <span className="text-forge-primary font-medium">
                {isBackendOnline ? 'gemma4:e2b' : 'offline'}
              </span>
              <span className="text-[10px] text-forge-muted">(local)</span>
            </>
          ) : (
            <span className="text-forge-primary font-medium text-[10px]">
              {isBackendOnline ? 'Connected' : 'Offline'}
            </span>
          )}
        </div>

        {/* Developer Workbench Controls (Dev Mode Only) */}
        {isDev && (
          <>
            <div className="h-3.5 w-px bg-forge-border mx-0.5" />

            {/* Layout Toggle: Split vs Agent vs Editor */}
            <button
              type="button"
              onClick={toggleWorkbenchLayout}
              className={`p-1.5 rounded-md border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                workbenchLayout === 'split'
                  ? 'bg-forge-elevated text-forge-accent border-forge-accent/40'
                  : 'bg-forge-panel text-forge-muted border-forge hover:text-forge-primary'
              }`}
              title={`Switch Workbench Layout (current: ${workbenchLayout})`}
              aria-label="Switch Workbench Layout"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase font-bold hidden sm:inline">
                {workbenchLayout === 'split' ? 'Split' : workbenchLayout === 'agent-only' ? 'Agent' : 'Editor'}
              </span>
            </button>

            {/* Toggle Bottom Panel */}
            {onToggleBottomPanel && (
              <button
                type="button"
                onClick={onToggleBottomPanel}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isBottomPanelOpen
                    ? 'bg-forge-elevated text-forge-primary border-forge'
                    : 'bg-forge-panel text-forge-muted border-forge hover:text-forge-primary'
                }`}
                title="Toggle Bottom Terminal Panel (⌘J)"
                aria-label="Toggle Bottom Terminal Panel"
              >
                <PanelBottom className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Toggle AI Companion */}
            <button
              type="button"
              onClick={() => setIsCompanionOpen(!isCompanionOpen)}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                isCompanionOpen
                  ? 'bg-forge-elevated text-forge-accent border-forge-accent/40'
                  : 'bg-forge-panel text-forge-muted border-forge hover:text-forge-primary'
              }`}
              title="Toggle AI Companion (⌘B)"
              aria-label="Toggle AI Companion"
            >
              <Bot className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
