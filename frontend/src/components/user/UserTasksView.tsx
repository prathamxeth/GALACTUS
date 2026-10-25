'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { TaskGraph, TaskStep } from '@/lib/api/types';
import { FadeContent, CountUp, StarBorder } from '@/components/reactbits';
import { StepPlayer, CopyField } from '@/components/bencho';

export const UserTasksView: React.FC = () => {
  const {
    tasks,
    approvals,
    createTask,
    fetchIncompleteTasks,
    submitPermissionApproval,
    isLoadingTasks,
    taskError,
    isBackendOnline,
  } = useRagnarok();

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [isResolvingId, setIsResolvingId] = useState<string | null>(null);

  // Active 3-second polling only while task view is mounted
  useEffect(() => {
    fetchIncompleteTasks();
    const timerId = setInterval(() => {
      fetchIncompleteTasks();
    }, 3000);

    return () => {
      clearInterval(timerId);
    };
  }, [fetchIncompleteTasks]);

  const handleStartTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    createTask(newGoal.trim(), 'normal');
    setNewGoal('');
    setIsNewTaskOpen(false);
  };

  const handlePermissionDecision = async (
    requestId: string,
    taskId: string,
    approved: boolean
  ) => {
    setIsResolvingId(requestId);
    try {
      await submitPermissionApproval({
        request_id: requestId,
        task_id: taskId,
        approved,
        decision: approved ? 'approved' : 'denied',
        notes: approved ? 'Authorized by user in everyday mode' : 'Declined by user',
      });
      // Trigger immediate task refresh after decision submission
      fetchIncompleteTasks();
    } finally {
      setIsResolvingId(null);
    }
  };

  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingGatesCount = approvals.filter((a) => a.status === 'pending').length;

  return (
    <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-main">
              What I&apos;m working on
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live 3s polling
            </span>
          </div>
          <p className="text-xs text-dim mt-0.5">
            Follow the progress of current requests step-by-step.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchIncompleteTasks()}
            loading={isLoadingTasks}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Check status
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsNewTaskOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="transition-transform active:scale-95"
          >
            Ask me to do something
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip with CountUp */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center space-y-0.5">
          <span className="text-[10px] text-faint uppercase tracking-wider block">Running Tasks</span>
          <div className="text-lg font-semibold text-main font-mono">
            <CountUp to={runningCount} duration={0.5} />
          </div>
        </Card>
        <Card className="p-3 text-center space-y-0.5">
          <span className="text-[10px] text-faint uppercase tracking-wider block">Needs Permission</span>
          <div className="text-lg font-semibold text-amber-600 dark:text-amber-400 font-mono">
            <CountUp to={pendingGatesCount} duration={0.5} />
          </div>
        </Card>
        <Card className="p-3 text-center space-y-0.5">
          <span className="text-[10px] text-faint uppercase tracking-wider block">Finished Tasks</span>
          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
            <CountUp to={completedCount} duration={0.5} />
          </div>
        </Card>
      </div>

      {/* Backend Offline Notice */}
      {!isBackendOnline && (
        <div className="p-3.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-dim">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>FastAPI service offline at http://127.0.0.1:8000. Tasks will resume as soon as the service connects.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* Task Error Banner */}
      {taskError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
          <span>{taskError}</span>
          <Button size="sm" variant="outline" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* Bencho Step Player Component (https://bencho.dev/blocks/step-player) */}
      {tasks.length > 0 && tasks[0].steps && tasks[0].steps.length > 0 && (
        <FadeContent blur duration={300} trigger="mount">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-dim uppercase tracking-wider">
              Autonomous Timeline Playback (Bencho.dev/blocks/step-player)
            </span>
            <StepPlayer
              steps={tasks[0].steps.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
              }))}
              currentStepIndex={Math.max(
                0,
                tasks[0].steps.findIndex(
                  (s) => s.status === 'running' || s.status === 'awaiting_approval'
                )
              )}
            />
          </div>
        </FadeContent>
      )}

      {/* Task Cards List with React Bits FadeContent */}
      <div className="space-y-4">

        {tasks.length === 0 ? (
          <FadeContent blur duration={300} trigger="mount">
            <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim space-y-3">
              <Clock className="w-8 h-8 mx-auto text-faint" />
              <p className="text-sm">No tasks currently queued or running.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNewTaskOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Start a new request
              </Button>
            </div>
          </FadeContent>
        ) : (
          tasks.map((task: TaskGraph) => {
            const isDone = task.status === 'completed';
            const isWaiting = task.status === 'awaiting_approval';
            const isFailed = task.status === 'failed';
            const completedStepsCount = task.steps.filter((s) => s.status === 'completed').length;

            // Find associated approval request
            const pendingApproval = isWaiting
              ? approvals.find((a) => (a.taskId === task.id || a.id.includes(task.id)) && a.status === 'pending')
              : null;

            return (
              <FadeContent key={task.id} blur duration={300} trigger="mount">
                <Card
                  className={`p-5 space-y-4 transition-all ${
                    isWaiting
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'hover:border-medium'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            isDone
                              ? 'emerald'
                              : isWaiting
                              ? 'amber'
                              : isFailed
                              ? 'rose'
                              : 'sky'
                          }
                          dot={!isDone && !isFailed}
                        >
                          {isDone
                            ? 'Completed'
                            : isWaiting
                            ? 'PAUSED: Needs permission'
                            : isFailed
                            ? "Couldn't finish"
                            : 'Working on it'}
                        </Badge>
                        <span className="text-xs text-faint" suppressHydrationWarning>
                          Started at{' '}
                          {new Date(task.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-main">
                        {task.goal}
                      </h3>
                    </div>

                    <span className="text-xs text-dim inline-flex items-center gap-1 font-mono">
                      <CountUp to={completedStepsCount} duration={0.4} />
                      <span>of {task.steps.length} steps complete</span>
                    </span>
                  </div>

                  {/* PAUSED_APPROVAL Action Details & Permission Card */}
                  {isWaiting && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-main">
                            Can I go ahead with this step?
                          </h4>
                          <p className="text-xs text-dim">
                            {pendingApproval
                              ? `I need your permission to ${pendingApproval.actionTitle.toLowerCase()}. This step will run safely in a sandbox on this device.`
                              : 'A protected operation is paused awaiting your authorization before continuing.'}
                          </p>

                          {/* Show Available Action Details */}
                          {pendingApproval && (
                            <div className="mt-2 p-2.5 rounded bg-surface border border-subtle text-[11px] font-mono text-dim space-y-1">
                              <div>
                                <span className="text-main font-semibold">Action:</span> {pendingApproval.actionTitle}
                              </div>
                              <div>
                                <span className="text-main font-semibold">Tool:</span> {pendingApproval.toolName}
                              </div>
                              {pendingApproval.commandOrPayload && (
                                <div className="truncate">
                                  <span className="text-main font-semibold">Payload:</span> {pendingApproval.commandOrPayload}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isResolvingId === (pendingApproval?.id || task.id)}
                          onClick={() =>
                            handlePermissionDecision(
                              pendingApproval?.id || `appr-${task.id}`,
                              task.id,
                              false
                            )
                          }
                        >
                          Don&apos;t allow
                        </Button>
                        <StarBorder
                          as="button"
                          disabled={isResolvingId === (pendingApproval?.id || task.id)}
                          onClick={() =>
                            handlePermissionDecision(
                              pendingApproval?.id || `appr-${task.id}`,
                              task.id,
                              true
                            )
                          }
                          color="#10b981"
                          trailColor="rgba(16, 185, 129, 0.3)"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-xs active:scale-98 transition-transform"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isResolvingId === (pendingApproval?.id || task.id) ? 'Authorizing...' : 'Allow action'}</span>
                        </StarBorder>
                      </div>
                    </div>
                  )}

                  {/* Plain Language Steps Progress List */}
                  <div className="space-y-2 pt-1 border-t border-subtle">
                    {task.steps.map((step: TaskStep) => {
                      const stepDone = step.status === 'completed';
                      const stepRunning = step.status === 'running';
                      const stepWaiting = step.status === 'awaiting_approval';
                      const stepFailed = step.status === 'failed';

                      return (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 text-xs p-2.5 rounded-lg bg-surface/50 border border-subtle transition-colors"
                        >
                          <div className="mt-0.5 shrink-0">
                            {stepDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : stepRunning ? (
                              <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                            ) : stepWaiting ? (
                              <ShieldAlert className="w-4 h-4 text-amber-500" />
                            ) : stepFailed ? (
                              <AlertTriangle className="w-4 h-4 text-rose-500" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-subtle flex items-center justify-center text-[10px] text-faint">
                                {step.stepNumber}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-medium ${
                                  stepDone
                                    ? 'text-dim line-through decoration-subtle'
                                    : 'text-main'
                                }`}
                              >
                                {step.title}
                              </span>
                              <span className="text-[11px] text-faint capitalize">
                                {stepWaiting
                                  ? 'Permission needed'
                                  : stepRunning
                                  ? 'In progress'
                                  : stepDone
                                  ? 'Done'
                                  : stepFailed
                                  ? 'Failed'
                                  : 'Upcoming'}
                              </span>
                            </div>

                            {step.output && (
                              <p className="text-[11px] text-dim">{step.output}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Plain Language Failure Recovery Advice */}
                  {isFailed && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">
                          I couldn&apos;t finish this request.
                        </span>
                        <span className="text-[11px] text-dim">
                          {task.errorMessage ||
                            'One of the steps failed or was halted. You can ask me to try again with a simpler goal or check device permissions.'}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              </FadeContent>
            );
          })
        )}
      </div>

      {/* Start New Task Modal */}
      <Modal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        title="Ask me to do something"
        description="Describe what you want done in plain words. I'll break it down into transparent steps."
      >
        <form onSubmit={handleStartTask} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-main">
              Your Request
            </label>
            <textarea
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="e.g. Organize my meeting notes and build an action checklist..."
              rows={3}
              className="w-full rounded-lg bg-elevated border border-subtle px-3 py-2 text-sm text-main placeholder-faint focus:outline-none focus:border-emerald-500"
              autoFocus
            />
          </div>

          <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewTaskOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newGoal.trim()}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Start Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
