'use client';

import React, { useState } from 'react';
import { AlertOctagon, Check, X, ShieldAlert, Terminal, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge, BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ApprovalRequest, RiskLevel } from '../../lib/api/types';
import { FadeContent, StarBorder } from '@/components/reactbits';

interface ApprovalModalProps {
  request: ApprovalRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (requestId: string, decision: 'approved' | 'rejected', notes?: string) => Promise<void>;
}

const riskVariant: Record<RiskLevel, BadgeVariant> = {
  low: 'sky',
  medium: 'amber',
  high: 'rose',
  critical: 'rose',
};

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  request,
  isOpen,
  onClose,
  onResolve,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  if (!request) return null;

  const handleAction = async (decision: 'approved' | 'rejected') => {
    setIsSubmitting(true);
    try {
      await onResolve(request.id, decision, rejectionNotes || undefined);
      setShowRejectionInput(false);
      setRejectionNotes('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Permission Gatekeeper (POST /api/permissions/approve)"
      description="A sensitive operation halted at PAUSED_APPROVAL gate. Authorize or deny execution."
      maxWidth="xl"
    >
      <FadeContent blur duration={250} trigger="mount">
        <div className="space-y-4 font-mono text-xs">
          {/* Risk Banner */}
          <div className="p-3.5 rounded-lg bg-surface border border-subtle flex items-start gap-3">
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-dim">
                  Tool: <code className="text-main font-semibold">{request.toolName}</code>
                </span>
                <Badge variant={riskVariant[request.riskLevel]} dot>
                  {request.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
              <p className="mt-1 text-sm font-medium text-main font-sans">{request.actionTitle}</p>
              <p className="mt-0.5 text-xs text-dim font-sans">{request.rationale}</p>
            </div>
          </div>

          {/* Task Context */}
          <div className="text-xs text-dim bg-surface p-2.5 rounded-md border border-subtle">
            <span className="font-medium text-main">Associated Task:</span> {request.taskGoal}
            <span className="block text-[11px] font-mono text-faint mt-0.5">
              Request ID: #{request.id} • Step ID: {request.stepId}
            </span>
          </div>

          {/* Command or Payload Inspection */}
          <div>
            <label className="text-xs font-medium text-main flex items-center gap-1.5 mb-1.5">
              <Terminal className="w-3.5 h-3.5 text-dim" />
              Action Parameters &amp; Inspected Payload
            </label>
            <div className="relative rounded-lg bg-elevated border border-subtle p-3 overflow-x-auto">
              <pre className="font-mono text-xs text-emerald-600 dark:text-emerald-300 leading-relaxed whitespace-pre-wrap break-all">
                {request.commandOrPayload || JSON.stringify(request.parameters, null, 2)}
              </pre>
            </div>
          </div>

          {/* Execution Notice */}
          <div className="flex items-start gap-2 p-2.5 rounded bg-surface border border-subtle text-[11px] text-dim">
            <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
            <span>
              Granting approval will execute this step within the verified sandbox and transition status from PAUSED_APPROVAL to RUNNING.
            </span>
          </div>

          {/* Denial Reason Input */}
          {showRejectionInput && (
            <div className="space-y-1.5 pt-2 border-t border-subtle">
              <label className="text-xs font-medium text-rose-600 dark:text-rose-400 block">
                Denial Reason / Guidance for Agent:
              </label>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Explain why this action was rejected or suggest an alternative..."
                rows={2}
                className="w-full text-xs font-mono rounded bg-surface border border-rose-500/40 p-2 text-main focus:outline-none focus:border-rose-500"
                autoFocus
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-subtle flex items-center justify-between gap-3">
            {!showRejectionInput ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRejectionInput(true)}
                className="text-xs text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 border-rose-500/30"
                icon={<AlertOctagon className="w-3.5 h-3.5" />}
              >
                Deny action...
              </Button>
            ) : (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handleAction('rejected')}
                loading={isSubmitting}
                icon={<X className="w-3.5 h-3.5" />}
              >
                Confirm Denial
              </Button>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <StarBorder
                as="button"
                onClick={() => handleAction('approved')}
                color="#10b981"
                trailColor="rgba(16, 185, 129, 0.3)"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-xs active:scale-98 transition-transform font-mono"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Authorize Action</span>
              </StarBorder>
            </div>
          </div>
        </div>
      </FadeContent>
    </Modal>
  );
};
