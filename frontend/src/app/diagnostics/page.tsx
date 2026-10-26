'use client';

import React from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { DevDiagnosticsView } from '@/components/developer/DevDiagnosticsView';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function DiagnosticsPage() {
  const {
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
          title="Diagnostics, Events & Runtime Health"
          subtitle="Real measured latency benchmarks, filterable event traces, and socket bindings"
        />

        <main className="flex-1 overflow-y-auto">
          <DevDiagnosticsView />
        </main>
      </div>
    </div>
  );
}
