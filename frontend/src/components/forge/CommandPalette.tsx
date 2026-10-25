'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Play,
  Activity,
  CheckCircle2,
  RotateCcw,
  Sun,
  Moon,
  SunMedium,
  User,
  FileCode,
  Terminal,
  AlertCircle,
  History,
  Layers,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FileEntry } from '@/lib/forge/types';

interface PaletteItem {
  id: string;
  title: string;
  category: 'Commands' | 'Files' | 'Themes' | 'Panels' | 'Mode';
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    fileTree,
    openFile,
    runTestCheck,
    runBuildCheck,
    createHealthyCheckpoint,
    analyzeWhatChanged,
    setActiveBottomTab,
    setActiveLeftTab,
    startProjectDiagnostics,
    recoverDiagnosticProject,
    setIsCompanionOpen,
  } = useForge();

  const { setPreset, setMode, mode } = useRagnarok();
  const isDev = mode === 'developer';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      const timer = setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isCommandPaletteOpen]);

  // Flatten files
  const flatFiles = useMemo(() => {
    const list: FileEntry[] = [];
    function traverse(entries: FileEntry[]) {
      for (const e of entries) {
        if (e.type === 'file') list.push(e);
        if (e.children) traverse(e.children);
      }
    }
    traverse(fileTree);
    return list;
  }, [fileTree]);

  // Construct palette items
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = isDev
      ? [
          // Dev Mode Commands
          {
            id: 'cmd-test',
            title: 'Run Test Suite (npm test)',
            category: 'Commands',
            shortcut: 'npm test',
            icon: <Play className="w-3.5 h-3.5 text-emerald-400" />,
            action: () => runTestCheck(),
          },
          {
            id: 'cmd-build',
            title: 'Run Production Build (npm run build)',
            category: 'Commands',
            shortcut: 'npm build',
            icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
            action: () => runBuildCheck(),
          },
          {
            id: 'cmd-what-changed',
            title: 'Analyze What Changed Since Last Passing Build',
            category: 'Commands',
            shortcut: 'Diff',
            icon: <RotateCcw className="w-3.5 h-3.5 text-forge-accent" />,
            action: async () => {
              setActiveBottomTab('flight');
              await analyzeWhatChanged();
            },
          },
          {
            id: 'cmd-diagnose',
            title: 'Run Real Project Diagnosis (POST /api/diagnostics/analyze)',
            category: 'Commands',
            shortcut: 'Diagnose',
            icon: <Activity className="w-3.5 h-3.5 text-forge-accent" />,
            action: async () => {
              setIsCompanionOpen(true);
              await startProjectDiagnostics('.', 'Find why build/test fails');
            },
          },
          {
            id: 'cmd-recover',
            title: 'Rollback Recovery (POST /api/diagnostics/{task_id}/recover)',
            category: 'Commands',
            shortcut: 'Recover',
            icon: <RotateCcw className="w-3.5 h-3.5 text-rose-400" />,
            action: () => recoverDiagnosticProject(),
          },
          {
            id: 'cmd-checkpoint',
            title: 'Record Verified Healthy Checkpoint',
            category: 'Commands',
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />,
            action: () => createHealthyCheckpoint(),
          },

          // Panels
          {
            id: 'panel-terminal',
            title: 'Focus Integrated Terminal Panel',
            category: 'Panels',
            icon: <Terminal className="w-3.5 h-3.5 text-[#cc785c]" />,
            action: () => setActiveBottomTab('terminal'),
          },
          {
            id: 'panel-problems',
            title: 'Focus Diagnostics & Problems Panel',
            category: 'Panels',
            icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
            action: () => setActiveBottomTab('problems'),
          },
          {
            id: 'panel-flight',
            title: 'Focus Flight Recorder Timeline',
            category: 'Panels',
            icon: <History className="w-3.5 h-3.5 text-forge-accent" />,
            action: () => setActiveBottomTab('flight'),
          },
          {
            id: 'panel-inspector',
            title: 'Open On-Device Preflight Inspector',
            category: 'Panels',
            icon: <Layers className="w-3.5 h-3.5 text-blue-400" />,
            action: () => setActiveLeftTab('inspector'),
          },

          // Appearance Presets
          {
            id: 'theme-oled-dark',
            title: 'Appearance: OLED Dark (Pitch Black)',
            category: 'Themes',
            icon: <Moon className="w-3.5 h-3.5 text-purple-400" />,
            action: () => setPreset('oled-dark'),
          },
          {
            id: 'theme-oled-light',
            title: 'Appearance: OLED Light (Pure White)',
            category: 'Themes',
            icon: <SunMedium className="w-3.5 h-3.5 text-amber-400" />,
            action: () => setPreset('oled-light'),
          },
          {
            id: 'theme-dark',
            title: 'Appearance: Dark (Slate Deep Charcoal)',
            category: 'Themes',
            icon: <Moon className="w-3.5 h-3.5 text-indigo-400" />,
            action: () => setPreset('dark'),
          },
          {
            id: 'theme-light',
            title: 'Appearance: Light (Warm Editorial Canvas)',
            category: 'Themes',
            icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
            action: () => setPreset('light'),
          },

          // Modes
          {
            id: 'mode-user',
            title: 'Audience Mode: User (Plain-language health summaries)',
            category: 'Mode',
            icon: <User className="w-3.5 h-3.5 text-emerald-400" />,
            action: () => setMode('user'),
          },
          {
            id: 'mode-dev',
            title: 'Audience Mode: Developer (Execution traces & raw policies)',
            category: 'Mode',
            icon: <Layers className="w-3.5 h-3.5 text-rose-400" />,
            action: () => setMode('developer'),
          },
        ]
      : [
          // User Mode: Calm, everyday non-technical commands
          {
            id: 'user-what-changed',
            title: 'Review recent changes across files',
            category: 'Commands',
            shortcut: 'Changes',
            icon: <RotateCcw className="w-3.5 h-3.5 text-forge-accent" />,
            action: async () => {
              setActiveBottomTab('flight');
              await analyzeWhatChanged();
            },
          },
          {
            id: 'user-fix',
            title: 'Find and fix issues in your files',
            category: 'Commands',
            shortcut: 'Fix',
            icon: <Activity className="w-3.5 h-3.5 text-forge-accent" />,
            action: async () => {
              await startProjectDiagnostics('.', 'Find and fix issues');
            },
          },
          {
            id: 'user-save-point',
            title: 'Save current state as a checkpoint',
            category: 'Commands',
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
            action: () => createHealthyCheckpoint(),
          },
          {
            id: 'user-undo',
            title: 'Undo changes (Restore safe state)',
            category: 'Commands',
            shortcut: 'Undo',
            icon: <RotateCcw className="w-3.5 h-3.5 text-amber-400" />,
            action: () => recoverDiagnosticProject(),
          },

          // Themes
          {
            id: 'theme-oled-dark',
            title: 'Appearance: Pitch OLED Dark',
            category: 'Themes',
            icon: <Moon className="w-3.5 h-3.5 text-purple-400" />,
            action: () => setPreset('oled-dark'),
          },
          {
            id: 'theme-oled-light',
            title: 'Appearance: Pitch OLED Light',
            category: 'Themes',
            icon: <SunMedium className="w-3.5 h-3.5 text-amber-400" />,
            action: () => setPreset('oled-light'),
          },

          // Mode
          {
            id: 'mode-dev',
            title: 'Switch to Developer View',
            category: 'Mode',
            icon: <Terminal className="w-3.5 h-3.5 text-forge-secondary" />,
            action: () => setMode('developer'),
          },
        ];

    // Append workspace files
    flatFiles.slice(0, 30).forEach((f) => {
      items.push({
        id: `file-${f.path}`,
        title: f.path,
        category: 'Files',
        shortcut: f.name.split('.').pop()?.toUpperCase(),
        icon: <FileCode className="w-3.5 h-3.5 text-forge-muted" />,
        action: () => openFile(f.path),
      });
    });

    return items;
  }, [
    isDev,
    flatFiles,
    runTestCheck,
    runBuildCheck,
    analyzeWhatChanged,
    createHealthyCheckpoint,
    setActiveBottomTab,
    setActiveLeftTab,
    setPreset,
    setMode,
    openFile,
    startProjectDiagnostics,
    recoverDiagnosticProject,
    setIsCompanionOpen,
  ]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  }, [allItems, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          selected.action();
          setIsCommandPaletteOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filtered, selectedIndex, setIsCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-start justify-center pt-20 p-4 select-none"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-xl bg-forge-panel border border-forge shadow-2xl overflow-hidden flex flex-col max-h-115 animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="h-12 px-3.5 border-b border-forge flex items-center gap-2.5 bg-forge-canvas shrink-0">
          <Search className="w-4 h-4 text-forge-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={isDev ? 'Type a command, filename, or theme...' : 'Search files or actions...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-xs text-forge-primary placeholder:text-forge-muted focus:outline-hidden font-mono"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-forge-elevated border border-forge text-forge-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar text-xs">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-forge-muted font-mono text-xs">
              No matching files or actions found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setIsCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-forge-accent text-white font-medium'
                      : 'text-forge-secondary hover:bg-forge-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isSelected ? 'text-white' : 'text-forge-muted'}>
                      {item.icon}
                    </span>
                    <span className="truncate font-mono text-[11px]">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-forge-elevated border border-forge text-forge-muted'
                      }`}
                    >
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-forge-elevated border border-forge text-forge-muted'
                        }`}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="h-7 px-3 bg-forge-canvas border-t border-forge flex items-center justify-between text-[10px] text-forge-muted font-mono shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Dismiss</span>
          </div>
          <span>MEMORAG Forge</span>
        </div>
      </div>
    </div>
  );
};
