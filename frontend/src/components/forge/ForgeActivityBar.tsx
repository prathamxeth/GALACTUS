'use client';

import React from 'react';
import {
  BrainCircuit,
  Files,
  Search,
  GitBranch,
  AlertCircle,
  History,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useForge } from '@/lib/forge/ForgeContext';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import Link from 'next/link';

interface ForgeActivityBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const ForgeActivityBar: React.FC<ForgeActivityBarProps> = ({
  isSidebarOpen,
  onToggleSidebar,
}) => {
  const {
    activeLeftTab,
    setActiveLeftTab,
    problems,
    diagnosticReport,
    diagnosticStatus,
  } = useForge();

  const { mode } = useRagnarok();
  const isDev = mode === 'developer';

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const isAgentActive = Boolean(diagnosticReport || diagnosticStatus === 'INSPECTING');

  const handleTabClick = (tab: typeof activeLeftTab) => {
    if (activeLeftTab === tab && isSidebarOpen) {
      onToggleSidebar();
    } else {
      setActiveLeftTab(tab);
      if (!isSidebarOpen) {
        onToggleSidebar();
      }
    }
  };

  // User Mode vs Dev Mode Navigation Items
  const navItems = isDev
    ? [
        {
          id: 'agent' as const,
          label: 'Agent Sessions',
          icon: <BrainCircuit className="w-4 h-4" />,
          badge: isAgentActive ? 'active' : null,
          badgeColor: 'bg-forge-accent',
        },
        {
          id: 'explorer' as const,
          label: 'Explorer (Files)',
          icon: <Files className="w-4 h-4" />,
        },
        {
          id: 'search' as const,
          label: 'Search Workspace',
          icon: <Search className="w-4 h-4" />,
        },
        {
          id: 'git' as const,
          label: 'Source Control (Git)',
          icon: <GitBranch className="w-4 h-4" />,
        },
        {
          id: 'problems' as const,
          label: 'Diagnostics & Problems',
          icon: <AlertCircle className="w-4 h-4" />,
          badge: errorCount > 0 ? String(errorCount) : null,
          badgeColor: 'bg-rose-500',
        },
        {
          id: 'flight' as const,
          label: 'Flight Recorder & Sentinel',
          icon: <History className="w-4 h-4" />,
        },
        {
          id: 'inspector' as const,
          label: 'Environment Inspector',
          icon: <Activity className="w-4 h-4" />,
        },
      ]
    : [
        {
          id: 'agent' as const,
          label: 'Tasks',
          icon: <Sparkles className="w-4 h-4" />,
          badge: isAgentActive ? 'active' : null,
          badgeColor: 'bg-forge-accent',
        },
        {
          id: 'explorer' as const,
          label: 'Files',
          icon: <Files className="w-4 h-4" />,
        },
        {
          id: 'flight' as const,
          label: 'Activity History',
          icon: <History className="w-4 h-4" />,
        },
      ];

  return (
    <aside
      className="w-12 bg-forge-canvas border-r border-forge flex flex-col items-center justify-between py-2 shrink-0 select-none z-20 transition-colors duration-150"
      aria-label="Activity Bar"
    >
      {/* Top Main Activity Icons */}
      <nav className="flex flex-col items-center gap-1.5 w-full">
        {navItems.map((item) => {
          const isActive = isSidebarOpen && activeLeftTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item.id)}
              className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 group cursor-pointer ${
                isActive
                  ? 'bg-forge-elevated text-forge-primary border border-forge-strong shadow-xs'
                  : 'text-forge-muted hover:text-forge-primary hover:bg-forge-hover'
              }`}
              title={item.label}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              {/* Active Indicator Bar (Left Edge Pip) */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-forge-accent" />
              )}

              {/* Icon */}
              <span className={isActive ? 'text-forge-accent' : ''}>{item.icon}</span>

              {/* Badge indicator */}
              {item.badge === 'active' && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-forge-accent animate-pulse" />
              )}
              {item.badge && item.badge !== 'active' && (
                <span
                  className={`absolute -top-1 -right-1 px-1 min-w-[14px] h-3.5 rounded-full text-[9px] font-mono font-bold text-white flex items-center justify-center ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Secondary Actions (Sidebar Toggle & Settings) */}
      <div className="flex flex-col items-center gap-1.5 w-full pt-2 border-t border-forge/50">
        {/* Toggle Sidebar */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-forge-muted hover:text-forge-primary hover:bg-forge-hover transition-colors cursor-pointer"
          title={isSidebarOpen ? 'Hide Primary Side Bar (⌘B)' : 'Show Primary Side Bar (⌘B)'}
          aria-label={isSidebarOpen ? 'Hide Primary Side Bar' : 'Show Primary Side Bar'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>

        {/* Settings Link */}
        <Link
          href="/settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-forge-muted hover:text-forge-primary hover:bg-forge-hover transition-colors cursor-pointer"
          title="Open Settings"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>
    </aside>
  );
};
