'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Cpu, CheckCircle2 } from 'lucide-react';

export interface ThinkingTraceProps {
  thoughts: string[];
  isThinking?: boolean;
  elapsedSeconds?: number;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * AI Thinking State with a Reasoning Trace from Bencho (https://bencho.dev/blocks/thinking).
 * Hallmark hardened: Solid ink typography, tabular numbers, no gradient text or decorative glassmorphism.
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
      className={`rounded-xl border border-subtle bg-surface p-3.5 transition-colors duration-150 ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="group flex items-center gap-2 text-xs font-medium text-main cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-muted group-hover:text-main"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.div>

          <div className="flex items-center gap-1.5">
            <Cpu
              className={`w-3.5 h-3.5 ${
                isThinking ? 'text-accent animate-pulse' : 'text-emerald-500'
              }`}
            />
            {isThinking ? (
              <span className="font-semibold text-main">
                Synthesizing reasoning trace…
              </span>
            ) : (
              <span className="font-semibold text-main">
                Reasoning Trace Completed
              </span>
            )}
          </div>
        </button>

        {/* Runtime metric badge with tabular numbers */}
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-subtle bg-elevated px-2 py-0.5 font-mono tabular-nums text-[10px] text-muted">
            {isThinking ? 'streaming' : `${elapsedSeconds.toFixed(1)}s elapsed`}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted">
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
