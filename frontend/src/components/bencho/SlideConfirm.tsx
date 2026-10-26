'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Check, ArrowRight } from 'lucide-react';

export interface SlideConfirmProps {
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmedLabel?: string;
  disabled?: boolean;
  className?: string;
  width?: number;
}

/**
 * Slide to Confirm Button from Bencho (https://bencho.dev/blocks/slide-confirm).
 * Features progressive tactile drag resistance, threshold completion takeover,
 * animated track fill wash, and morphing confirmation feedback.
 */
export function SlideConfirm({
  onConfirm,
  label = 'Slide to authorize',
  confirmedLabel = 'Authorized',
  disabled = false,
  className = '',
  width = 280,
}: SlideConfirmProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHeld, setIsHeld] = useState(false);

  const trackWidth = Math.max(220, Math.min(380, width));
  const gripSize = 44;
  const padding = 4;
  const maxDrag = trackWidth - gripSize - padding * 2;
  const threshold = maxDrag * 0.75;

  const dragX = useMotionValue(0);
  const washWidth = useTransform(dragX, (x) => Math.max(0, x + gripSize));
  const textOpacity = useTransform(dragX, [0, maxDrag * 0.4], [1, 0.15]);

  const pointerCleanups = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      pointerCleanups.current?.();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isConfirmed || isSubmitting) return;

    setIsHeld(true);
    const startClientX = e.clientX;
    const initialDragX = dragX.get();

    const onMove = (moveEvt: PointerEvent) => {
      const delta = moveEvt.clientX - startClientX;
      const nextX = Math.max(0, Math.min(maxDrag, initialDragX + delta));
      dragX.set(nextX);
    };

    const onUp = async () => {
      pointerCleanups.current?.();
      setIsHeld(false);

      if (dragX.get() >= threshold) {
        // Complete the slide smoothly
        animate(dragX, maxDrag, {
          type: 'spring',
          stiffness: 400,
          damping: 30,
        });
        setIsConfirmed(true);
        setIsSubmitting(true);
        try {
          await onConfirm();
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // Snap back
        animate(dragX, 0, {
          type: 'spring',
          stiffness: 500,
          damping: 35,
        });
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    pointerCleanups.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      pointerCleanups.current = null;
    };
  };

  const reset = () => {
    animate(dragX, 0, { duration: 0.2 });
    setIsConfirmed(false);
    setIsSubmitting(false);
  };

  return (
    <div
      className={`relative select-none overflow-hidden rounded-xl border border-border-subtle bg-bg-surface ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
      style={{ width: trackWidth, height: 52 }}
      data-held={isHeld || undefined}
    >
      {/* Background Track Wash */}
      <motion.div
        className="absolute top-1 bottom-1 left-1 rounded-lg bg-emerald-500/20"
        style={{ width: washWidth }}
      />

      {/* Track Label */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold tracking-wider uppercase text-text-muted transition-colors"
        style={{ opacity: textOpacity }}
      >
        {label}
      </motion.div>

      {/* Confirmed State Overlay */}
      {isConfirmed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 z-10"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{confirmedLabel}</span>
          <button
            type="button"
            onClick={reset}
            className="ml-2 text-[10px] text-text-muted hover:text-text-primary underline cursor-pointer"
          >
            Reset
          </button>
        </motion.div>
      )}

      {/* Draggable Grip Handle */}
      {!isConfirmed && (
        <motion.button
          type="button"
          onPointerDown={handlePointerDown}
          style={{ x: dragX }}
          className={`absolute top-1 left-1 h-11 w-11 rounded-lg border border-border-subtle flex items-center justify-center z-20 cursor-grab active:cursor-grabbing transition-shadow ${
            isHeld
              ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-105'
              : 'bg-bg-elevated text-text-primary hover:bg-bg-elevated/80'
          }`}
          aria-label={label}
        >
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      )}
    </div>
  );
}
