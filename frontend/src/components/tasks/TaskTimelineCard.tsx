'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Repeat,
  Terminal,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TaskGraph, TaskStep, TaskStatus } from '../../lib/api/types';
import {
  Stepper,
  StepperNav,
  StepperItem,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
} from '../ui/Stepper';

interface TaskTimelineCardProps {
  task: TaskGraph;
  onOpenApproval?: (requestId: string) => void;
}

const statusBadgeConfig: Record<
  TaskStatus,
  { variant: BadgeVariant; label: string; dot?: boolean }
> = {
  queued: { variant: 'zinc', label: 'Queued' },
  running: { variant: 'dev', label: 'Executing DAG', dot: true },
  awaiting_approval: { variant: 'amber', label: 'PAUSED: Awaiting Gate Approval', dot: true },
  completed: { variant: 'emerald', label: 'Completed' },
  failed: { variant: 'rose', label: 'Failed' },
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
      className={`overflow-hidden transition-[border-color,background-color] duration-200 ease-out ${
        isPausedGate ? 'border-amber-500/50 bg-amber-500/5' : ''
      }`}
    >
      <CardHeader className="bg-surface/80 flex flex-wrap items-start justify-between gap-3 border-b border-subtle">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-faint tabular-nums">
              memorag / {task.id}
            </span>
            <Badge variant={badgeConfig.variant} dot={badgeConfig.dot}>
              {badgeConfig.label}
            </Badge>
            <span className="text-[11px] font-mono text-dim px-2 py-0.5 rounded-full bg-elevated border border-subtle">
              PRIORITY: {task.priority.toUpperCase()}
            </span>
          </div>
          <CardTitle className="text-base text-main font-mono">{task.goal}</CardTitle>
        </div>

        <div className="text-right text-xs text-dim font-mono tabular-nums">
          <div suppressHydrationWarning>
            Created: {new Date(task.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {task.estimatedDurationMs && (
            <div className="text-faint">Est: {(task.estimatedDurationMs / 1000).toFixed(0)}s</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {/* 21st.dev Vertical Stepper Multi-Step DAG Workflow */}
        <Stepper orientation="vertical">
          <StepperNav>
            {(task.steps || []).map((step: TaskStep, index: number) => {
              const isExpanded = expandedStepId === step.id;
              const isAwaitingGate = step.status === 'awaiting_approval';
              const isLast = index === (task.steps || []).length - 1;

              return (
                <StepperItem
                  key={step.id}
                  step={step.stepNumber}
                  state={step.status}
                  isLast={isLast}
                >
                  <StepperIndicator step={step.stepNumber} state={step.status} />

                  <div className="flex-1 bg-surface border border-subtle rounded-xl p-3.5 hover:border-medium transition-colors font-mono">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() => toggleStep(step.id)}
                      >
                        <div className="flex items-center gap-2">
                          <StepperTitle className="font-mono text-xs">
                            Step {step.stepNumber}: {step.title}
                          </StepperTitle>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-faint shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-faint shrink-0" />
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
                          <span className="font-mono text-[#cc785c] text-[11px] flex items-center gap-1">
                            <Terminal className="w-3 h-3 text-faint" />
                            {step.skillName}
                          </span>

                          {step.reflectionAttempt > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                              <Repeat className="w-2.5 h-2.5" />
                              Reflection #{step.reflectionAttempt}
                            </span>
                          )}
                        </div>
                      </div>

                      {isAwaitingGate && onOpenApproval && (
                        <Button
                          size="sm"
                          variant="chat"
                          onClick={() => onOpenApproval(step.approvalRequestId || `appr-${task.id}`)}
                          icon={<ShieldAlert className="w-3.5 h-3.5 mr-1" />}
                          className="bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0"
                        >
                          Review Gate
                        </Button>
                      )}
                    </div>

                    {/* Output summary snippet */}
                    {step.output && !isExpanded && (
                      <StepperDescription className="mt-2 text-xs line-clamp-1 bg-elevated px-2.5 py-1 rounded-md border border-subtle">
                        {step.output}
                      </StepperDescription>
                    )}

                    {/* Detailed Parameter & Output Drawer */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-subtle space-y-2 text-xs font-mono">
                        {step.parameters && Object.keys(step.parameters).length > 0 && (
                          <div>
                            <span className="text-faint text-[10px] uppercase tracking-wider block mb-1">
                              Parameters
                            </span>
                            <pre className="bg-elevated p-2.5 rounded-lg border border-subtle text-dim overflow-x-auto text-[11px]">
                              {JSON.stringify(step.parameters, null, 2)}
                            </pre>
                          </div>
                        )}

                        {step.output && (
                          <div>
                            <span className="text-faint text-[10px] uppercase tracking-wider block mb-1">
                              Verified Loopback Output
                            </span>
                            <pre className="bg-elevated p-2.5 rounded-lg border border-subtle text-[#cc785c] overflow-x-auto whitespace-pre-wrap text-[11px]">
                              {step.output}
                            </pre>
                          </div>
                        )}

                        {step.error && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300">
                            <span className="font-semibold block mb-0.5">
                              Error Trapped (Self-Correction Loop):
                            </span>
                            <p>{step.error}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </StepperItem>
              );
            })}
          </StepperNav>
        </Stepper>
      </CardContent>
    </Card>
  );
};
