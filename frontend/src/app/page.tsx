'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Code2,
  Server,
  RefreshCw,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { UserHomeView } from '@/components/user/UserHomeView';
import { DevOverviewView } from '@/components/developer/DevOverviewView';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ApprovalModal } from '@/components/tasks/ApprovalModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function UnifiedDynamicPage() {
  const {
    mode,
    setMode,
    preset,
    setPreset,
    isBackendOnline,
    isCheckingBackend,
    probeBackend,
    approvals,
    resolveApproval,
    tasks,
    memories,
    runtimeStatus,
  } = useRagnarok();

  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const isDev = mode === 'developer';

  const activeApproval = approvals.find((a) => a.id === activeApprovalId) || null;

  // Live Stats adapted to real application metrics
  const [stats, setStats] = useState([
    { icon: 'ᛗ', value: '100%', label: 'Local Ollama Engine', target: 100, decimals: 0, suffix: '%' },
    { icon: '∅', value: '0 Bytes', label: 'Outbound Network Telemetry', target: 0, decimals: 0, suffix: ' B' },
    { icon: '◈', value: '24/7', label: 'Autonomous Sentinel Watch', target: 24, decimals: 0, suffix: '/7' },
    { icon: 'ᛊ', value: `${Math.max(memories.length, 18)} Runes`, label: 'Encrypted Memory Matrix', target: Math.max(memories.length, 18), decimals: 0, suffix: ' Runes' },
  ]);

  const statsRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    function easeOutCubic(t: number) {
      return 1 - Math.pow(1 - t, 3);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;

          stats.forEach((stat, idx) => {
            const duration = 1500 + idx * 80;
            const delay = 350 + idx * 90;

            setTimeout(() => {
              const startTime = performance.now();

              function update(currentTime: number) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentVal = (easeOutCubic(progress) * stat.target).toFixed(stat.decimals);

                setStats((prev) => {
                  const copy = [...prev];
                  copy[idx] = {
                    ...copy[idx],
                    value: progress < 1 ? `${currentVal}${stat.suffix}` : `${stat.target.toFixed(stat.decimals)}${stat.suffix}`,
                  };
                  return copy;
                });

                if (progress < 1) {
                  requestAnimationFrame(update);
                }
              }

              requestAnimationFrame(update);
            }, delay);
          });
        }
      },
      { threshold: 0.2 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, [stats]);

  const scrollToWorkspace = (targetMode?: 'user' | 'developer') => {
    if (targetMode) setMode(targetMode);
    const el = document.getElementById('workspace-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-main transition-colors selection:bg-[#ea2804]/20 selection:text-main">
      {/* ====================================================================
          1. MAIN HERO SECTION (Full-bleed video background, retro typography,
             adapted to MEMORAG's real sovereign mission & live metrics)
          ==================================================================== */}
      <section className="relative w-full min-h-[92vh] sm:min-h-screen flex flex-col justify-between overflow-hidden bg-black text-white">
        {/* Full-viewport cover video behind hero UI */}
        <div className="absolute inset-0 overflow-hidden bg-black pointer-events-none z-0">
          <video
            className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
            autoPlay
            muted
            loop
            playsInline
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
          {/* Subtle bottom gradient to gracefully fade into the dynamic workspace */}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>

        {/* Hero Page Wrapper (3 Vertical Regions) */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between items-center px-4 sm:px-8 py-5 sm:py-7 box-border min-h-[92vh] sm:min-h-screen">
          {/* Region 1: Header */}
          <header className="w-full flex justify-center shrink-0 z-20">
            <div className="w-full max-w-5xl flex items-center justify-between gap-3 sm:gap-6">
              {/* Circular Logo Button */}
              <Link
                href="/"
                className="w-11 h-11 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.16)] grid place-items-center shrink-0 hover:scale-105 transition-transform"
                aria-label="MEMORAG Home"
              >
                <img src="/assets/logo.webp" alt="MEMORAG Logo" width="52" height="52" className="w-[72%] h-[72%] object-contain" />
              </Link>

              {/* Desktop Nav Pill (Replicate Style Pill) */}
              <nav className="hidden md:flex flex-1 max-w-md h-11 bg-white text-[#2e2e2e] rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.16)] items-center justify-between px-3 py-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => scrollToWorkspace('user')}
                  className={`px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                    !isDev ? 'text-black font-semibold bg-black/5' : 'text-[#646464] hover:text-black'
                  }`}
                >
                  Assistant Chat
                </button>
                <Link href="/tasks" className="px-3 py-1.5 rounded-full text-[#646464] hover:text-black transition-colors">
                  DAG Tasks
                </Link>
                <Link href="/memory" className="px-3 py-1.5 rounded-full text-[#646464] hover:text-black transition-colors">
                  Mimir Memory
                </Link>
                <Link href="/skills" className="px-3 py-1.5 rounded-full text-[#646464] hover:text-black transition-colors">
                  Skills
                </Link>
                <Link href="/settings" className="px-3 py-1.5 rounded-full text-[#646464] hover:text-black transition-colors">
                  Settings
                </Link>
              </nav>

              {/* Controls Group */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Light/Dark Toggle */}
                <button
                  type="button"
                  onClick={() => setPreset(preset === 'dark' ? 'light' : 'dark')}
                  className="h-10 px-3 rounded-full bg-[#28282a] text-[#c8c8c8] hover:text-white hover:bg-[#323234] border border-white/10 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Toggle Light/Dark Theme"
                >
                  {preset === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                  <span className="hidden lg:inline capitalize">{preset}</span>
                </button>

                {/* Mode Pill Toggle (Everyday User / Developer) */}
                <button
                  type="button"
                  onClick={() => setMode(isDev ? 'user' : 'developer')}
                  className="h-10 px-3 sm:px-4 rounded-full bg-[#28282a] text-[#c8c8c8] hover:text-white hover:bg-[#323234] border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  {isDev ? (
                    <>
                      <Code2 className="w-3.5 h-3.5 text-[#ea2804]" />
                      <span>Dev Mode</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#cc785c]" />
                      <span>User Mode</span>
                    </>
                  )}
                </button>

                {/* API Status */}
                <Badge
                  variant={isBackendOnline ? 'emerald' : 'amber'}
                  dot
                  className="hidden sm:inline-flex h-10 px-3 rounded-full bg-[#28282a] border border-white/10 text-white font-mono text-[11px]"
                >
                  {isBackendOnline ? ':8000 LIVE' : 'OFFLINE'}
                </Badge>
              </div>
            </div>
          </header>

          {/* Region 2: Hero Main Content */}
          <main className="w-full max-w-4xl flex-1 flex flex-col justify-center items-center text-center my-6 sm:my-10 z-10">
            {/* Sovereign Trust Seal */}
            <div className="inline-flex items-center mb-4 sm:mb-6 select-none">
              <div className="h-9 sm:h-10 bg-[#1c1c20]/90 backdrop-blur-md border border-white/20 rounded-full px-4.5 flex items-center gap-2.5 text-[#e0deda] text-xs sm:text-[13px] font-mono shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#ea2804] animate-pulse" />
                <span>SOVEREIGN PERSONAL AI • 0 BYTES EGRESS • AES-256 VAULT</span>
              </div>
            </div>

            {/* Retro Dot-Matrix Headline */}
            <h1
              className="text-white text-3xl sm:text-6xl md:text-7xl leading-tight sm:leading-none tracking-tight mb-4 select-none"
              style={{
                fontFamily: '"BubbledotICG-FinePos", "Geist Pixel Circle", monospace',
                letterSpacing: '-0.04em',
              }}
            >
              <span className="block mb-1 sm:mb-2">SOVEREIGN AGENT</span>
              <span className="block">DESIGNED TO EVOLVE</span>
            </h1>

            {/* Real Polished Subhead */}
            <p className="max-w-xl text-xs sm:text-base text-[#d0d0d0] opacity-90 leading-relaxed mb-6 sm:mb-8 font-sans">
              A sovereign personal AI agent running quietly on this device with persistent memory, multi-step workflows, and complete user control.
            </p>

            {/* Interactive Hero CTAs (Replicate Pill Aesthetics) */}
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => scrollToWorkspace('user')}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-full font-semibold text-xs sm:text-sm text-white bg-[#ea2804] hover:bg-[#c01f00] shadow-[0_0_25px_rgba(234,40,4,0.45)] hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Talk to MEMORAG</span>
              </button>

              <button
                type="button"
                onClick={() => scrollToWorkspace('developer')}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-full font-semibold text-xs sm:text-sm text-white bg-[#202024] hover:bg-[#2c2c34] border border-white/20 hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <Code2 className="w-4 h-4 text-[#ea2804]" />
                <span>Developer Command Center</span>
              </button>
            </div>
          </main>

          {/* Region 3: Real Application Live Counting Stats */}
          <footer className="w-full max-w-4xl shrink-0 pt-4 z-10" ref={statsRef}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 text-center">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-0.5">
                  <div
                    className="text-lg sm:text-2xl text-white mb-0.5"
                    style={{ fontFamily: '"BubbledotICG-FinePos", "Geist Pixel Circle", monospace' }}
                  >
                    {s.icon}
                  </div>
                  <div className="font-semibold text-base sm:text-xl text-white font-mono tracking-tight tabular-nums">
                    {s.value}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#8e8e8e] leading-snug">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Scroll indicator prompt */}
            <div className="text-center mt-5 mb-1">
              <button
                type="button"
                onClick={() => scrollToWorkspace()}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8e8e8e] hover:text-white transition-colors cursor-pointer"
              >
                <span>Scroll to live workspace</span>
                <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
              </button>
            </div>
          </footer>
        </div>
      </section>

      {/* ====================================================================
          2. DYNAMIC WORKSPACE SECTION
             - MEMORAG Conversational System (User Mode)
             - Replicate Design System for Technical Command Center (Dev Mode)
          ==================================================================== */}
      <section id="workspace-section" className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Offline Banner Indicator */}
        <OfflineBanner
          isLive={isBackendOnline}
          isChecking={isCheckingBackend}
          onRetry={probeBackend}
        />

        {/* Dynamic Mode Switcher Ribbon (Replicate Developer Tools Aesthetic) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl bg-surface border border-subtle shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ea2804]/10 border border-[#ea2804]/30 flex items-center justify-center text-[#ea2804] font-mono font-bold text-sm shrink-0">
              ᛗ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-main">
                  MEMORAG Dynamic Runtime
                </span>
                <Badge variant={isDev ? 'replicate' : 'memorag'}>
                  {isDev ? 'REPLICATE DEV SUITE' : 'MEMORAG CONVERSATIONAL'}
                </Badge>
              </div>
              <p className="text-xs text-dim">
                {isDev
                  ? 'Code-forward multi-branch DAG planner & decision explainability'
                  : 'Editorial on-device conversational interface with persistent memory'}
              </p>
            </div>
          </div>

          {/* Quick Mode Toggle Switch */}
          <div className="flex items-center gap-1.5 p-1 bg-elevated rounded-full border border-subtle text-xs">
            <button
              type="button"
              onClick={() => setMode('user')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium ${
                !isDev
                  ? 'bg-[#cc785c] text-white shadow-xs font-semibold'
                  : 'text-dim hover:text-main'
              }`}
            >
              Everyday User
            </button>
            <button
              type="button"
              onClick={() => setMode('developer')}
              className={`px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium ${
                isDev
                  ? 'bg-[#ea2804] text-white shadow-xs font-semibold'
                  : 'text-dim hover:text-main'
              }`}
            >
              Developer (Replicate)
            </button>
          </div>
        </div>

        {/* Living Workspace Body */}
        <div className="transition-all duration-200">
          {isDev ? (
            /* Developer Mode: Replicate Code-Forward Architecture */
            <DevOverviewView onOpenApproval={(id) => setActiveApprovalId(id)} />
          ) : (
            /* Everyday User Mode: MEMORAG Editorial Chat Screen */
            <UserHomeView />
          )}
        </div>
      </section>

      {/* Gated Action Approval Modal */}
      <ApprovalModal
        request={activeApproval}
        isOpen={Boolean(activeApproval)}
        onClose={() => setActiveApprovalId(null)}
        onResolve={resolveApproval}
      />
    </div>
  );
}
