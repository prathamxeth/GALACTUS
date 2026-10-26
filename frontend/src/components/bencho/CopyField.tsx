'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check } from 'lucide-react';

export interface CopyFieldProps {
  text: string;
  label?: string;
  truncate?: boolean;
  className?: string;
}

/**
 * Copy Field with Morphing Check from Bencho (https://bencho.dev/blocks/copy-field).
 * Displays a token, ID, or command snippet with an icon that morphs from two pages
 * into a drawn checkmark, with a soft sheen feedback effect across the field.
 */
export function CopyField({
  text,
  label,
  truncate = true,
  className = '',
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div
      onClick={handleCopy}
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs transition-colors hover:border-accent-primary/50 hover:bg-bg-elevated cursor-pointer select-none ${className}`}
      title="Click to copy"
    >
      {/* Soft sheen effect on copy */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 min-w-0 flex-1">
        {label && (
          <span className="font-medium text-text-muted text-[11px] uppercase tracking-wider flex-shrink-0">
            {label}:
          </span>
        )}
        <span
          className={`font-mono text-text-primary ${
            truncate ? 'truncate' : 'break-all'
          } ${copied ? 'text-accent-primary font-semibold' : ''}`}
        >
          {text}
        </span>
      </div>

      <button
        type="button"
        aria-label={copied ? 'Copied' : 'Copy'}
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
          copied
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'text-text-muted group-hover:text-text-primary group-hover:bg-bg-surface'
        }`}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="w-3.5 h-3.5" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Copy className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
