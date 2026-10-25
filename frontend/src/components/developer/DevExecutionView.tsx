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
import { FadeContent, CountUp, StarBorder } from '@/components/reactbits';

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

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-main flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#ea2804]" />
              Live Execution &amp; Task Graph (FR3)
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono bg-[#ea2804]/10 text-[#ea2804] border border-[#ea2804]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea2804] animate-pulse" />
              POLL /api/tasks/incomplete (3s)
            </span>
          </div>
          <p className="text-xs text-dim mt-0.5 font-mono">
            Sub-task decomposition, step dependencies, and self-correction loops
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter (Replicate Pill Group) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-elevated/90 p-1 rounded-full border border-subtle text-xs font-mono">
            {(['all', 'running', 'awaiting_approval', 'completed', 'failed'] as const).map(
              (f) => {
                const count = f === 'all' ? tasks.length : tasks.filter((t) => t.status === f).length;
                const isActive = filter === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full cursor-pointer capitalize transition-all ${
                      isActive
                        ? 'bg-[#ea2804] text-white font-semibold shadow-xs'
                        : 'text-dim hover:text-main'
                    }`}
                  >
                    {f === 'awaiting_approval' ? 'PAUSED' : f} ({count})
                  </button>
                );
              }
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchIncompleteTasks()}
            loading={isLoadingTasks}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Poll Now
          </Button>

          <StarBorder
            as="button"
            onClick={() => setIsModalOpen(true)}
            color="#38bdf8"
            trailColor="rgba(56, 189, 248, 0.3)"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-500 cursor-pointer shadow-xs active:scale-98 transition-transform font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>Dispatch DAG</span>
          </StarBorder>
        </div>
      </div>

      {/* Backend Status Warning */}
      {!isBackendOnline && (
        <div className="p-3.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-dim">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>FastAPI service offline at http://127.0.0.1:8000. Displaying local staging queue.</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {taskError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs font-mono text-rose-800 dark:text-rose-200">
          <span>{taskError}</span>
          <Button size="sm" variant="outline" onClick={() => fetchIncompleteTasks()}>
            Retry
          </Button>
        </div>
      )}

      {/* DAG Dependency Status Notice with CountUp */}
      <div className="p-3.5 rounded-lg bg-surface border border-subtle flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-dim">
          <Layers className="w-4 h-4 text-sky-500" />
          <span>Execution Graph Topology: Linear &amp; Multi-Hop Sequential Pipeline Active</span>
        </div>
        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
          <CountUp to={runningCount} duration={0.4} />
          <span>Active Processes</span>
        </span>
      </div>

      {/* Pending Approval Gate Warning */}
      {pendingApprovalsCount > 0 && (
        <FadeContent blur duration={300} trigger="mount">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-main block">
                  {pendingApprovalsCount} Action Step Blocked at PAUSED_APPROVAL (POST /api/permissions/approve)
                </span>
                <span className="text-dim">
                  High-risk skill invoked. Execution halted until cryptographic user authorization is submitted.
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
              className="border-amber-500/40 text-amber-900 dark:text-amber-200 shrink-0 font-mono"
            >
              Open Security Gate
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

      {/* Dispatch DAG Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Dispatch Autonomous Task (DAG Graph)"
        description="Submit a goal to the autonomous planning engine. The model will decompose the goal into sequential sub-tasks."
      >
        <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
          <div>
            <label className="text-main font-medium block mb-1">
              Autonomous Objective / Goal:
            </label>
            <textarea
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="e.g. Audit codebase for OWASP vulnerabilities and draft patch plan..."
              rows={3}
              required
              className="w-full rounded-lg bg-surface border border-subtle p-2.5 text-main placeholder-faint focus:outline-none focus:border-sky-500"
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
              className="w-full rounded-lg bg-surface border border-subtle p-2 text-main focus:outline-none focus:border-sky-500"
            >
              <option value="low">Low Priority (Background Co-routine)</option>
              <option value="normal">Normal Priority (Interactive Pipeline)</option>
              <option value="high">High Priority (Immediate Preemption)</option>
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
              variant="primary"
              size="sm"
              disabled={!newGoal.trim()}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Enqueue DAG Graph
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
