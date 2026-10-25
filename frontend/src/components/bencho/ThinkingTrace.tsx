'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';

export interface ThinkingTraceProps {
  thoughts: string[];
  isThinking?: boolean;
  elapsedSeconds?: number;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * AI Thinking State with a Reasoning Trace from Bencho (https://bencho.dev/blocks/thinking).
 * Displays an assistant thinking out loud: reasoning steps arrive chronologically,
 * then fold into a compact summary line with duration metrics that can be expanded.
 */
export function ThinkingTrace({
  thoughts,
  isThinking = false,
  elapsedSeconds = 1.4,
  className = '',
  defaultExpanded = true,
}: ThinkingTraceProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      className={`rounded-xl border border-border-subtle bg-bg-surface/80 p-3.5 backdrop-blur-md transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="group flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer select-none"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-text-muted group-hover:text-text-primary"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.div>

          <div className="flex items-center gap-1.5">
            <Sparkles
              className={`w-3.5 h-3.5 ${
                isThinking ? 'text-accent-primary animate-pulse' : 'text-emerald-400'
              }`}
            />
            {isThinking ? (
              <span className="font-semibold bg-gradient-to-r from-accent-primary via-indigo-300 to-accent-primary bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_2s_linear_infinite]">
                Synthesizing sovereign reasoning...
              </span>
            ) : (
              <span className="font-semibold text-text-primary">
                Reasoning Trace Completed
              </span>
            )}
          </div>
        </button>

        {/* Runtime metric badge */}
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-muted">
            {isThinking ? 'streaming' : `${elapsedSeconds.toFixed(1)}s elapsed`}
          </span>
          <span className="text-[11px] font-mono text-text-muted">
            {thoughts.length} {thoughts.length === 1 ? 'step' : 'steps'}
          </span>
        </div>
      </div>

      {/* Collapsible reasoning list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 border-t border-border-subtle pt-2.5">
              {thoughts.map((thought, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.2 }}
                  className="flex items-start gap-2 text-xs leading-relaxed text-text-muted hover:text-text-primary transition-colors"
                >
                  <div className="mt-1 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-accent-primary" />
                  </div>
                  <span className="font-mono text-[11px] text-accent-primary select-none">
                    0{index + 1}
                  </span>
                  <span>{thought}</span>
                </motion.div>
              ))}

              {isThinking && (
                <div className="flex items-center gap-2 text-xs text-text-muted italic animate-pulse pt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-ping" />
                  <span>Evaluating sovereign constraints & local memory...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
