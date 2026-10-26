'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Replace multi-line code blocks with a brief spoken note
  text = text.replace(/```[\s\S]*?```/g, ' [Code snippet omitted] ');

  // 2. Remove inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Remove markdown images & links: ![alt](url) and [anchor](url) -> anchor
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 4. Remove Markdown headers: # Header -> Header
  text = text.replace(/#{1,6}\s+/g, '');

  // 5. Remove bold, italic, strikethrough markers
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 6. Clean bullet point markers and numbered lists
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // 7. Remove blockquote markers
  text = text.replace(/^\s*>\s+/gm, '');

  // 8. Replace URLs with simple text
  text = text.replace(/https?:\/\/\S+/gi, 'link');

  // 9. Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export interface UseSpeechSynthesisReturn {
  isSpeaking: boolean;
  speakingId: string | null;
  isSupported: boolean;
  autoSpeak: boolean;
  speak: (text: string, messageId?: string) => void;
  stop: () => void;
  toggleAutoSpeak: () => void;
  setAutoSpeak: (val: boolean) => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [autoSpeak, setAutoSpeakState] = useState<boolean>(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      // Load saved auto-speak preference
      try {
        const saved = localStorage.getItem('memorag_auto_speak');
        if (saved !== null) {
          setAutoSpeakState(saved === 'true');
        }
      } catch {}

      const loadVoices = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const setAutoSpeak = useCallback((val: boolean) => {
    setAutoSpeakState(val);
    try {
      localStorage.setItem('memorag_auto_speak', String(val));
    } catch {}
  }, []);

  const toggleAutoSpeak = useCallback(() => {
    setAutoSpeakState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('memorag_auto_speak', String(next));
      } catch {}
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (rawText: string, messageId?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }

      // Stop any ongoing speech first
      try {
        window.speechSynthesis.cancel();
      } catch {}

      const cleanText = cleanTextForSpeech(rawText);
      if (!cleanText) {
        setIsSpeaking(false);
        setSpeakingId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Pick preferred natural voice (prioritize Google or Microsoft English natural voices)
      const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
      const naturalVoice =
        englishVoices.find((v) => /natural|google|samantha|daniel|karen/i.test(v.name)) ||
        englishVoices[0] ||
        voices[0];

      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (messageId) {
          setSpeakingId(messageId);
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      utterance.onerror = (e) => {
        // 'interrupted' or 'canceled' happens normally when stopping
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.debug('SpeechSynthesis error:', e.error);
        }
        setIsSpeaking(false);
        setSpeakingId(null);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.debug('Failed to speak text:', err);
        setIsSpeaking(false);
        setSpeakingId(null);
      }
    },
    []
  );

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, []);

  return {
    isSpeaking,
    speakingId,
    isSupported,
    autoSpeak,
    speak,
    stop,
    toggleAutoSpeak,
    setAutoSpeak,
  };
}
