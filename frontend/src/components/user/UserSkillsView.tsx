'use client';

import React from 'react';
import {
  Sparkles,
  Mail,
  Code,
  FolderTree,
  Radio,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { FadeContent } from '@/components/reactbits';

export const UserSkillsView: React.FC = () => {
  const { sentinels, toggleSentinel } = useRagnarok();

  // Friendly capability descriptions translated from technical skills
  const humanCapabilities = [
    {
      title: 'Managing project files safely',
      description: 'I can read project folders, check files, and organize notes. Any file change always asks for your confirmation first.',
      icon: FolderTree,
      badge: 'Safe & confirmed',
    },
    {
      title: 'Running development commands',
      description: 'I can test project builds, run linters, and inspect code inside a protected boundary on your computer.',
      icon: Code,
      badge: 'Protected sandbox',
    },
    {
      title: 'Remembering preferences and context',
      description: 'I recall prior conversations, project rules, and deadlines so you never have to repeat yourself.',
      icon: Sparkles,
      badge: 'Continuous memory',
    },
    {
      title: 'Summarizing emails and commitments',
      description: 'I can check your incoming messages for deadlines and stage drafts for you to review before sending.',
      icon: Mail,
      badge: 'Never auto-sends',
    },
  ];

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-8">
      {/* Section 1: Things I can help with */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-main">
            Things I can help with
          </h2>
          <p className="text-xs text-dim mt-0.5">
            Core skills and tasks I can assist you with on this computer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {humanCapabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <FadeContent key={i} blur duration={250} delay={i * 60} trigger="mount">
                <Card className="p-5 space-y-3 rounded-2xl bg-surface/90 border border-subtle hover:border-[#ea2804]/40 transition-colors h-full">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-full bg-[#ea2804]/10 text-[#ea2804]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant="replicate">{cap.badge}</Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-main">{cap.title}</h3>
                    <p className="text-xs text-dim leading-relaxed">{cap.description}</p>
                  </div>
                </Card>
              </FadeContent>
            );
          })}
        </div>
      </div>

      {/* Section 2: Things I watch for */}
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-main flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#ea2804]" />
            Things I watch for
          </h2>
          <p className="text-xs text-dim mt-0.5">
            Helpful background assistants that monitor files and deadlines without disturbing you.
          </p>
        </div>

        <div className="space-y-3">
          {sentinels.map((sentinel) => (
            <FadeContent key={sentinel.id} blur duration={250} trigger="mount">
              <Card className="p-4 sm:p-5 flex items-center justify-between gap-4 rounded-2xl bg-surface/90 border border-subtle hover:border-[#ea2804]/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-main">
                      {sentinel.name === 'Project Source Watcher'
                        ? 'Watching for project file changes'
                        : sentinel.name === 'Obligation Email Daemon'
                        ? 'Checking for upcoming commitments and deadlines'
                        : 'Tidying up old, unused memory notes'}
                    </h4>
                    <Badge variant={sentinel.isActive ? 'emerald' : 'zinc'}>
                      {sentinel.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-xs text-dim">
                    {sentinel.name === 'Project Source Watcher'
                      ? 'Monitors source files so tasks are always aware of your latest changes.'
                      : sentinel.name === 'Obligation Email Daemon'
                      ? 'Checks your inbox every 15 minutes and flags upcoming dates.'
                      : 'Runs once a day to clean up temporary notes older than two weeks.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSentinel(sentinel.id)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none active:scale-95 ${
                    sentinel.isActive ? 'bg-[#ea2804]' : 'bg-subtle'
                  }`}
                  aria-label="Toggle background watch"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      sentinel.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </Card>
            </FadeContent>
          ))}
        </div>
      </div>
    </div>
  );
};
