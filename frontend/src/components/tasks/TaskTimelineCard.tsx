'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Repeat,
  Terminal,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TaskGraph, TaskStep, TaskStatus, StepStatus } from '../../lib/api/types';

interface TaskTimelineCardProps {
  task: TaskGraph;
  onOpenApproval?: (requestId: string) => void;
}

const statusBadgeConfig: Record<
  TaskStatus,
  { variant: BadgeVariant; label: string; dot?: boolean }
> = {
  queued: { variant: 'zinc', label: 'Queued' },
  running: { variant: 'sky', label: 'Executing', dot: true },
  awaiting_approval: { variant: 'amber', label: 'PAUSED: Awaiting Gate Approval', dot: true },
  completed: { variant: 'emerald', label: 'Completed' },
  failed: { variant: 'rose', label: 'Failed' },
};

const stepStatusIcon: Record<StepStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-faint" />,
  running: <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />,
  awaiting_approval: <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />,
  completed: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  failed: <XCircle className="w-4 h-4 text-rose-500" />,
};

export const TaskTimelineCard: React.FC<TaskTimelineCardProps> = ({
  task,
  onOpenApproval,
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const badgeConfig = statusBadgeConfig[task.status] || {
    variant: 'amber',
    label: task.status,
    dot: true,
  };

  const isPausedGate = task.status === 'awaiting_approval';

  const toggleStep = (stepId: string) => {
    setExpandedStepId((curr) => (curr === stepId ? null : stepId));
  };

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 ${
        isPausedGate ? 'border-amber-500/50 bg-amber-500/5' : ''
      }`}
    >
      <CardHeader className="bg-surface/60 flex flex-wrap items-start justify-between gap-3 border-b border-subtle">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-faint">
              ID: {task.id}
            </span>
            <Badge variant={badgeConfig.variant} dot={badgeConfig.dot}>
              {badgeConfig.label}
            </Badge>
            <span className="text-[11px] font-mono text-dim">
              Priority: {task.priority.toUpperCase()}
            </span>
          </div>
          <CardTitle className="text-base text-main">{task.goal}</CardTitle>
        </div>

        <div className="text-right text-xs text-dim font-mono">
          <div suppressHydrationWarning>
            Created: {new Date(task.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {task.estimatedDurationMs && (
            <div className="text-faint">Est: {(task.estimatedDurationMs / 1000).toFixed(0)}s</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Step Timeline */}
        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-subtle">
          {(task.steps || []).map((step: TaskStep) => {
            const isExpanded = expandedStepId === step.id;
            const isAwaitingGate = step.status === 'awaiting_approval';

            return (
              <div key={step.id} className="relative group">
                {/* Step Node Marker */}
                <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-surface border border-subtle flex items-center justify-center shrink-0">
                  {stepStatusIcon[step.status] || <Clock className="w-4 h-4 text-faint" />}
                </div>

                <div className="bg-surface border border-subtle rounded-lg p-3.5 hover:border-medium transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => toggleStep(step.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-dim">
                          Step {step.stepNumber}:
                        </span>
                        <h4 className="text-sm font-medium text-main">
                          {step.title}
                        </h4>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-faint" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-faint" />
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1">
                          <Terminal className="w-3 h-3 text-faint" />
                          {step.skillName}
                        </span>

                        {step.reflectionAttempt > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                            <Repeat className="w-2.5 h-2.5" />
                            Reflection #{step.reflectionAttempt}
                          </span>
                        )}
                      </div>
                    </div>

                    {isAwaitingGate && onOpenApproval && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onOpenApproval(step.approvalRequestId || `appr-${task.id}`)}
                        icon={<ShieldAlert className="w-3.5 h-3.5" />}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0"
                      >
                        Inspect Gate
                      </Button>
                    )}
                  </div>

                  {/* Output summary snippet */}
                  {step.output && !isExpanded && (
                    <p className="mt-2 text-xs text-dim line-clamp-1 font-mono bg-elevated px-2 py-1 rounded border border-subtle">
                      {step.output}
                    </p>
                  )}

                  {/* Detailed Parameter & Output Drawer */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-subtle space-y-2 text-xs font-mono">
                      {step.parameters && Object.keys(step.parameters).length > 0 && (
                        <div>
                          <span className="text-faint text-[11px] uppercase tracking-wider block mb-1">
                            Parameters
                          </span>
                          <pre className="bg-elevated p-2.5 rounded border border-subtle text-dim overflow-x-auto text-[11px]">
                            {JSON.stringify(step.parameters, null, 2)}
                          </pre>
                        </div>
                      )}

                      {step.output && (
                        <div>
                          <span className="text-faint text-[11px] uppercase tracking-wider block mb-1">
                            Output
                          </span>
                          <pre className="bg-elevated p-2.5 rounded border border-subtle text-emerald-600 dark:text-emerald-300 overflow-x-auto whitespace-pre-wrap text-[11px]">
                            {step.output}
                          </pre>
                        </div>
                      )}

                      {step.error && (
                        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300">
                          <span className="font-semibold block mb-0.5">
                            Error Trapped (Self-Correction Loop):
                          </span>
                          <p>{step.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
