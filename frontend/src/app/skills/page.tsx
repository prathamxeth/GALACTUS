'use client';

import React from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { UserSkillsView } from '@/components/user/UserSkillsView';
import { DevSkillRegistry } from '@/components/developer/DevSkillRegistry';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function SkillsPage() {
  const {
    mode,
    isBackendOnline,
    isCheckingBackend,
    probeBackend,
  } = useRagnarok();

  return (
    <div className="flex min-h-screen bg-canvas text-main transition-colors">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner
          isLive={isBackendOnline}
          isChecking={isCheckingBackend}
          onRetry={probeBackend}
        />

        <AppHeader
          title={mode === 'developer' ? 'Skill Registry & Isolation Forge' : 'Things I can help with'}
          subtitle={
            mode === 'developer'
              ? 'Tool schema definitions, containerized sandboxes, and dry-run execution'
              : 'Capabilities, automated watches, and security boundaries'
          }
        />

        <main className="flex-1 overflow-y-auto">
          {mode === 'developer' ? (
            <DevSkillRegistry />
          ) : (
            <UserSkillsView />
          )}
        </main>
      </div>
    </div>
  );
}
