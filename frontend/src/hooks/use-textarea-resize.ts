'use client';

import { useEffect, useRef } from 'react';

export function useTextareaResize(value: string | number | readonly string[] = '', rows = 1) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to compute true scrollHeight
    textarea.style.height = 'auto';

    // Calculate minimum height based on rows
    const lineHeight = 24;
    const minHeight = rows * lineHeight;
    const computedHeight = Math.max(textarea.scrollHeight, minHeight);

    // Bound maximum expansion to 240px with smooth scroll
    textarea.style.height = `${Math.min(computedHeight, 240)}px`;
  }, [value, rows]);

  return textareaRef;
}
