'use client';

import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FadeContent, CountUp } from '@/components/reactbits';

export const UserHomeView: React.FC = () => {
  const {
    messages,
    tasks,
    approvals,
    sendMessage,
    resolveApproval,
  } = useRagnarok();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showThinking, setShowThinking] = useState(true);

  // Pending user attention (Approvals translated into calm language)
  const pendingApproval = approvals.find((a) => a.status === 'pending');
  const runningTasksCount = tasks.filter((t) => t.status === 'running').length;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    const text = input.trim();
    setInput('');
    setIsSending(true);
    try {
      await sendMessage(text, 'chat');
    } finally {
      setIsSending(false);
    }
  };

  const suggestions = [
    'Review my notes and summarize active goals',
    'Prepare a security checklist for local deployment',
    'Show verified facts and user preferences from memory',
  ];

  return (
    <div className="claude-chat-container max-w-4xl w-full mx-auto p-4 sm:p-8 space-y-7 transition-colors">
      {/* 1. Claude Editorial Welcome Header */}
      <div className="text-center pt-2 pb-1 space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#cc785c]/10 dark:bg-[#cc785c]/15 text-[#cc785c] dark:text-[#e08f75] text-xs font-medium border border-[#cc785c]/25 mb-1">
          <Laptop className="w-3.5 h-3.5 text-[#cc785c]" />
          <span>Sovereign Assistant • 100% On-Device &amp; Air-Gapped</span>
        </div>

        <h2 className="text-3xl sm:text-4xl text-[#141413] dark:text-[#faf9f5] tracking-tight font-normal font-serif [font-family:var(--claude-serif)]">
          How can I help you today?
        </h2>

        <p className="text-sm text-[#6c6a64] dark:text-[#a09d96] max-w-md mx-auto leading-relaxed">
          I remember verified context, plan multi-step workflows, and only carry out actions with your explicit permission.
        </p>
      </div>

      {/* 2. Floating Claude Input Box */}
      <FadeContent blur duration={400} delay={60} trigger="mount">
        <div className="rounded-2xl sm:rounded-3xl bg-surface dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-[#33312c] shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/20 transition-all p-2 sm:p-2.5">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question, query memory, or initiate a local task..."
              className="flex-1 bg-transparent border-0 px-4 py-3 text-sm text-[#141413] dark:text-[#faf9f5] placeholder-[#8e8b82] dark:placeholder-[#6c6a64] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs text-white bg-[#cc785c] hover:bg-[#a9583e] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              {isSending ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Ask MEMORAG</span>
            </button>
          </form>
        </div>
      </FadeContent>

      {/* 3. Claude Suggestion Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(suggestion)}
            className="px-3.5 py-1.5 rounded-full bg-[#f5f0e8]/80 dark:bg-[#252320] hover:bg-[#efe9de] dark:hover:bg-[#2d2b27] text-xs text-[#52504b] dark:text-[#c4c2bc] hover:text-[#141413] dark:hover:text-[#faf9f5] border border-[#e6dfd8] dark:border-[#33312c] transition-all duration-150 active:scale-98 flex items-center gap-1.5 cursor-pointer text-left"
          >
            <Sparkles className="w-3 h-3 text-[#cc785c] shrink-0" />
            <span>{suggestion}</span>
          </button>
        ))}
      </div>

      {/* 4. Claude Reasoning / Thinking Trace Block */}
      <FadeContent blur duration={350} trigger="mount">
        <div className="rounded-xl border border-[#e6dfd8] dark:border-[#33312c] bg-[#faf9f5] dark:bg-[#1c1b18] overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-4 py-2.5 flex items-center justify-between bg-[#f5f0e8]/50 dark:bg-[#22211d] text-[#6c6a64] dark:text-[#a09d96] hover:text-[#141413] dark:hover:text-[#faf9f5] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#cc785c] animate-pulse" />
              <span>Claude Reasoning Architecture &amp; Sovereign Verification</span>
              {isSending && <span className="text-[11px] font-mono text-[#cc785c]">(thinking...)</span>}
            </span>
            {showThinking ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showThinking && (
            <div className="p-4 space-y-2 font-mono text-[11px] text-[#52504b] dark:text-[#a09d96] bg-[#fdfcf9] dark:bg-[#181715] border-t border-[#e6dfd8] dark:border-[#33312c]">
              <div className="flex items-center gap-2 text-[#cc785c]">
                <span className="text-[#a9583e]">✦</span>
                <span>Context Injection: query_relevant_context() dispatched to local memory matrix.</span>
              </div>
              <div className="flex items-center gap-2 text-dim">
                <span>↳</span>
                <span>Synthesizing system prompt for local Ollama engine (gemma4:e2b) with AES-256-GCM verification.</span>
              </div>
              <div className="flex items-center gap-2 text-dim">
                <span>↳</span>
                <span>Outbound egress barrier: 0 bytes leaves loopback interface. Default-deny active.</span>
              </div>
            </div>
          )}
        </div>
      </FadeContent>

      {/* 5. Claude Attention / Approval Card */}
      {pendingApproval && (
        <FadeContent blur duration={300} trigger="mount">
          <div className="rounded-2xl border border-[#cc785c]/40 bg-[#fbf6f3] dark:bg-[#25201d] p-5 space-y-3.5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#cc785c]/15 text-[#cc785c] shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-semibold text-[#141413] dark:text-[#faf9f5] [font-family:var(--claude-serif)] text-base">
                    Can I go ahead with this step?
                  </h3>
                  <Badge variant="claude">Permission Required</Badge>
                </div>
                <p className="text-xs text-[#6c6a64] dark:text-[#a09d96] leading-relaxed">
                  I am preparing to{' '}
                  <strong className="text-[#141413] dark:text-[#faf9f5] font-medium">
                    {pendingApproval.actionTitle.toLowerCase()}
                  </strong>
                  . This will execute local workspace operations with side effects.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-[#cc785c]/20 flex items-center justify-end gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveApproval(pendingApproval.id, 'rejected', 'Declined by user')}
              >
                Don&apos;t allow
              </Button>
              <button
                type="button"
                onClick={() => resolveApproval(pendingApproval.id, 'approved')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-xl text-white bg-[#cc785c] hover:bg-[#a9583e] cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Allow Action</span>
              </button>
            </div>
          </div>
        </FadeContent>
      )}

      {/* 6. Recent Conversation Stream in Claude Editorial Bubbles */}
      {messages.length > 1 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6c6a64] dark:text-[#8e8b82] font-mono">
              Conversation History
            </h3>
            <span className="text-[11px] text-[#cc785c] font-mono">Claude Chat View</span>
          </div>

          <div className="space-y-3.5">
            {messages.slice(-4).map((msg) => {
              if (msg.role === 'system') return null;
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed transition-all ${
                      isUser
                        ? 'bg-[#f5f0e8] dark:bg-[#252320] text-[#141413] dark:text-[#faf9f5] border border-[#e6dfd8] dark:border-[#33312c] ml-auto rounded-tr-xs'
                        : 'bg-surface dark:bg-[#1f1e1b] text-[#141413] dark:text-[#faf9f5] border border-[#e6dfd8] dark:border-[#33312c] shadow-xs rounded-tl-xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-[#cc785c] text-xs font-serif [font-family:var(--claude-serif)]">
                        <span>✻</span>
                        <span className="font-medium">MEMORAG Assistant</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span
                      suppressHydrationWarning
                      className="block mt-2 text-[10px] text-[#8e8b82] dark:text-[#6c6a64] text-right font-mono"
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. What I'm Working On (Simplified Task Overview) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6c6a64] dark:text-[#8e8b82] font-mono">
            Active Multi-Step Tasks
          </h3>
          <span className="text-xs text-[#6c6a64] dark:text-[#8e8b82] inline-flex items-center gap-1 font-mono">
            <CountUp to={runningTasksCount} duration={0.6} />
            <span>in progress</span>
          </span>
        </div>

        <div className="space-y-2.5">
          {tasks.slice(0, 3).map((task) => {
            const isDone = task.status === 'completed';
            const isWaiting = task.status === 'awaiting_approval';
            const completedStepsCount = task.steps.filter((s) => s.status === 'completed').length;

            return (
              <FadeContent key={task.id} blur duration={300} trigger="mount">
                <div className="rounded-xl p-4 bg-surface dark:bg-[#1f1e1b] border border-[#e6dfd8] dark:border-[#33312c] hover:border-[#cc785c]/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#141413] dark:text-[#faf9f5]">
                          {task.goal}
                        </span>
                        <Badge
                          variant={
                            isDone ? 'emerald' : isWaiting ? 'amber' : 'claude'
                          }
                        >
                          {isDone
                            ? 'Finished'
                            : isWaiting
                            ? 'Needs permission'
                            : 'Working on it'}
                        </Badge>
                      </div>

                      <div className="text-xs text-[#6c6a64] dark:text-[#a09d96] flex items-center gap-2 pt-0.5">
                        <span>{task.steps.length} steps planned</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <CountUp to={completedStepsCount} duration={0.5} />
                          <span>completed</span>
                        </span>
                      </div>
                    </div>

                    <span
                      suppressHydrationWarning
                      className="text-xs text-[#8e8b82] dark:text-[#6c6a64] shrink-0 flex items-center gap-1 font-mono"
                    >
                      <Clock className="w-3 h-3 text-[#8e8b82]" />
                      {new Date(task.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </div>
  );
};
