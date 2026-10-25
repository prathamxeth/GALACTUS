'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  AlertCircle,
  History,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { ForgeTopBar } from './ForgeTopBar';
import { ForgeActivityBar } from './ForgeActivityBar';
import { ForgeSidebar } from './ForgeSidebar';
import { ForgeWorkbench } from './ForgeWorkbench';
import { TerminalPanel } from './TerminalPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { FlightRecorderPanel } from './FlightRecorderPanel';
import { ForgeCompanion } from './ForgeCompanion';
import { ForgeStatusBar } from './ForgeStatusBar';
import { CommandPalette } from './CommandPalette';
import { ForgeApprovalModal } from './ForgeApprovalModal';

export const ForgeShell: React.FC = () => {
  const {
    activeBottomTab,
    setActiveBottomTab,
    isCompanionOpen,
    problems,
    flightEvents,
    setIsCommandPaletteOpen,
    toggleWorkbenchLayout,
  } = useForge();

  const { mode } = useRagnarok();
  const isDev = mode === 'developer';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [devBottomPanelOpen, setDevBottomPanelOpen] = useState(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(256);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const isDraggingRef = useRef(false);

  const isBottomPanelOpen = isDev && devBottomPanelOpen;
  const toggleBottomPanel = useCallback(() => {
    setDevBottomPanelOpen((prev) => !prev);
  }, []);

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warnCount = problems.filter((p) => p.severity === 'warning').length;

  // VS Code Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      } else if (isMeta && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (isDev) {
          toggleBottomPanel();
        }
      } else if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (isMeta && e.key === '\\') {
        e.preventDefault();
        toggleWorkbenchLayout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDev, toggleBottomPanel, setIsCommandPaletteOpen, toggleWorkbenchLayout]);

  // Bottom panel vertical resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const windowHeight = window.innerHeight;
      const newHeight = Math.max(120, Math.min(windowHeight - 160, windowHeight - moveEvent.clientY - 24));
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-forge-canvas text-forge-primary overflow-hidden font-sans select-none transition-colors duration-150">
      {/* 1. Top Title & Command Bar */}
      <ForgeTopBar
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleBottomPanel={toggleBottomPanel}
      />

      {/* 2. Main Workbench Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Activity Rail (48px narrow strip) */}
        <ForgeActivityBar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        {/* Primary Sidebar (Contextual Drawer) */}
        {isSidebarOpen && <ForgeSidebar />}

        {/* Center Workbench (Editor / Agent / Split View) + Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-forge-panel">
          {/* Main Work Area: Agent Workspace & Code Editor */}
          {(!isPanelMaximized || !isBottomPanelOpen) && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <ForgeWorkbench />
            </div>
          )}

          {/* Lower Pane: Dev Mode Resizable / Collapsible Bottom Panel */}
          {isDev && (
            <div
              style={{
                height: !isBottomPanelOpen
                  ? '32px'
                  : isPanelMaximized
                  ? '100%'
                  : `${bottomPanelHeight}px`,
              }}
              className="border-t border-forge flex flex-col bg-forge-panel transition-[height] duration-75 relative shrink-0"
            >
              {/* Draggable resize handle */}
              {isBottomPanelOpen && !isPanelMaximized && (
                <div
                  onMouseDown={handleMouseDown}
                  className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-20 hover:bg-forge-accent/40 transition-colors"
                  title="Drag to resize panel"
                />
              )}

              {/* Bottom Panel Tab Header */}
              <div className="h-8 px-3 bg-forge-canvas border-b border-forge flex items-center justify-between text-xs text-forge-muted select-none shrink-0">
                <div className="flex items-center gap-1">
                  {/* Terminal Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBottomTab('terminal');
                      setDevBottomPanelOpen(true);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeBottomTab === 'terminal' && isBottomPanelOpen
                        ? 'bg-forge-elevated font-semibold text-forge-primary border-t-2 border-t-forge-accent'
                        : 'hover:text-forge-secondary'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-[#cc785c]" />
                    <span>Terminal</span>
                  </button>

                  {/* Problems Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBottomTab('problems');
                      setDevBottomPanelOpen(true);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeBottomTab === 'problems' && isBottomPanelOpen
                        ? 'bg-forge-elevated font-semibold text-forge-primary border-t-2 border-t-[#ea580c]'
                        : 'hover:text-forge-secondary'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-[#ea580c]" />
                    <span>Problems</span>
                    {errorCount > 0 && (
                      <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold">
                        {errorCount}
                      </span>
                    )}
                    {warnCount > 0 && errorCount === 0 && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                        {warnCount}
                      </span>
                    )}
                  </button>

                  {/* Flight Recorder Tab */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBottomTab('flight');
                      setDevBottomPanelOpen(true);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      activeBottomTab === 'flight' && isBottomPanelOpen
                        ? 'bg-forge-elevated font-semibold text-forge-primary border-t-2 border-t-forge-accent'
                        : 'hover:text-forge-secondary'
                    }`}
                  >
                    <History className="w-3.5 h-3.5 text-forge-accent" />
                    <span>Flight Recorder</span>
                    {flightEvents.length > 0 && (
                      <span className="px-1 py-0.2 rounded bg-forge-canvas text-forge-secondary text-[9px] font-mono">
                        {flightEvents.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Panel Window Actions */}
                <div className="flex items-center gap-1">
                  {isBottomPanelOpen && (
                    <button
                      type="button"
                      onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                      className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-hover transition-colors cursor-pointer"
                      title={isPanelMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
                    >
                      {isPanelMaximized ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isPanelMaximized) setIsPanelMaximized(false);
                      toggleBottomPanel();
                    }}
                    className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-hover transition-colors cursor-pointer"
                    title={isBottomPanelOpen ? 'Minimize Panel (⌘J)' : 'Expand Panel (⌘J)'}
                  >
                    {isBottomPanelOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Panel Content */}
              {isBottomPanelOpen && (
                <div className="flex-1 flex overflow-hidden">
                  {activeBottomTab === 'terminal' && <TerminalPanel />}
                  {activeBottomTab === 'problems' && <ProblemsPanel />}
                  {activeBottomTab === 'flight' && <FlightRecorderPanel />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Contextual AI Companion (Dev Mode / Toggle) */}
        {isDev && isCompanionOpen && <ForgeCompanion />}
      </div>

      {/* 3. Bottom Status Bar */}
      <ForgeStatusBar />

      {/* 4. Command Palette (⌘K) Modal */}
      <CommandPalette />

      {/* 5. Approval Modal */}
      <ForgeApprovalModal />
    </div>
  );
};
