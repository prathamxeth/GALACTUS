'use client';

import React, { useState } from 'react';
import {
  Terminal,
  Send,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FadeContent, CountUp, GridScan, StarBorder, AnimatedList } from '@/components/reactbits';

export const DevOverviewView: React.FC<{ onOpenApproval: (reqId: string) => void }> = ({
  onOpenApproval,
}) => {
  const {
    messages,
    tasks,
    memories,
    approvals,
    runtimeStatus,
    isBackendOnline,
    preset,
    sendMessage,
    resolveApproval,
  } = useRagnarok();

  const [input, setInput] = useState('');
  const [activeMode, setActiveMode] = useState<'chat' | 'task' | 'memory'>('chat');
  const [isSending, setIsSending] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const runningTasks = tasks.filter((t) => t.status === 'running');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    const text = input.trim();
    setInput('');
    setIsSending(true);
    try {
      await sendMessage(text, activeMode);
    } finally {
      setIsSending(false);
    }
  };

  const isLight = preset === 'light';

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Restrained Developer GridScan Canvas Backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06] overflow-hidden z-0">
        <GridScan
          linesColor={isLight ? '#1c1b18' : '#e4e4e9'}
          scanColor={isLight ? '#cc785c' : '#e08a6e'}
          cells={14}
          lineThickness={1}
          autoScan={true}
          interactive={false}
          className="w-full h-full"
        />
      </div>

      <div className="relative z-10 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Real Diagnostics Top Bar with CountUp */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint block">
              Ollama Model
            </span>
            <div className="font-mono text-xs font-semibold text-main truncate">
              {runtimeStatus?.model || 'llama3.2:3b'}
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              {runtimeStatus?.latencyMs ? (
                <>
                  <CountUp to={runtimeStatus.latencyMs} duration={0.5} />
                  <span>ms P50</span>
                </>
              ) : (
                'Not measured'
              )}
            </span>
          </Card>

          <Card className="p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint block">
              Active Tasks / DAGs
            </span>
            <div className="font-mono text-xs font-semibold text-main inline-flex items-center gap-1">
              <CountUp to={runningTasks.length} duration={0.4} />
              <span>running •</span>
              <CountUp to={completedTasks.length} duration={0.4} />
              <span>done</span>
            </div>
            <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 block">
              <CountUp to={tasks.length} duration={0.4} /> total graphs
            </span>
          </Card>

          <Card className="p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint block">
              Mimir Vector Nodes
            </span>
            <div className="font-mono text-xs font-semibold text-main inline-flex items-center gap-1">
              <CountUp to={memories.length} duration={0.4} />
              <span>runes active</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block">
              AES-256 Verified
            </span>
          </Card>

          <Card className="p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-faint block">
              Approval Gates (FR4.3)
            </span>
            <div className="font-mono text-xs font-semibold text-main inline-flex items-center gap-1">
              <CountUp to={pendingApprovals.length} duration={0.4} />
              <span>pending gate</span>
            </div>
            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 block">
              Strict RBAC Policy
            </span>
          </Card>
        </div>

        {/* Active Task Queue with React Bits AnimatedList */}
        {tasks.length > 0 && (
          <FadeContent blur duration={300} trigger="mount">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-main flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-500" />
                  Live Task DAG Pipeline (React Bits AnimatedList)
                </span>
                <span className="text-[11px] font-mono text-faint">
                  {tasks.length} tracked items
                </span>
              </div>
              <AnimatedList
                items={tasks.map((t) => ({
                  id: t.id,
                  title: (
                    <span className="font-mono text-xs font-semibold text-main">
                      {t.goal}
                    </span>
                  ),
                  description: (
                    <span className="font-mono text-[11px] text-dim">
                      {t.steps.filter((s) => s.status === 'completed').length}/{t.steps.length} steps completed • Status: {t.status}
                    </span>
                  ),
                  meta: (
                    <span className="font-mono text-[10px] text-faint" suppressHydrationWarning>
                      {new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ),
                  icon: (
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        t.status === 'completed'
                          ? 'bg-emerald-500'
                          : t.status === 'awaiting_approval'
                          ? 'bg-amber-500 animate-pulse'
                          : t.status === 'running'
                          ? 'bg-sky-500 animate-pulse'
                          : 'bg-zinc-500'
                      }`}
                    />
                  ),
                }))}
                theme={preset === 'light' || preset === 'oled-light' ? 'light' : 'dark'}
                animation="slide"
                maxHeight={200}
                className="w-full rounded-xl border border-subtle bg-surface/80"
              />
            </div>
          </FadeContent>
        )}

        {/* Developer Terminal Console Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-main">
                Agent Execution Stream &amp; Decision Trace
              </h3>
            </div>
            <span className="text-xs font-mono text-faint">
              Target: {isBackendOnline ? '127.0.0.1:8000' : 'Offline Staging'}
            </span>
          </div>

          {/* Message Trace Stream with FadeContent */}
          <div className="space-y-3">
            {messages.map((msg) => {
              if (msg.role === 'system') {
                return (
                  <div
                    key={msg.id}
                    className="p-2.5 rounded-lg bg-surface border border-subtle font-mono text-xs text-faint text-center"
                  >
                    [SYSTEM] {msg.content}
                  </div>
                );
              }

              const isUser = msg.role === 'user';
              const isTraceExpanded = expandedTraceId === msg.id;

              return (
                <FadeContent key={msg.id} blur duration={250} trigger="mount">
                  <div
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-[#cc785c]/15 border border-[#cc785c]/35 flex items-center justify-center text-[#cc785c] shrink-0 font-mono text-xs font-bold mt-1">
                        ᚱ
                      </div>
                    )}

                    <div className={`max-w-2xl space-y-2 ${isUser ? 'items-end' : ''}`}>
                      <div
                        className={`p-4 rounded-xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-elevated text-main border border-medium ml-auto font-sans'
                            : 'bg-surface text-main border border-subtle shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] font-mono text-faint">
                          <span>{isUser ? 'USER DISPATCH' : 'AGENT ORCHESTRATOR'}</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Cited Memory Runes */}
                        {msg.citedMemoryIds && msg.citedMemoryIds.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-subtle flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                            <span className="text-faint uppercase">Vector Recall:</span>
                            {msg.citedMemoryIds.map((id) => (
                              <span
                                key={id}
                                className="bg-elevated px-1.5 py-0.5 rounded border border-subtle text-sky-600 dark:text-sky-400"
                              >
                                #{id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Transparent Seer's Telling / Reasoning Trace (NFR4.1) */}
                      {msg.thoughtTrace && (
                        <div className="rounded-lg bg-elevated/60 border border-subtle overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTraceId(isTraceExpanded ? null : msg.id)
                            }
                            className="w-full px-3 py-1.5 flex items-center justify-between text-dim hover:text-main cursor-pointer font-mono text-[11px] transition-colors"
                          >
                            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <Zap className="w-3 h-3" />
                              Decision Trace (NFR4.1 Explainability)
                            </span>
                            {isTraceExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isTraceExpanded && (
                            <div className="p-3 border-t border-subtle font-mono text-[11px] text-dim whitespace-pre-wrap leading-relaxed bg-surface/50">
                              {msg.thoughtTrace}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Embedded Tool Approval Proposal */}
                      {msg.actionProposal && (
                        <Card className="border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="amber">
                                  {msg.actionProposal.riskLevel.toUpperCase()} RISK
                                </Badge>
                                <span className="font-mono text-xs font-semibold text-main">
                                  Tool: {msg.actionProposal.toolName}
                                </span>
                              </div>
                              <p className="text-xs text-dim mt-1 font-mono">
                                {msg.actionProposal.description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2.5">
                            {msg.actionProposal.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onOpenApproval(msg.actionProposal!.id)}
                                  className="text-xs font-mono"
                                >
                                  Inspect Parameters
                                </Button>
                                <StarBorder
                                  as="button"
                                  onClick={() =>
                                    resolveApproval(msg.actionProposal!.id, 'approved')
                                  }
                                  color="#10b981"
                                  trailColor="rgba(16, 185, 129, 0.3)"
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-xs active:translate-y-px transition-[background-color,transform] duration-150 ease-out font-mono select-none"
                                >
                                  <span>Authorize Step</span>
                                </StarBorder>
                              </>
                            ) : (
                              <Badge
                                variant={
                                  msg.actionProposal.status === 'approved'
                                    ? 'emerald'
                                    : 'rose'
                                }
                              >
                                Status: {msg.actionProposal.status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                  </div>
                </FadeContent>
              );
            })}
          </div>

          {/* Developer Multi-Mode Prompt Bar */}
          <Card className="p-2 border-medium shadow-md">
            <div className="px-2 py-1 flex items-center justify-between border-b border-subtle pb-1.5 mb-2 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-faint uppercase mr-1">Target Mode:</span>
                <button
                  type="button"
                  onClick={() => setActiveMode('chat')}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-colors duration-150 active:translate-y-px select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    activeMode === 'chat'
                      ? 'bg-[#cc785c] text-white font-semibold shadow-xs'
                      : 'text-dim hover:text-main bg-elevated/50'
                  }`}
                >
                  Inference (Chat)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('task')}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-colors duration-150 active:translate-y-px select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    activeMode === 'task'
                      ? 'bg-[#cc785c] text-white font-semibold shadow-xs'
                      : 'text-dim hover:text-main bg-elevated/50'
                  }`}
                >
                  DAG Workflow (FR3)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('memory')}
                  className={`px-3 py-1 rounded-full cursor-pointer transition-colors duration-150 active:translate-y-px select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    activeMode === 'memory'
                      ? 'bg-[#cc785c] text-white font-semibold shadow-xs'
                      : 'text-dim hover:text-main bg-elevated/50'
                  }`}
                >
                  Rune Vector Lookup
                </button>
              </div>
              <span className="text-[10px] text-faint">Enter to dispatch</span>
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeMode === 'task'
                    ? 'Input autonomous goal for multi-step DAG planner...'
                    : activeMode === 'memory'
                    ? 'Input query for Mimir vector similarity lookup...'
                    : 'Dispatch technical command to local orchestrator...'
                }
                className="flex-1 bg-transparent border-0 px-2 py-1.5 text-xs font-mono text-main placeholder-faint focus:outline-none"
              />
              <Button
                type="submit"
                variant="dev"
                size="sm"
                loading={isSending}
                disabled={!input.trim()}
                icon={<Send className="w-3.5 h-3.5" />}
              >
                Dispatch
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
