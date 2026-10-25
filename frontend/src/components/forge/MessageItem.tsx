'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Brain,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  User,
  Bot,
  FileText,
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
        <div key={index} className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
          {part}
        </div>
      );
    });
  };

  if (isSystem) {
    return (
      <div className="py-2 px-3 rounded-lg bg-forge-panel border border-forge text-[11px] font-mono text-forge-muted flex items-center gap-2 max-w-2xl mx-auto my-1">
        <Sparkles className="w-3.5 h-3.5 text-forge-accent shrink-0" />
        <span className="flex-1">{message.content}</span>
        <span className="text-[10px] text-forge-muted/60">{message.timestamp}</span>
      </div>
    );
  }

  return (
    <div
      role="article"
      aria-label={`${isUser ? 'User message' : 'Assistant message'} at ${message.timestamp}`}
      className={`group flex flex-col space-y-1.5 py-1 transition-opacity ${
        isUser ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender Header */}
      <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-forge-muted">
        {isUser ? (
          <>
            <span className="text-forge-secondary font-medium">You</span>
            <span>•</span>
            <span>{message.timestamp}</span>
            <div className="w-4 h-4 rounded-full bg-forge-elevated border border-forge flex items-center justify-center text-forge-muted">
              <User className="w-2.5 h-2.5" />
            </div>
          </>
        ) : (
          <>
            <div className="w-4 h-4 rounded-full bg-forge-accent/15 border border-forge-accent/30 flex items-center justify-center text-forge-accent">
              <Bot className="w-2.5 h-2.5" />
            </div>
            <span className="text-forge-primary font-semibold">MEMORAG Sovereign Agent</span>
            <span>•</span>
            <span className="text-emerald-400 flex items-center gap-0.5">
              <ShieldCheck className="w-3 h-3 inline" />
              <span>Loopback</span>
            </span>
            <span>•</span>
            <span>{message.timestamp}</span>
          </>
        )}
      </div>

      {/* Message Content Bubble */}
      <div
        className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3.5 text-xs select-text shadow-xs ${
          isUser
            ? 'bg-forge-elevated border border-forge text-forge-primary rounded-tr-xs'
            : 'bg-forge-panel border border-forge text-forge-primary rounded-tl-xs space-y-3'
        }`}
      >
        {/* Assistant Thought Trace Accordion */}
        {isAssistant && message.thoughtTrace && (
          <div className="rounded-lg border border-forge bg-forge-canvas overflow-hidden">
            <button
              type="button"
              onClick={() => setIsThoughtOpen((prev) => !prev)}
              className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-forge-muted hover:text-forge-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-forge-accent" />
                <span>Mimir Reasoning &amp; Context Trace</span>
              </div>
              {isThoughtOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {isThoughtOpen && (
              <div className="p-3 text-[11px] font-mono text-forge-secondary border-t border-forge space-y-1 bg-forge-elevated/40 leading-relaxed">
                {Array.isArray(message.thoughtTrace) ? (
                  message.thoughtTrace.map((trace, i) => (
                    <div key={i} className="flex items-start gap-1.5">
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
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            {message.attachments.map((att, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-forge-canvas border border-forge text-[11px] font-mono text-forge-secondary"
              >
                <FileText className="w-3 h-3 text-forge-accent shrink-0" />
                <span className="font-medium truncate max-w-[150px]">{att.name}</span>
                <span className="text-[10px] text-forge-muted tabular-nums">
                  {Math.max(1, Math.round(att.size / 1024))}KB
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Main Text Content */}
        <div className="text-xs sm:text-[13px] leading-relaxed font-sans">
          {renderFormattedContent(message.content)}
        </div>

        {/* Cited Memory Runes */}
        {message.citedMemoryIds && message.citedMemoryIds.length > 0 && (
          <div className="pt-2 border-t border-forge flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-forge-muted uppercase tracking-wider">
              Memory Citations:
            </span>
            {message.citedMemoryIds.map((id) => (
              <span
                key={id}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-forge-elevated border border-forge text-forge-secondary"
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
          className="p-1 rounded text-forge-muted hover:text-forge-primary hover:bg-forge-elevated text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          title="Copy message to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[10px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-mono text-[10px]">Copy</span>
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

  return (
    <div className="my-2.5 rounded-lg border border-forge bg-forge-canvas overflow-hidden">
      {/* Code Header Bar */}
      <div className="h-7 px-3 bg-forge-panel border-b border-forge flex items-center justify-between text-[11px] font-mono text-forge-muted select-none">
        <span className="text-forge-secondary uppercase text-[10px] tracking-wider font-semibold">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:text-forge-primary hover:bg-forge-elevated transition-colors cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-3 text-[11px] font-mono leading-5 text-forge-primary overflow-x-auto whitespace-pre custom-scrollbar">
        {code}
      </pre>
    </div>
  );
};
