'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { ApprovalModal } from '@/components/tasks/ApprovalModal';
import { UserTasksView } from '@/components/user/UserTasksView';
import { DevExecutionView } from '@/components/developer/DevExecutionView';
import { useRagnarok } from '@/lib/context/RagnarokContext';

export default function TasksPage() {
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
          title={mode === 'developer' ? 'Execution Engine & Task Graphs' : "What I'm working on"}
          subtitle={
            mode === 'developer'
              ? 'Multi-step DAG execution traces, step parameters, and runtime gating'
              : 'Current requests, step-by-step progress, and required approvals'
          }
        />

        <main className="flex-1 overflow-y-auto">
          {mode === 'developer' ? (
            <DevExecutionView onOpenApproval={(id) => setActiveApprovalId(id)} />
          ) : (
            <UserTasksView />
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
