'use client';

import React from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { UserMemoryView } from '@/components/user/UserMemoryView';
import { DevMemoryInspector } from '@/components/developer/DevMemoryInspector';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function MemoryVaultPage() {
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
          title={mode === 'developer' ? 'Memory Inspector & Vector Vault' : 'Things I remember'}
          subtitle={
            mode === 'developer'
              ? 'Episodic saga-logs (Muninn), semantic knowledge graph (Mimir), & vector embeddings'
              : 'Preferences, facts, and project context remembered privately on this device'
          }
        />

        <main className="flex-1 overflow-y-auto">
          {mode === 'developer' ? (
            <DevMemoryInspector />
          ) : (
            <UserMemoryView />
          )}
        </main>
      </div>
    </div>
  );
}
