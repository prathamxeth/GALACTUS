'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  ShieldAlert,
  Layers,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TaskTimelineCard } from '../tasks/TaskTimelineCard';
import { useRagnarok } from '@/lib/context/RagnarokContext';
import { TaskStatus } from '@/lib/api/types';
import { FadeContent, CountUp } from '@/components/reactbits';

export const DevExecutionView: React.FC<{ onOpenApproval: (reqId: string) => void }> = ({
  onOpenApproval,
}) => {
  const {
    tasks,
    approvals,
    createTask,
    fetchIncompleteTasks,
    isLoadingTasks,
    taskError,
    isBackendOnline,
  } = useRagnarok();

  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal');

  // Active 3-second polling only while this view is active
  useEffect(() => {
    fetchIncompleteTasks();
    const timerId = setInterval(() => {
      fetchIncompleteTasks();
    }, 3000);

    return () => {
      clearInterval(timerId);
    };
  }, [fetchIncompleteTasks]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    createTask(newGoal.trim(), newPriority);
    setNewGoal('');
    setIsModalOpen(false);
  };

  const filtered =
    filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'pending').length;
  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-main flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Task Execution &amp; Pipeline
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live (3s)
            </span>
          </div>
          <p className="text-xs text-dim mt-0.5 font-subheading">
            Track multi-step execution graphs, step dependencies, and approval states.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter Pill Group */}
          <div className="flex flex-wrap items-center gap-1 bg-elevated p-1 rounded-lg border border-subtle text-xs font-mono">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'running', label: 'Running' },
                { id: 'awaiting_approval', label: 'Needs Approval' },
                { id: 'completed', label: 'Completed' },
                { id: 'failed', label: 'Failed' },
              ] as const
            ).map(({ id, label }) => {
              const count = id === 'all' ? tasks.length : tasks.filter((t) => t.status === id).length;
              const isActive = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-all duration-150 active:translate-y-px select-none text-[11px] tabular-nums ${
                    isActive
                      ? 'bg-accent text-white font-semibold shadow-xs'
                      : 'text-dim hover:text-main hover:bg-surface'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchIncompleteTasks()}
            loading={isLoadingTasks}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="dev"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Task
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-surface border border-subtle text-center space-y-0.5">
          <span className="text-[10px] text-dim uppercase tracking-wider block font-mono">Running</span>
          <div className="text-lg font-semibold text-main font-mono tabular-nums">
            <CountUp to={runningCount} duration={0.4} />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface border border-subtle text-center space-y-0.5">
          <span className="text-[10px] text-amber-500 uppercase tracking-wider block font-mono">Needs Approval</span>
          <div className="text-lg font-semibold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            <CountUp to={pendingApprovalsCount} duration={0.4} />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface border border-subtle text-center space-y-0.5">
          <span className="text-[10px] text-emerald-500 uppercase tracking-wider block font-mono">Completed</span>
          <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            <CountUp to={completedCount} duration={0.4} />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface border border-subtle text-center space-y-0.5">
          <span className="text-[10px] text-dim uppercase tracking-wider block font-mono">Total Tasks</span>
          <div className="text-lg font-semibold text-main font-mono tabular-nums">
            <CountUp to={tasks.length} duration={0.4} />
          </div>
        </div>
      </div>

      {/* Backend Status Warning */}
      {!isBackendOnline && (
        <div className="p-3 rounded-xl bg-surface border border-subtle flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-dim">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Backend service offline. Displaying locally staged tasks.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {taskError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs font-mono text-rose-800 dark:text-rose-200">
          <span>{taskError}</span>
          <Button size="sm" variant="outline" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* Pending Approval Gate Alert */}
      {pendingApprovalsCount > 0 && (
        <FadeContent blur duration={300} trigger="mount">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-main block truncate">
                  {pendingApprovalsCount} action step{pendingApprovalsCount > 1 ? 's' : ''} awaiting authorization
                </span>
                <span className="text-dim text-[11px] block truncate">
                  High-risk action invoked. Execution paused at security gate.
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const pending = approvals.find((a) => a.status === 'pending');
                if (pending) onOpenApproval(pending.id);
              }}
              className="border-amber-500/40 text-amber-900 dark:text-amber-200 shrink-0 font-mono text-xs"
            >
              Authorize
            </Button>
          </div>
        </FadeContent>
      )}

      {/* Task Graph Stream with React Bits FadeContent */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <FadeContent blur duration={300} trigger="mount">
            <div className="p-12 text-center rounded-xl bg-surface border border-subtle text-dim font-mono text-xs">
              No tasks matched filter &apos;{filter}&apos;.
            </div>
          </FadeContent>
        ) : (
          filtered.map((task) => (
            <FadeContent key={task.id} blur duration={250} trigger="mount">
              <TaskTimelineCard
                task={task}
                onOpenApproval={onOpenApproval}
              />
            </FadeContent>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Task Request"
        description="Submit a goal to be planned and executed step-by-step."
      >
        <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-main font-medium block mb-1">
              Task Goal or Request:
            </label>
            <textarea
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="e.g. Audit codebase for security vulnerabilities and draft patch plan..."
              rows={3}
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main placeholder-faint focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>

          <div>
            <label className="text-main font-medium block mb-1">
              Execution Priority:
            </label>
            <select
              value={newPriority}
              onChange={(e) =>
                setNewPriority(e.target.value as 'low' | 'normal' | 'high')
              }
              className="w-full rounded-lg bg-surface border border-subtle p-2 text-main focus:outline-none focus:border-accent"
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>

          <div className="pt-2 border-t border-subtle flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="dev"
              size="sm"
              disabled={!newGoal.trim()}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
