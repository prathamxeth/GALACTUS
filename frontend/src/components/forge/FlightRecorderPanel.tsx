'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  FileText,
  Sparkles,
  Wrench,
  GitBranch,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export interface FlightRecorderPanelProps {
  onExpandToBottom?: () => void;
  onToggleWide?: () => void;
  isWide?: boolean;
}

type SubTabId = 'events' | 'checkpoints' | 'whatChanged';
type FilterId = 'all' | 'observed' | 'hypothesis' | 'repair' | 'verification';

export const FlightRecorderPanel: React.FC<FlightRecorderPanelProps> = ({
  onExpandToBottom,
  onToggleWide,
  isWide,
}) => {
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
    sseStreamStatus,
    setActiveBottomTab,
  } = useForge();

  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('events');
  const [filterType, setFilterType] = useState<FilterId>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Horizontal scroll containers refs
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const filtersScrollRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Sub-tabs list definition
  const subTabs: { id: SubTabId; label: string; count: number | null }[] = [
    { id: 'events', label: 'Timeline', count: flightEvents.length },
    { id: 'checkpoints', label: 'Checkpoints', count: checkpoints.length },
    { id: 'whatChanged', label: 'Diff Analysis', count: null },
  ];

  const currentTabIdx = subTabs.findIndex((t) => t.id === activeSubTab);

  // Cycle navigation
  const handlePrevTab = useCallback(() => {
    setActiveSubTab((curr) => {
      if (curr === 'whatChanged') return 'checkpoints';
      if (curr === 'checkpoints') return 'events';
      return 'whatChanged';
    });
  }, []);

  const handleNextTab = useCallback(() => {
    setActiveSubTab((curr) => {
      if (curr === 'events') return 'checkpoints';
      if (curr === 'checkpoints') return 'whatChanged';
      return 'events';
    });
  }, []);

  // Touch Swipe Gesture Handlers (Left/Right swipe switches sub-tabs)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Must be predominantly horizontal and at least 35px
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        // Swiped left -> advance to next tab
        handleNextTab();
      } else {
        // Swiped right -> go to previous tab
        handlePrevTab();
      }
    }
  };

  // Scroll sub-tabs strip smoothly
  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsScrollRef.current) return;
    const offset = direction === 'left' ? -140 : 140;
    tabsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Scroll filters strip smoothly
  const scrollFilters = (direction: 'left' | 'right') => {
    if (!filtersScrollRef.current) return;
    const offset = direction === 'left' ? -120 : 120;
    filtersScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Mouse drag-to-scroll utility for horizontal bars
  const handleMouseDownDrag = (ref: React.RefObject<HTMLDivElement | null>) => (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const startX = e.pageX - el.offsetLeft;
    const scrollLeft = el.scrollLeft;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.3;
      el.scrollLeft = scrollLeft - walk;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Event category detection
  const isHypothesisEvent = (ev: { summary: string; type: string; provenance?: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('hypothesis') || s.includes('inferred') || s.includes('llm_') || s.includes('reasoning');
  };

  const isVerificationEvent = (ev: { summary: string; type: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('verif') || s.includes('test_passed') || s.includes('test_failed') || s.includes('exit code');
  };

  const isRepairEvent = (ev: { summary: string; type: string }) => {
    const s = (ev.summary + ' ' + ev.type).toLowerCase();
    return s.includes('repair') || s.includes('patch') || s.includes('approval') || s.includes('fix');
  };

  const filteredEvents = flightEvents.filter((ev) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        ev.summary.toLowerCase().includes(q) ||
        ev.type.toLowerCase().includes(q) ||
        (ev.evidence?.outputExcerpt || '').toLowerCase().includes(q) ||
        (ev.evidence?.affectedPath || '').toLowerCase().includes(q);
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

  const handleExpandToBottom = () => {
    if (onExpandToBottom) {
      onExpandToBottom();
    } else {
      setActiveBottomTab('flight');
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex-1 flex flex-col bg-forge-canvas overflow-hidden text-xs select-text transition-colors duration-150 h-full"
    >
      {/* =====================================================================
          1. HEADER: Activity History Title, Live Status & Global Actions
          ===================================================================== */}
      <header className="px-3.5 py-2.5 bg-forge-panel border-b border-forge space-y-2 select-none shrink-0">
        {/* Top Row: Title, Live Pill, Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: Brand & Status */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 text-forge-primary font-bold text-xs font-mono shrink-0">
              <History className="w-4 h-4 text-forge-accent shrink-0" />
              <span>Activity History</span>
            </div>

            {/* Live SSE Stream Status Indicator */}
            <div
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-forge-canvas border border-forge text-[10px] font-mono shrink-0"
              title={
                sseStreamStatus === 'connected'
                  ? `Live SSE stream connected (${diagnosticEvents.length} events received)`
                  : `Stream Status: ${sseStreamStatus}`
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sseStreamStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : sseStreamStatus === 'connecting' || sseStreamStatus === 'reconnecting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="text-forge-secondary font-medium">
                {sseStreamStatus === 'connected' ? 'Live' : sseStreamStatus}
              </span>
            </div>
          </div>

          {/* Right: Tab Carousel Chevrons & Utility Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Tab Swipe Navigation Chevrons */}
            <div className="inline-flex items-center rounded-lg bg-forge-canvas border border-forge p-0.5 mr-1">
              <button
                type="button"
                onClick={handlePrevTab}
                className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
                title="Swipe right / Previous tab"
                aria-label="Previous tab"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-1 text-[10px] font-mono text-forge-muted font-semibold select-none">
                {currentTabIdx + 1}/3
              </span>
              <button
                type="button"
                onClick={handleNextTab}
                className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
                title="Swipe left / Next tab"
                aria-label="Next tab"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={refreshFlightRecorder}
              className="p-1.5 rounded-lg text-forge-muted hover:text-forge-primary hover:bg-forge-elevated border border-transparent hover:border-forge transition-colors cursor-pointer"
              title="Refresh activity history"
              aria-label="Refresh activity history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFlightRecorder ? 'animate-spin' : ''}`} />
            </button>

            {/* Expand / Maximize to full width bottom panel */}
            <button
              type="button"
              onClick={handleExpandToBottom}
              className="p-1.5 rounded-lg text-forge-muted hover:text-forge-accent hover:bg-forge-elevated border border-transparent hover:border-forge transition-colors cursor-pointer"
              title="Expand Activity History to full-width bottom panel"
              aria-label="Expand to bottom panel"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Middle Row: Sub-Tabs Bar with Smooth Horizontal Swipe & Scroll Support */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer shrink-0 md:hidden"
            title="Scroll tabs left"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <div
            ref={tabsScrollRef}
            onMouseDown={handleMouseDownDrag(tabsScrollRef)}
            className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap touch-pan-x cursor-grab active:cursor-grabbing p-0.5 rounded-lg bg-forge-canvas border border-forge text-[11px] font-mono select-none"
          >
            {subTabs.map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md transition-all duration-150 whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-forge-elevated text-forge-primary font-bold shadow-2xs border border-forge'
                      : 'text-forge-muted hover:text-forge-secondary hover:bg-forge-hover/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`ml-1.5 text-[10px] ${isActive ? 'text-forge-accent' : 'opacity-70'}`}>
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer shrink-0 md:hidden"
            title="Scroll tabs right"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom Row: Action Buttons Bar */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleRunWhatChanged}
            disabled={isAnalyzing}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium bg-forge-elevated hover:bg-forge-hover text-forge-secondary hover:text-forge-primary border border-forge transition-all duration-150 active:translate-y-px disabled:opacity-40 cursor-pointer shadow-2xs truncate"
            title="Inspect changes against last passing checkpoint"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-forge-accent shrink-0 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span className="truncate">Inspect Diff</span>
          </button>

          <button
            type="button"
            onClick={() => createHealthyCheckpoint('Verified Checkpoint')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium bg-forge-elevated hover:bg-forge-hover text-forge-secondary hover:text-forge-primary border border-forge hover:border-emerald-500/40 transition-all duration-150 active:translate-y-px cursor-pointer shadow-2xs truncate"
            title="Save verified healthy snapshot"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Save Checkpoint</span>
          </button>
        </div>
      </header>

      {/* =====================================================================
          2. SUB-TAB A: CHRONOLOGICAL TIMELINE
          ===================================================================== */}
      {activeSubTab === 'events' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Bar with Horizontal Swipe / Drag Support */}
          <div className="px-3.5 py-2 bg-forge-canvas/90 border-b border-forge space-y-2 text-xs font-mono select-none shrink-0">
            {/* Filter Pills with Left/Right Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-forge-muted font-semibold shrink-0">Filter:</span>

              <button
                type="button"
                onClick={() => scrollFilters('left')}
                className="p-0.5 rounded text-forge-muted hover:text-forge-primary transition-colors cursor-pointer shrink-0"
                title="Scroll filters left"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>

              <div
                ref={filtersScrollRef}
                onMouseDown={handleMouseDownDrag(filtersScrollRef)}
                className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none flex-nowrap touch-pan-x cursor-grab active:cursor-grabbing py-0.5"
              >
                {[
                  { id: 'all', label: 'All' },
                  { id: 'observed', label: 'Observed' },
                  { id: 'hypothesis', label: 'Analysis' },
                  { id: 'repair', label: 'Changes' },
                  { id: 'verification', label: 'Verified' },
                ].map(({ id, label }) => {
                  const isActive = filterType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilterType(id as FilterId)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 cursor-pointer select-none shrink-0 ${
                        isActive
                          ? 'bg-forge-elevated text-forge-primary border border-forge font-bold shadow-2xs'
                          : 'text-forge-muted hover:text-forge-secondary hover:bg-forge-hover/60'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollFilters('right')}
                className="p-0.5 rounded text-forge-muted hover:text-forge-primary transition-colors cursor-pointer shrink-0"
                title="Scroll filters right"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Full-Width Search Input */}
            <div className="flex items-center gap-2 bg-forge-panel border border-forge rounded-lg px-2.5 py-1.5 focus-within:border-forge-accent/60 transition-colors">
              <Search className="w-3.5 h-3.5 text-forge-muted shrink-0" />
              <input
                type="text"
                placeholder="Search events, outputs, or files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-forge-primary placeholder:text-forge-muted/70 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 rounded text-forge-muted hover:text-forge-primary transition-colors cursor-pointer shrink-0"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Hierarchical, Spacious Event Stream with FULL TEXT (No Ellipses) */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
            {filteredEvents.length === 0 ? (
              <div className="text-center text-forge-muted py-14 select-none space-y-2.5">
                <Clock className="w-8 h-8 text-forge-muted/40 mx-auto" />
                <p className="text-xs font-semibold text-forge-primary">No activity events found</p>
                <p className="text-[11px] text-forge-muted max-w-xs mx-auto">
                  {searchQuery
                    ? 'No events match your current search query. Try clearing the search box.'
                    : 'Send a prompt or execute a command to start recording live telemetry.'}
                </p>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isHypothesis = isHypothesisEvent(ev);
                const isVerification = isVerificationEvent(ev);
                const isRepair = isRepairEvent(ev);

                // Category styling
                let categoryLabel = 'Observed';
                let categoryClass = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
                let StatusIcon = Activity;
                let statusIconColor = 'text-sky-400';

                if (isHypothesis) {
                  categoryLabel = 'Analysis';
                  categoryClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  StatusIcon = Sparkles;
                  statusIconColor = 'text-amber-400';
                } else if (ev.healthyState === false) {
                  categoryLabel = 'Failed';
                  categoryClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                  StatusIcon = XCircle;
                  statusIconColor = 'text-rose-400';
                } else if (isVerification || ev.healthyState === true) {
                  categoryLabel = 'Verified';
                  categoryClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  StatusIcon = CheckCircle2;
                  statusIconColor = 'text-emerald-400';
                } else if (isRepair) {
                  categoryLabel = 'Change';
                  categoryClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
                  StatusIcon = Wrench;
                  statusIconColor = 'text-purple-400';
                }

                return (
                  <article
                    key={ev.id}
                    className="p-3.5 rounded-xl border border-forge bg-forge-panel space-y-2.5 transition-all duration-150 hover:border-forge-strong shadow-2xs group"
                  >
                    {/* Row 1: Header Row (Status, Category, Type, Provenance, Timestamp) */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Status Icon */}
                        <StatusIcon className={`w-3.5 h-3.5 ${statusIconColor} shrink-0`} />

                        {/* Category Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold border ${categoryClass}`}
                        >
                          {categoryLabel}
                        </span>

                        {/* Event Type Badge */}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-forge-muted bg-forge-canvas border border-forge">
                          {ev.type}
                        </span>
                      </div>

                      {/* Right Meta: Provenance & Timestamp */}
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-forge-muted shrink-0">
                        <Clock className="w-3 h-3 text-forge-muted/70" />
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span className="px-1.5 py-0.5 rounded bg-forge-canvas border border-forge text-[10px] text-forge-muted uppercase tracking-wider">
                          {ev.provenance}
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Full Event Summary Text (NO TRUNCATION / NO ELLIPSES) */}
                    <div className="text-xs font-semibold text-forge-primary leading-relaxed break-words">
                      {ev.summary}
                    </div>

                    {/* Row 3: Evidence / Output Excerpt Code Box */}
                    {ev.evidence?.outputExcerpt && (
                      <div className="p-3 rounded-lg bg-forge-canvas border border-forge font-mono text-[11px] text-forge-secondary whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar select-all break-words">
                        {ev.evidence.outputExcerpt}
                      </div>
                    )}

                    {/* Row 4: Clickable File Target Link */}
                    {ev.evidence?.affectedPath && (
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => openFile(ev.evidence!.affectedPath!)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-forge-accent hover:text-forge-accent/80 hover:underline cursor-pointer group break-all text-left"
                          title="Open file in editor"
                        >
                          <FileText className="w-3.5 h-3.5 text-forge-accent shrink-0" />
                          <span className="break-all">{ev.evidence.affectedPath}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. SUB-TAB B: CHECKPOINTS LIST
          ===================================================================== */}
      {activeSubTab === 'checkpoints' && (
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
          {checkpoints.length === 0 ? (
            <div className="text-center text-forge-muted py-14 space-y-2.5">
              <CheckCircle2 className="w-8 h-8 text-forge-muted/40 mx-auto" />
              <p className="text-xs font-semibold text-forge-primary">No checkpoints recorded yet</p>
              <p className="text-[11px] text-forge-muted max-w-xs mx-auto">
                Click &quot;Save Checkpoint&quot; above to capture a verified snapshot of your repository and test outcomes.
              </p>
            </div>
          ) : (
            checkpoints.map((chk) => {
              const isHealthy = Boolean(
                chk.isHealthy &&
                  chk.evidenceSnapshot?.testsExitCode === 0 &&
                  (!chk.testResults || chk.testResults.failed === 0)
              );

              return (
                <article
                  key={chk.id}
                  className="p-3.5 rounded-xl border border-forge bg-forge-panel space-y-2.5 transition-all duration-150 hover:border-forge-strong shadow-2xs"
                >
                  {/* Row 1: Status Badge, Title & Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {isHealthy ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                          isHealthy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isHealthy ? 'Healthy Snapshot' : 'Unverified Snapshot'}
                      </span>
                    </div>

                    <span className="text-[10px] text-forge-muted font-mono">
                      {new Date(chk.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {/* Row 2: Title with NO TRUNCATION */}
                  <div className="text-xs font-semibold text-forge-primary break-words">
                    {chk.title}
                  </div>

                  {/* Row 3: Git Details & Test Summary */}
                  <div className="flex items-center gap-2.5 text-[11px] font-mono text-forge-secondary flex-wrap pt-0.5">
                    <span className="flex items-center gap-1 text-forge-muted">
                      <GitBranch className="w-3 h-3 text-forge-accent shrink-0" />
                      <span>Branch:</span>
                      <code className="text-forge-primary font-semibold">{chk.gitBranch}</code>
                    </span>
                    <span className="text-forge-muted/40">•</span>
                    <span className="text-forge-muted">
                      Commit:{' '}
                      <code className="text-forge-primary font-semibold">
                        {chk.gitCommit.slice(0, 7)}
                      </code>
                    </span>
                    {chk.testResults && (
                      <>
                        <span className="text-forge-muted/40">•</span>
                        <span className="text-forge-muted">
                          Tests:{' '}
                          <span className="text-emerald-400 font-semibold">
                            {chk.testResults.passed} passed
                          </span>{' '}
                          / {chk.testResults.total} total
                        </span>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* =====================================================================
          4. SUB-TAB C: DIFF ANALYSIS (WHAT CHANGED)
          ===================================================================== */}
      {activeSubTab === 'whatChanged' && (
        <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-52 text-forge-muted space-y-3">
              <span className="w-3 h-3 rounded-full bg-forge-accent animate-ping" />
              <span className="text-xs font-mono font-medium">
                Analyzing Git diff, test outcomes, and correlation fingerprints...
              </span>
            </div>
          ) : !whatChanged ? (
            <div className="flex flex-col items-center justify-center h-52 text-forge-muted text-center space-y-3 p-4">
              <RotateCcw className="w-9 h-9 text-forge-accent/60 mx-auto" />
              <div className="font-bold text-forge-primary text-xs">No Diff Analysis Generated Yet</div>
              <p className="text-[11px] text-forge-muted max-w-sm">
                Compare current modified repository files and test outcomes against your last passing healthy checkpoint.
              </p>
              <button
                type="button"
                onClick={handleRunWhatChanged}
                className="px-4 py-2 rounded-lg bg-forge-accent hover:bg-forge-accent/90 text-white text-xs font-medium font-mono transition-colors cursor-pointer shadow-xs active:translate-y-px"
              >
                Run Diff Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Baseline Reference Card */}
              {whatChanged.lastPassingCheckpoint ? (
                <div className="p-3.5 rounded-xl border border-forge bg-forge-panel space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-forge-primary text-xs">
                        Baseline: {whatChanged.lastPassingCheckpoint.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-forge-muted font-mono">
                      {new Date(whatChanged.lastPassingCheckpoint.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-forge-muted">
                    Commit:{' '}
                    <code className="text-forge-primary font-semibold">
                      {whatChanged.lastPassingCheckpoint.gitCommit.slice(0, 7)}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-forge bg-forge-panel text-forge-muted text-xs">
                  No prior passing checkpoint found in repository history.
                </div>
              )}

              {/* Correlation Analysis Card */}
              {whatChanged.correlationAnalysis && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Hypothesis &amp; Correlation Analysis</span>
                  </div>
                  <p className="text-forge-secondary font-sans leading-relaxed text-xs break-words">
                    {whatChanged.correlationAnalysis}
                  </p>
                </div>
              )}

              {/* Modified Files List */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-forge-muted uppercase tracking-wider font-bold block">
                  Modified Files ({whatChanged.differences.modifiedFiles.length})
                </span>
                <div className="space-y-1.5">
                  {whatChanged.differences.modifiedFiles.map((filePath, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-forge-panel border border-forge flex items-center justify-between font-mono text-xs hover:border-forge-strong transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => openFile(filePath)}
                        className="inline-flex items-center gap-2 text-forge-primary hover:text-forge-accent text-left break-all cursor-pointer group"
                      >
                        <FileText className="w-3.5 h-3.5 text-forge-accent shrink-0" />
                        <span className="break-all">{filePath}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
