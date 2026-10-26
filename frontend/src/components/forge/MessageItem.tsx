'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  Bot,
  FileText,
  Activity,
  ListOrdered,
  Terminal,
  ShieldAlert,
  AlertOctagon,
  Code2,
} from 'lucide-react';
import { ChatMessage } from '@/lib/api/types';
import { InlineApprovalCard } from './InlineApprovalCard';

export interface MessageItemProps {
  message: ChatMessage;
  onApproveProposal?: (approvalId: string) => Promise<void> | void;
  onRejectProposal?: (approvalId: string) => Promise<void> | void;
  onOpenFile?: (file: string) => void;
  isResolvingApproval?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onApproveProposal,
  onRejectProposal,
  onOpenFile,
  isResolvingApproval = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'agent';

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Helper to render code blocks vs regular text
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0]?.trim() || '';
        const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
        const language = hasLang ? firstLine : '';
        const code = (hasLang ? lines.slice(1) : lines).join('\n');

        return (
          <CodeBlock
            key={index}
            language={language || 'code'}
            code={code}
          />
        );
      }

      // Plain text block with paragraphs
      return (
        <div key={index} className="space-y-2 whitespace-pre-wrap leading-relaxed">
          {part}
        </div>
      );
    });
  };

  if (isSystem) {
    return (
      <div className="py-2.5 px-4 rounded-xl bg-forge-panel border border-forge text-xs font-mono text-forge-muted flex items-center gap-2 max-w-2xl mx-auto my-1 shadow-xs">
        <Sparkles className="w-3.5 h-3.5 text-forge-accent shrink-0" />
        <span className="flex-1">{message.content}</span>
        <span className="text-xs text-forge-muted/60">{message.timestamp}</span>
      </div>
    );
  }

  return (
    <div
      role="article"
      aria-label={`${isUser ? 'User message' : 'Assistant message'} at ${message.timestamp}`}
      className={`group flex flex-col space-y-2 py-1.5 transition-all animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender Header */}
      <div className="flex items-center gap-2 px-1 text-xs font-mono text-forge-muted">
        {isUser ? (
          <>
            <span className="text-forge-secondary font-medium">You</span>
            <span>•</span>
            <span>{message.timestamp}</span>
            <div className="w-5 h-5 rounded-full bg-forge-elevated border border-forge flex items-center justify-center text-forge-muted shadow-2xs">
              <User className="w-3 h-3" />
            </div>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full bg-forge-accent/15 border border-forge-accent/30 flex items-center justify-center text-forge-accent shadow-2xs">
              <Bot className="w-3 h-3" />
            </div>
            <span className="text-forge-primary font-semibold">Assistant</span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </>
        )}
      </div>

      {/* Message Content Bubble (assistant-ui inspired container) */}
      <div
        className={`max-w-[95%] sm:max-w-[88%] rounded-2xl px-4 sm:px-5 py-3.5 text-[13.5px] sm:text-[14px] select-text shadow-xs ${
          isUser
            ? 'bg-forge-elevated border border-forge text-forge-primary rounded-tr-xs'
            : 'bg-forge-panel border border-forge text-forge-primary rounded-tl-xs space-y-3.5'
        }`}
      >
        {/* Assistant Thought Trace Accordion */}
        {isAssistant && message.thoughtTrace && (
          <div className="rounded-xl border border-forge bg-forge-canvas/70 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsThoughtOpen((prev) => !prev)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-mono text-forge-muted hover:text-forge-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-forge-accent" />
                <span className="font-medium">Reasoning &amp; Context Trace</span>
              </div>
              {isThoughtOpen ? (
                <ChevronUp className="w-3.5 h-3.5 transition-transform" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 transition-transform" />
              )}
            </button>
            {isThoughtOpen && (
              <div className="p-3.5 text-xs font-mono text-forge-secondary border-t border-forge space-y-1.5 bg-forge-canvas/40 leading-relaxed">
                {Array.isArray(message.thoughtTrace) ? (
                  message.thoughtTrace.map((trace, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-forge-accent font-bold">↳</span>
                      <span>{trace}</span>
                    </div>
                  ))
                ) : (
                  <pre className="whitespace-pre-wrap font-mono">{message.thoughtTrace}</pre>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attached Files Badges */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {message.attachments.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-forge-canvas border border-forge text-xs font-mono text-forge-secondary"
              >
                <FileText className="w-3.5 h-3.5 text-forge-accent shrink-0" />
                <span className="font-medium truncate max-w-[160px]">{att.name}</span>
                <span className="text-[11px] text-forge-muted tabular-nums">
                  {Math.max(1, Math.round(att.size / 1024))}KB
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Message Type Indicator */}
        {message.messageType && isAssistant && (
          <div className="flex items-center gap-2 pb-1">
            {message.messageType === 'status_report' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30 uppercase tracking-wider font-semibold">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Live Status Report
              </span>
            )}
            {message.messageType === 'task_plan' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30 uppercase tracking-wider font-semibold">
                <ListOrdered className="w-3.5 h-3.5 text-purple-400" />
                Autonomous Task Plan
              </span>
            )}
            {message.messageType === 'tool_result' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider font-semibold">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                Tool Execution Result
              </span>
            )}
            {message.messageType === 'approval_request' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Security Approval Gate
              </span>
            )}
            {message.messageType === 'failure' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30 uppercase tracking-wider font-semibold">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                Model / Execution Error
              </span>
            )}
          </div>
        )}

        {/* Main Text Content */}
        <div className="text-[13.5px] sm:text-[14px] leading-relaxed font-sans text-forge-primary">
          {renderFormattedContent(message.content)}
        </div>

        {/* Structured Task Result Card */}
        {message.taskResult && (
          <div className="p-3 rounded-xl bg-forge-canvas border border-forge font-mono text-xs space-y-1.5 mt-2 shadow-xs">
            <div className="flex items-center justify-between text-forge-secondary font-semibold">
              <span>Task #{message.taskResult.taskId}</span>
              <span className="text-emerald-400 font-bold">{message.taskResult.status}</span>
            </div>
            <div className="text-forge-muted text-[11px]">
              Execution Steps: {message.taskResult.completedStepsCount} of {message.taskResult.stepsCount} completed
            </div>
            {message.taskResult.output && (
              <div className="text-forge-primary text-xs pt-1.5 border-t border-forge leading-relaxed">
                {message.taskResult.output}
              </div>
            )}
          </div>
        )}

        {/* Cited Memory Runes */}
        {message.citedMemoryIds && message.citedMemoryIds.length > 0 && (
          <div className="pt-2 border-t border-forge/60 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-mono text-forge-muted uppercase tracking-wider">
              Memory Citations:
            </span>
            {message.citedMemoryIds.map((id) => (
              <span
                key={id}
                className="px-2 py-0.5 rounded-md text-xs font-mono bg-forge-elevated border border-forge text-forge-secondary font-medium"
              >
                #{id}
              </span>
            ))}
          </div>
        )}

        {/* Action Proposal Gate (if message contains approval payload) */}
        {message.actionProposal && onApproveProposal && onRejectProposal && (
          <div className="pt-2">
            <InlineApprovalCard
              approvalId={message.actionProposal.id}
              actionTitle={message.actionProposal.actionTitle}
              toolName={message.actionProposal.toolName}
              riskLevel={message.actionProposal.riskLevel}
              description={message.actionProposal.description}
              command={message.actionProposal.payload?.command as string | undefined}
              payload={message.actionProposal.payload}
              status={message.actionProposal.status}
              onApprove={() => onApproveProposal(message.actionProposal!.id)}
              onReject={() => onRejectProposal(message.actionProposal!.id)}
              isResolving={isResolvingApproval}
              onOpenFile={onOpenFile}
            />
          </div>
        )}
      </div>

      {/* Message Action Bar (Copy to Clipboard) */}
      <div
        className={`flex items-center gap-1.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <button
          type="button"
          onClick={handleCopyMessage}
          className="p-1.5 rounded-md text-forge-muted hover:text-forge-primary hover:bg-forge-elevated text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          title="Copy message to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-xs">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="my-3 rounded-xl border border-forge/80 bg-[#0d1117] dark:bg-[#070a0f] overflow-hidden shadow-md">
      {/* Code Header Bar (Code editor feel) */}
      <div className="h-8 px-3.5 bg-forge-panel/90 border-b border-forge flex items-center justify-between text-xs font-mono text-forge-muted select-none">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-forge-accent" />
          <span className="text-forge-secondary uppercase text-[11px] tracking-wider font-semibold">
            {language}
          </span>
          <span className="text-forge-muted/40">•</span>
          <span className="text-[11px] text-forge-muted font-normal">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs text-forge-muted hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 text-[13px] font-mono leading-relaxed text-slate-100 overflow-x-auto whitespace-pre custom-scrollbar">
        {code}
      </pre>
    </div>
  );
};
