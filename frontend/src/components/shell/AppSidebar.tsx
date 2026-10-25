'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  CheckCircle2,
  Brain,
  Wrench,
  ShieldCheck,
  Terminal,
  Activity,
  Database,
  Cpu,
  Lock,
  Radio,
  SlidersHorizontal,
  Laptop,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'amber' | 'emerald' | 'zinc';
}

export const AppSidebar: React.FC = () => {
  const pathname = usePathname();
  const { mode, setMode, approvals, runtimeStatus } = useRagnarok();
  const isDev = mode === 'developer';

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  // Mode-Specific Navigation Items
  const userNavItems: NavItem[] = [
    {
      name: 'Assistant',
      href: '/',
      icon: Sparkles,
    },
    {
      name: "What I'm Working On",
      href: '/tasks',
      icon: CheckCircle2,
      badge: pendingCount > 0 ? `${pendingCount} need attention` : undefined,
      badgeVariant: 'amber',
    },
    {
      name: 'Things I Remember',
      href: '/memory',
      icon: Brain,
    },
    {
      name: 'Things I Can Do',
      href: '/skills',
      icon: Wrench,
    },
    {
      name: 'Privacy & Device',
      href: '/settings',
      icon: ShieldCheck,
    },
  ];

  const devNavItems: NavItem[] = [
    {
      name: 'Command Center',
      href: '/',
      icon: Terminal,
    },
    {
      name: 'Live Execution & DAG',
      href: '/tasks',
      icon: Activity,
      badge: pendingCount > 0 ? `${pendingCount} gate` : undefined,
      badgeVariant: 'amber',
    },
    {
      name: 'Memory Inspector',
      href: '/memory',
      icon: Database,
    },
    {
      name: 'Skill Registry',
      href: '/skills',
      icon: SlidersHorizontal,
    },
    {
      name: 'Permissions & Diagnostics',
      href: '/settings',
      icon: ShieldCheck,
    },
  ];

  const currentNavItems = isDev ? devNavItems : userNavItems;

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-subtle flex flex-col justify-between h-screen sticky top-0 z-40 select-none transition-colors">
      {/* Top Header & Brand */}
      <div>
        <div className="px-5 py-4 border-b border-subtle">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:border-emerald-500/60 transition-colors">
              <span className="font-mono font-bold text-sm">ᚱ</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-main">
                  RAGNAROK
                </span>
                <span className="text-[10px] font-mono uppercase bg-elevated text-dim px-1 py-0.2 rounded border border-subtle">
                  {isDev ? 'CORE' : 'PERSONAL'}
                </span>
              </div>
              <p className="text-[11px] text-faint">
                {isDev ? 'Sovereign Agent Runtime' : 'Personal AI Assistant'}
              </p>
            </div>
          </Link>
        </div>

        {/* Persistent User / Developer Mode Switcher */}
        <div className="px-3 pt-3">
          <div className="p-1 rounded-lg bg-elevated border border-subtle grid grid-cols-2 gap-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('user')}
              className={`py-1.5 px-2 rounded-md transition-all duration-150 cursor-pointer text-center active:scale-95 ${
                !isDev
                  ? 'bg-surface text-main font-semibold shadow-xs border border-subtle'
                  : 'text-dim hover:text-main'
              }`}
            >
              Everyday User
            </button>
            <button
              type="button"
              onClick={() => setMode('developer')}
              className={`py-1.5 px-2 rounded-md transition-all duration-150 cursor-pointer text-center active:scale-95 ${
                isDev
                  ? 'bg-surface text-main font-semibold shadow-xs border border-subtle'
                  : 'text-dim hover:text-main'
              }`}
            >
              Developer
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-faint">
            {isDev ? 'Technical Architecture' : 'Navigation'}
          </div>
          {currentNavItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-elevated text-main shadow-xs border border-medium font-semibold'
                    : 'text-dim hover:text-main hover:bg-elevated/50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-dim'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <Badge
                    variant={item.badgeVariant || 'zinc'}
                    className="text-[10px] py-0 px-1.5 font-normal"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mode-Appropriate Bottom Status Card */}
      <div className="p-3 m-3 rounded-xl bg-elevated border border-subtle text-xs transition-colors">
        {isDev ? (
          /* Developer Mode Diagnostic Card */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-dim uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                Local Sentinel
              </span>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                LOOPBACK
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-dim font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-faint">
                  <Cpu className="w-3 h-3" /> Host
                </span>
                <span className="text-main">
                  {runtimeStatus?.ollamaEndpoint ? '127.0.0.1:11434' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-faint">
                  <Lock className="w-3 h-3" /> Encryption
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  AES-256-GCM
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-faint">Outbound Egress</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  0 Bytes
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-subtle flex items-center justify-between text-[10px] text-faint font-mono">
              <span>{runtimeStatus?.model || 'llama3.2:3b'}</span>
              <span>&lt;30% CPU cap</span>
            </div>
          </div>
        ) : (
          /* User Mode Calm Status Card */
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-main">Private on this device</p>
                <p className="text-[11px] text-dim">Nothing leaves your computer</p>
              </div>
            </div>
            <div className="pt-2 border-t border-subtle flex items-center justify-between text-[10px] text-faint">
              <span>Device load: Normal</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Safe</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
