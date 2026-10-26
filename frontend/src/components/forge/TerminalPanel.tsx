'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';

export const TerminalPanel: React.FC = () => {
  const {
    terminalHistory,
    isExecutingCommand,
    runTerminalCommand,
    clearTerminal,
  } = useForge();

  const [inputCommand, setInputCommand] = useState('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputCommand.trim();
    if (!cmd || isExecutingCommand) return;
    setInputCommand('');
    await runTerminalCommand(cmd);
  };

  const handleQuickRun = async (cmd: string) => {
    if (isExecutingCommand) return;
    await runTerminalCommand(cmd);
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden font-mono text-xs select-text">
      {/* Terminal Toolbar */}
      <div className="h-8 px-3 bg-canvas border-b border-subtle flex items-center justify-between text-muted select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-main font-semibold text-[11px]">
            <TerminalIcon className="w-3.5 h-3.5 text-[#cc785c]" />
            <span>Bounded Command Runner</span>
          </div>

          <span className="text-[10px] text-muted">
            (Batch execution • 25s timeout • non-interactive)
          </span>
        </div>

        {/* Quick action buttons & Clear */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted mr-1">Quick Run:</span>
          <button
            onClick={() => handleQuickRun('npm test')}
            disabled={isExecutingCommand}
            className="px-1.5 py-0.5 rounded text-[10px] bg-elevated border border-subtle hover:border-emerald-500/50 hover:text-emerald-500 transition-colors disabled:opacity-40"
          >
            npm test
          </button>
          <button
            onClick={() => handleQuickRun('npm run build')}
            disabled={isExecutingCommand}
            className="px-1.5 py-0.5 rounded text-[10px] bg-elevated border border-subtle hover:border-blue-500/50 hover:text-blue-500 transition-colors disabled:opacity-40"
          >
            npm run build
          </button>
          <button
            onClick={() => handleQuickRun('git status')}
            disabled={isExecutingCommand}
            className="px-1.5 py-0.5 rounded text-[10px] bg-elevated border border-subtle hover:border-amber-500/50 hover:text-amber-500 transition-colors disabled:opacity-40"
          >
            git status
          </button>
          <button
            onClick={() => handleQuickRun('git diff --stat')}
            disabled={isExecutingCommand}
            className="px-1.5 py-0.5 rounded text-[10px] bg-elevated border border-subtle hover:border-purple-500/50 hover:text-purple-400 transition-colors disabled:opacity-40"
          >
            git diff
          </button>

          <div className="h-3 w-px bg-subtle mx-1" />

          <button
            onClick={clearTerminal}
            className="p-1 rounded text-muted hover:text-main hover:bg-elevated transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Log Area */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-canvas/30">
        {terminalHistory.length === 0 ? (
          <div className="text-muted text-[11px] space-y-1">
            <div className="text-secondary font-medium">MEMORAG Forge Constrained Execution Shell</div>
            <div className="text-[10px] text-muted">
              Commands are executed locally on this host via a loopback-bound process.
            </div>
            <div className="text-[10px] text-muted">
              Allowlisted binaries: <code className="text-[#cc785c]">npm, npx, node, git, pytest, python3, ls, pwd</code>.
            </div>
            <div className="text-[10px] text-muted">
              Output buffer capped at 1MB • 25s execution timeout.
            </div>
          </div>
        ) : (
          terminalHistory.map((item, idx) => (
            <div key={idx} className="space-y-1">
              {/* Command Prompt Line */}
              <div className="flex items-center justify-between text-secondary">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="text-[#F04424] font-semibold">forge:~/{item.cwd || 'GALACTUS'} $</span>
                  <span className="text-main font-semibold">{item.command}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted">
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {item.durationMs}ms
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1 rounded text-[9px] font-bold ${
                      item.exitCode === 0
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    {item.exitCode === 0 ? (
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    ) : (
                      <XCircle className="w-2.5 h-2.5" />
                    )}
                    exit {item.exitCode}
                  </span>
                </div>
              </div>

              {/* Stdout Output */}
              {item.stdout && (
                <pre className="text-[11px] text-secondary leading-5 whitespace-pre-wrap pl-3 border-l-2 border-subtle">
                  {item.stdout}
                </pre>
              )}

              {/* Stderr Output */}
              {item.stderr && (
                <pre className="text-[11px] text-rose-400 leading-5 whitespace-pre-wrap pl-3 border-l-2 border-rose-500/50 bg-rose-500/5 py-1">
                  {item.stderr}
                </pre>
              )}
            </div>
          ))
        )}

        {isExecutingCommand && (
          <div className="flex items-center gap-2 text-muted text-[11px] pl-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#ea2804] animate-ping" />
            <span>Executing command within sandbox...</span>
          </div>
        )}

        <div ref={outputEndRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="h-9 px-3 bg-canvas border-t border-subtle flex items-center gap-2 shrink-0 select-none"
      >
        <span className="text-[#ea2804] font-bold text-xs">❯</span>
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          disabled={isExecutingCommand}
          placeholder="Run approved command (e.g. npm test, npm run build, git status)..."
          className="flex-1 bg-transparent text-xs text-main placeholder:text-muted focus:outline-hidden font-mono"
        />
        <button
          type="submit"
          disabled={!inputCommand.trim() || isExecutingCommand}
          className="p-1 rounded text-muted hover:text-main hover:bg-elevated transition-colors disabled:opacity-30"
          title="Run command"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
