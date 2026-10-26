'use client';

import React from 'react';
import { useForge } from '@/lib/forge/ForgeContext';
import { CodeEditor } from './CodeEditor';
import { AgentWorkspace } from './AgentWorkspace';

export const ForgeWorkbench: React.FC = () => {
  const { activeFile, workbenchLayout, openFile } = useForge();

  // If no file is actively opened, the agent workspace takes center stage
  if (!activeFile) {
    return <AgentWorkspace onOpenFile={openFile} />;
  }

  // If user explicitly chose agent-only layout
  if (workbenchLayout === 'agent-only') {
    return <AgentWorkspace onOpenFile={openFile} />;
  }

  // If user explicitly chose editor-only layout
  if (workbenchLayout === 'editor-only') {
    return <CodeEditor />;
  }

  // Default: Side-by-side Split View (Code Editor + Agent Session)
  return (
    <div className="flex-1 flex overflow-hidden bg-forge-canvas">
      {/* Left Pane: Code Editor with Tabs & Diff Viewer */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-forge overflow-hidden">
        <CodeEditor />
      </div>

      {/* Right Pane: Contextual Agent Workspace (Task, Progress & Composer) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AgentWorkspace onOpenFile={openFile} />
      </div>
    </div>
  );
};
