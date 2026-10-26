'use client';

import React from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { UserSettingsView } from '@/components/user/UserSettingsView';
import { DevDiagnosticsView } from '@/components/developer/DevDiagnosticsView';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function SettingsPage() {
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
          title={mode === 'developer' ? 'Workspace & Runtime Settings' : 'Privacy & Appearance'}
          subtitle={
            mode === 'developer'
              ? 'Appearance profiles, sovereign boundary policies, and encrypted storage configurations'
              : 'Choose your visual style, quiet hours, and manage local memory storage'
          }
        />

        <main className="flex-1 overflow-y-auto">
          <UserSettingsView />
        </main>
      </div>
    </div>
  );
}
