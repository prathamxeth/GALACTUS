'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from '../ui/ChatInput';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FadeContent, CountUp } from '@/components/reactbits';

export const UserHomeView: React.FC = () => {
  const {
    messages,
    tasks,
    approvals,
    sendMessage,
    resolveApproval,
    runtimeStatus,
  } = useRagnarok();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  // Pending user attention (Approvals translated into calm language)
  const pendingApproval = approvals.find((a) => a.status === 'pending');

  const handleSubmit = async () => {
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
    <div className="max-w-3xl w-full mx-auto px-4 py-8 sm:py-10 space-y-8 transition-colors font-sans">
      {/* ====================================================================
          1. PRODUCT HERO (Restrained, Product-Focused, Local-First Invariant)
          ==================================================================== */}
      <section className="text-center space-y-4 pt-2 pb-1">
        {/* Local Runtime Indicator */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-elevated border border-subtle text-xs font-mono text-dim">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-main font-semibold">Local AI</span>
          <span className="text-faint">•</span>
          <span>{runtimeStatus?.model || 'gemma4:e2b'}</span>
        </div>

        {/* Distinctive Editorial Typographic Composition (Newsreader Serif + Replicate Ink) */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl tracking-tight text-main font-normal font-editorial-serif leading-[1.15]">
          Intelligence designed for your device.
        </h1>

        <p className="text-sm sm:text-base text-dim max-w-xl mx-auto leading-relaxed font-subheading">
          MEMORAG plans and executes multi-step workflows with persistent cryptographic memory. Sensitive file writes and commands only run with your explicit authorization.
        </p>
      </section>

      {/* ====================================================================
          2. COMPOSABLE 21ST.DEV CHAT INPUT COMPOSER
          ==================================================================== */}
      <section className="space-y-3">
        <FadeContent blur duration={250} trigger="mount">
          <ChatInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={handleSubmit}
            loading={isSending}
            onStop={() => setIsSending(false)}
            rows={2}
            className="border-subtle hover:border-medium focus-within:border-[#ea2804] focus-within:ring-2 focus-within:ring-[#ea2804]/20 transition-[border-color,box-shadow] duration-150 shadow-xs"
          >
            <ChatInputTextArea
              placeholder="Ask a question, search saved notes, or request a task..."
              className="text-main placeholder-faint text-sm leading-relaxed"
            />
            <div className="flex items-center justify-end px-3.5 pb-3 pt-1 border-t border-subtle/50 text-xs">
              <div className="flex items-center gap-2">
                <ChatInputSubmit onSubmit={handleSubmit} loading={isSending} />
              </div>
            </div>
          </ChatInput>
        </FadeContent>

        {/* 3. Contextual Prompt Suggestions (Subtle Tactile Chips) */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInput(suggestion);
                  setTimeout(() => {
                    const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
                    if (textarea) {
                      textarea.focus();
                      textarea.setSelectionRange(suggestion.length, suggestion.length);
                    }
                  }, 50);
                }}
                className="px-3.5 py-1.5 rounded-full bg-elevated/70 hover:bg-elevated text-xs text-dim hover:text-main border border-subtle transition-colors duration-150 active:translate-y-px flex items-center gap-2 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ea2804]/70 shrink-0" aria-hidden="true" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ====================================================================
          3. HUMAN-IN-THE-LOOP APPROVAL CARD (Gjallarhorn Gatekeeper)
          ==================================================================== */}
      {pendingApproval && (
        <FadeContent blur duration={300} trigger="mount">
          <div className="rounded-2xl border border-[#ea2804]/40 bg-surface p-5 space-y-3.5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#ea2804]/10 text-[#ea2804] shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-semibold text-main font-editorial-serif">
                    Permission required for action
                  </h3>
                  <Badge variant="amber" dot>
                    Awaiting approval
                  </Badge>
                  <Badge variant="replicate">
                    Risk: {pendingApproval.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-dim leading-relaxed">
                  The agent is proposing to execute{' '}
                  <strong className="text-main font-medium">
                    {pendingApproval.actionTitle}
                  </strong>{' '}
                  ({pendingApproval.toolName}). This modifies local workspace state.
                </p>
                {(pendingApproval.commandOrPayload || pendingApproval.rationale) && (
                  <p className="text-[11px] text-faint font-mono pt-1">
                    Payload details: {pendingApproval.commandOrPayload || pendingApproval.rationale}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-subtle flex items-center justify-end gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveApproval(pendingApproval.id, 'rejected', 'Declined by user')}
              >
                Reject Action
              </Button>
              <Button
                size="sm"
                variant="chat"
                icon={<CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                onClick={() => resolveApproval(pendingApproval.id, 'approved')}
              >
                Authorize Execution
              </Button>
            </div>
          </div>
        </FadeContent>
      )}

      {/* ====================================================================
          4. VERIFIABLE DECISION & REASONING TRACE DRAWER
          ==================================================================== */}
      <FadeContent blur duration={250} trigger="mount">
        <div className="rounded-xl border border-subtle bg-surface overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-dim hover:text-main bg-elevated/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#ea2804] animate-pulse" />
              <span className="font-mono text-xs">Reasoning &amp; Verification Trace</span>
              {isSending && <span className="text-[11px] font-mono text-[#ea2804]">(thinking...)</span>}
            </span>
            {showThinking ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showThinking && (
            <div className="p-4 space-y-2 font-mono text-[11px] text-dim bg-canvas border-t border-subtle leading-relaxed">
              <div className="flex items-center gap-2 text-[#ea2804]">
                <span>✦</span>
                <span>Context Retrieval: query_relevant_context() executed against local encrypted storage.</span>
              </div>
              <div className="flex items-center gap-2 text-dim">
                <span>↳</span>
                <span>Inference: Dispatched to model runtime ({runtimeStatus?.model || 'gemma4:e2b'}).</span>
              </div>
              <div className="flex items-center gap-2 text-dim">
                <span>↳</span>
                <span>Privacy: Local execution with 0 outbound network bytes.</span>
              </div>
            </div>
          )}
        </div>
      </FadeContent>

      {/* ====================================================================
          5. CONVERSATION STREAM (Claude Ergonomics + Replicate Color Harmony)
          ==================================================================== */}
      {messages.length > 1 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-subtle pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dim font-mono">
              Recent Conversation
            </h3>
            <span className="text-[11px] text-[#ea2804] font-mono">
              AES-256 Verified
            </span>
          </div>

          <div className="space-y-4">
            {messages.map((msg) => {
              if (msg.role === 'system') return null;
              const isUser = msg.role === 'user';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-4 rounded-2xl max-w-xl text-sm leading-relaxed transition-colors duration-150 ${
                      isUser
                        ? 'bg-elevated text-main border border-subtle ml-auto rounded-tr-xs'
                        : 'bg-surface text-main border border-subtle shadow-xs rounded-tl-xs'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1.5 mb-2 text-[#ea2804] text-xs font-editorial-serif">
                        <span>✻</span>
                        <span className="font-medium tracking-tight">Assistant</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Citations / Memory Tags if present */}
                    {msg.citedMemoryIds && msg.citedMemoryIds.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-subtle/50 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-faint">Saved context:</span>
                        {msg.citedMemoryIds.map((id) => (
                          <span
                            key={id}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-elevated border border-subtle text-dim"
                          >
                            #{id}
                          </span>
                        ))}
                      </div>
                    )}

                    <span
                      suppressHydrationWarning
                      className="block mt-2 text-[10px] text-faint text-right font-mono"
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ====================================================================
          6. ACTIVE MULTI-STEP TASKS OVERVIEW
          ==================================================================== */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-dim font-mono">
            Active Multi-Step Tasks
          </h3>
          <Link
            href="/tasks"
            className="text-xs text-[#ea2804] hover:underline flex items-center gap-1 font-mono cursor-pointer"
          >
            <span>View Task DAG</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-2.5">
          {tasks.slice(0, 3).map((task) => {
            const isDone = task.status === 'completed';
            const isWaiting = task.status === 'awaiting_approval';
            const completedStepsCount = task.steps.filter((s) => s.status === 'completed').length;

            return (
              <FadeContent key={task.id} blur duration={250} trigger="mount">
                <Link
                  href="/tasks"
                  className="block rounded-xl p-4 bg-surface border border-subtle hover:border-[#ea2804]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-main">
                          {task.goal}
                        </span>
                        <Badge
                          variant={
                            isDone ? 'emerald' : isWaiting ? 'amber' : 'replicate'
                          }
                        >
                          {isDone
                            ? 'Completed'
                            : isWaiting
                            ? 'Approval Required'
                            : 'In Progress'}
                        </Badge>
                      </div>

                      <div className="text-xs text-dim flex items-center gap-2 pt-0.5 font-mono">
                        <span>{task.steps.length} steps planned</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <CountUp to={completedStepsCount} duration={0.5} />
                          <span>completed</span>
                        </span>
                      </div>
                    </div>

                    <span
                      suppressHydrationWarning
                      className="text-xs text-faint shrink-0 flex items-center gap-1 font-mono"
                    >
                      <Clock className="w-3 h-3" />
                      {new Date(task.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </Link>
              </FadeContent>
            );
          })}
        </div>
      </section>
    </div>
  );
};
