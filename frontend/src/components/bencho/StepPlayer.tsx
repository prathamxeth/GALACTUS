'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Pause, ChevronRight, Check } from 'lucide-react';

export interface StepItem {
  id: string;
  title: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED_APPROVAL' | 'COMPLETED' | 'FAILED' | string;
}

export interface StepPlayerProps {
  steps: StepItem[];
  currentStepIndex?: number;
  onSelectStep?: (index: number) => void;
  className?: string;
}

/**
 * Step Progress Indicator from Bencho (https://bencho.dev/blocks/step-player).
 * Features animated dot-to-dot tracking, step progress fill, and interactive
 * step inspection for multi-stage autonomous task execution.
 */
export function StepPlayer({
  steps,
  currentStepIndex = 0,
  onSelectStep,
  className = '',
}: StepPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(currentStepIndex);
  const [prevIndex, setPrevIndex] = useState(currentStepIndex);
  const [isPlaying, setIsPlaying] = useState(false);

  if (prevIndex !== currentStepIndex) {
    setPrevIndex(currentStepIndex);
    setActiveIdx(currentStepIndex);
  }

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && steps.length > 0) {
      timer = setInterval(() => {
        setActiveIdx((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onSelectStep?.(next);
          return next;
        });
      }, 1600);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, steps.length, onSelectStep]);

  if (!steps || steps.length === 0) {
    return null;
  }

  const activeStep = steps[activeIdx] || steps[0];

  return (
    <div
      className={`rounded-xl border border-border-subtle bg-bg-surface p-4 ${className}`}
    >
      {/* Control row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated text-text-primary hover:bg-accent-primary hover:text-white transition-colors duration-150 active:translate-y-px cursor-pointer"
            aria-label={isPlaying ? 'Pause timeline playback' : 'Play timeline'}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" />
            )}
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-primary tabular-nums">
            DAG Step {activeIdx + 1} of {steps.length}
          </span>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            activeStep.status === 'COMPLETED'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : activeStep.status === 'RUNNING'
              ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20 animate-pulse'
              : activeStep.status === 'PAUSED_APPROVAL'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-bg-elevated text-text-muted border border-border-subtle'
          }`}
        >
          {activeStep.status}
        </span>
      </div>

      {/* Step Dots & Connecting Tracks */}
      <div className="relative flex items-center justify-between py-2">
        {/* Background Track Bar */}
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1 bg-border-subtle rounded-full z-0" />

        {/* Active Progress Bar */}
        <motion.div
          className="absolute left-2 top-1/2 -translate-y-1/2 h-1 bg-accent-primary rounded-full z-0"
          initial={false}
          animate={{
            width: `${(activeIdx / Math.max(1, steps.length - 1)) * 96}%`,
          }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />

        {steps.map((step, idx) => {
          const isDone = idx < activeIdx || step.status === 'COMPLETED';
          const isCurrent = idx === activeIdx;

          return (
            <button
              key={step.id || idx}
              type="button"
              onClick={() => {
                setActiveIdx(idx);
                onSelectStep?.(idx);
              }}
              className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-[background-color,border-color,color] duration-150 cursor-pointer ${
                isCurrent
                  ? 'border-accent-primary bg-accent-primary text-white ring-2 ring-accent-primary/30 ring-offset-1 ring-offset-bg-surface'
                  : isDone
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : 'border-border-subtle bg-bg-elevated text-text-muted hover:border-text-muted'
              }`}
            >
              {isDone ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <span className="font-mono text-[10px] font-bold tabular-nums">{idx + 1}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Step Details */}
      <div className="mt-3 flex items-center justify-between text-xs border-t border-border-subtle/50 pt-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
          <span className="font-medium text-text-primary truncate">
            {activeStep.title}
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-muted flex-shrink-0">
          ID: {activeStep.id.slice(0, 10)}
        </span>
      </div>
    </div>
  );
}
