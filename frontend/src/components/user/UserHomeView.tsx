'use client';

import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { BlurText, FadeContent, CountUp, StarBorder } from '@/components/reactbits';
import { ThinkingTrace } from '@/components/bencho';

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
    'Review my notes and make a list of what I need to do',
    'Help me prepare a checklist for the project submission',
    'Show me what you remember about my preferences',
  ];

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Calm Welcome Header with React Bits BlurText */}
      <div className="text-center pt-4 pb-2 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20 mb-2">
          <Laptop className="w-3.5 h-3.5" />
          <span>AI running on this device • Private &amp; secure</span>
        </div>

        <BlurText
          text="How can I help you today?"
          className="text-2xl sm:text-3xl font-semibold text-main tracking-tight justify-center"
          delay={40}
          animateBy="words"
          direction="top"
        />

        <p className="text-sm text-dim max-w-lg mx-auto">
          I remember useful context, organize tasks, and carry out steps on your computer with your permission.
        </p>
      </div>

      {/* Prominent Single Request Input wrapped in FadeContent */}
      <FadeContent blur duration={400} delay={100} trigger="mount">
        <Card className="p-2 shadow-lg border-medium hover:border-strong transition-all">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question or describe what you'd like me to do..."
              className="flex-1 bg-transparent border-0 px-4 py-3 text-sm text-main placeholder-faint focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isSending}
              disabled={!input.trim()}
              icon={<Send className="w-4 h-4" />}
              className="shrink-0 sm:self-center transition-transform active:scale-95"
            >
              Ask Ragnarok
            </Button>
          </form>
        </Card>
      </FadeContent>

      {/* Helpful Starters with subtle micro-interaction */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setInput(suggestion)}
            className="px-3.5 py-1.5 rounded-full bg-elevated hover:bg-subtle text-xs text-dim hover:text-main border border-subtle transition-all duration-150 active:scale-98 flex items-center gap-1.5 cursor-pointer text-left"
          >
            <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{suggestion}</span>
          </button>
        ))}
      </div>

      {/* Bencho Thinking Trace Component (https://bencho.dev/blocks/thinking) */}
      <FadeContent blur duration={350} trigger="mount">
        <ThinkingTrace
          thoughts={[
            "Ingesting local user intent and verifying sovereign prompt parameters...",
            "Retrieving verified semantic facts and user preferences via query_relevant_context()...",
            "Targeting local inference engine gemma4:e2b with zero outbound telemetry...",
            "Classified execution DAG: 3 steps mapped with default-deny security barrier.",
          ]}
          isThinking={isSending}
          elapsedSeconds={1.4}
        />
      </FadeContent>


      {/* Gentle Attention Card ("Can I go ahead?") with StarBorder on confirmation */}
      {pendingApproval && (
        <FadeContent blur duration={300} trigger="mount">
          <Card className="border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-main">
                    Can I go ahead with this step?
                  </h3>
                  <Badge variant="amber">Permission requested</Badge>
                </div>
                <p className="text-xs text-dim leading-relaxed">
                  I am preparing to{' '}
                  <strong className="text-main font-medium">
                    {pendingApproval.actionTitle.toLowerCase()}
                  </strong>
                  . This will update files in your project folder.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveApproval(pendingApproval.id, 'rejected', 'Declined by user in everyday mode')}
              >
                Don&apos;t allow
              </Button>
              <StarBorder
                as="button"
                onClick={() => resolveApproval(pendingApproval.id, 'approved')}
                color="#10b981"
                trailColor="rgba(16, 185, 129, 0.3)"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-xs active:scale-98 transition-transform"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Allow action</span>
              </StarBorder>
            </div>
          </Card>
        </FadeContent>
      )}

      {/* Recent Conversation / Exchange */}
      {messages.length > 1 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
            Recent conversation
          </h3>
          <div className="space-y-3">
            {messages.slice(-4).map((msg) => {
              if (msg.role === 'system') return null;
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-3.5 rounded-2xl max-w-xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-elevated text-main border border-medium ml-auto rounded-tr-xs'
                        : 'bg-surface text-main border border-subtle shadow-xs rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span
                      suppressHydrationWarning
                      className="block mt-1.5 text-[10px] text-faint text-right"
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

      {/* What I'm Working On (Simplified Task Overview) with CountUp */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
            What I&apos;m working on
          </h3>
          <span className="text-xs text-dim inline-flex items-center gap-1 font-mono">
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
                <Card className="p-4 hover:border-medium transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-main">
                          {task.goal}
                        </span>
                        <Badge
                          variant={
                            isDone ? 'emerald' : isWaiting ? 'amber' : 'sky'
                          }
                        >
                          {isDone
                            ? 'Finished'
                            : isWaiting
                            ? 'Needs permission'
                            : 'Working on it'}
                        </Badge>
                      </div>

                      <div className="text-xs text-dim flex items-center gap-2 pt-0.5">
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
                      className="text-xs text-faint shrink-0 flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3 text-faint" />
                      {new Date(task.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </Card>
              </FadeContent>
            );
          })}
        </div>
      </div>
    </div>
  );
};
