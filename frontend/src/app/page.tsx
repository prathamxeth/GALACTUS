'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ApprovalModal } from '@/components/tasks/ApprovalModal';
import { UserHomeView } from '@/components/user/UserHomeView';
import { DevOverviewView } from '@/components/developer/DevOverviewView';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function HomePage() {
  const {
    mode,
    approvals,
    isBackendOnline,
    isCheckingBackend,
    probeBackend,
    resolveApproval,
  } = useRagnarok();

  const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);

  const activeApproval = approvals.find((a) => a.id === activeApprovalId) || null;

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
          title={mode === 'developer' ? 'Command Center (Technical)' : 'Personal Assistant'}
          subtitle={
            mode === 'developer'
              ? 'Multi-mode execution engine & decision trace'
              : 'Private intelligence running quietly on this device'
          }
        />

        <main className="flex-1 overflow-y-auto">
          {mode === 'developer' ? (
            <DevOverviewView onOpenApproval={(id) => setActiveApprovalId(id)} />
          ) : (
            <UserHomeView />
          )}
        </main>
      </div>

      <ApprovalModal
        request={activeApproval}
        isOpen={Boolean(activeApproval)}
        onClose={() => setActiveApprovalId(null)}
        onResolve={resolveApproval}
      />
    </div>
  );
}
