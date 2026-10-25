'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Server,
  RefreshCw,
  Sun,
  Moon,
  Sparkles,
  Code2,
  Compass,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { AppearancePreset } from '@/lib/api/types';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

const presetLabels: Record<AppearancePreset, { label: string; icon: React.ElementType }> = {
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
};

export const AppHeader: React.FC<AppHeaderProps> = ({ title, subtitle }) => {
  const {
    mode,
    setMode,
    preset,
    setPreset,
    isBackendOnline,
    isCheckingBackend,
    probeBackend,
  } = useRagnarok();

  const isDev = mode === 'developer';
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTimeStr(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-subtle bg-surface/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div>
        <h1 className="text-base font-semibold text-main flex items-center gap-2">
          {title || (isDev ? 'Technical Control Center' : 'Personal Assistant')}
        </h1>
        {subtitle && <p className="text-xs text-dim">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Landing Page Showcase Link */}
        <Link
          href="/landing"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elevated border border-subtle text-xs cursor-pointer hover:border-medium transition-all duration-150 active:scale-95 text-dim hover:text-main"
          title="View Intelligence Designed To Evolve Landing Page"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-medium hidden sm:inline">Landing</span>
        </Link>

        {/* Appearance Preset Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-elevated border border-subtle rounded-lg text-xs">
          {(['light', 'dark'] as AppearancePreset[]).map(
            (p) => {
              const config = presetLabels[p];
              const Icon = config.icon;
              const isSelected = preset === p;

              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1 cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-surface text-main font-semibold shadow-xs border border-subtle'
                      : 'text-dim hover:text-main'
                  }`}
                  title={`Switch to ${config.label} preset`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{config.label}</span>
                </button>
              );
            }
          )}
        </div>

        {/* Local Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elevated border border-subtle text-xs font-mono text-dim">
          <Clock className="w-3.5 h-3.5 text-faint" />
          <span>{timeStr || '--:--:--'}</span>
        </div>

        {/* Mode Pill Toggle (Quick toggle) */}
        <button
          type="button"
          onClick={() => setMode(isDev ? 'user' : 'developer')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elevated border border-subtle text-xs cursor-pointer hover:border-medium transition-all duration-150 active:scale-95"
          title={`Currently in ${isDev ? 'Developer' : 'User'} Mode. Click to switch.`}
        >
          {isDev ? (
            <>
              <Code2 className="w-3.5 h-3.5 text-sky-500" />
              <span className="font-mono text-[11px] text-main font-medium hidden sm:inline">
                Dev Mode
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-main font-medium hidden sm:inline">
                User Mode
              </span>
            </>
          )}
        </button>

        {/* Backend Connectivity Status */}
        <div className="flex items-center gap-1.5">
          <Badge
            variant={isBackendOnline ? 'emerald' : 'amber'}
            dot
            className="text-[11px] font-mono"
          >
            <Server className="w-3 h-3 mr-0.5" />
            {isBackendOnline
              ? isDev
                ? 'API :8000 LIVE'
                : 'Connected'
              : isDev
              ? 'API OFFLINE'
              : 'Preview'}
          </Badge>

          <Button
            size="sm"
            variant="ghost"
            onClick={probeBackend}
            loading={isCheckingBackend}
            aria-label="Recheck connection"
            className="p-1 h-7 w-7 text-dim hover:text-main"
          >
            <RefreshCw
              className={`w-3 h-3 ${isCheckingBackend ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>
    </header>
  );
};
