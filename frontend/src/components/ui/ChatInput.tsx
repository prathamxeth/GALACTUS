'use client';

import React, { createContext, useContext, KeyboardEvent, ChangeEventHandler, ReactNode } from 'react';
import { ArrowUp, Square, Loader2 } from 'lucide-react';
import { useTextareaResize } from '@/hooks/use-textarea-resize';

interface ChatInputContextValue {
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
  loading?: boolean;
  onStop?: () => void;
  rows?: number;
  disabled?: boolean;
}

const ChatInputContext = createContext<ChatInputContextValue>({});

export interface ChatInputProps extends ChatInputContextValue {
  children: ReactNode;
  className?: string;
}

export function ChatInput({
  children,
  className = '',
  value,
  onChange,
  onSubmit,
  loading = false,
  onStop,
  rows = 2,
  disabled = false,
}: ChatInputProps) {
  const contextValue: ChatInputContextValue = {
    value,
    onChange,
    onSubmit,
    loading,
    onStop,
    rows,
    disabled,
  };

  return (
    <ChatInputContext.Provider value={contextValue}>
      <div
        className={`relative flex flex-col w-full rounded-2xl bg-surface border border-subtle shadow-sm transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-medium focus-within:shadow-md ${className}`}
      >
        {children}
      </div>
    </ChatInputContext.Provider>
  );
}

ChatInput.displayName = 'ChatInput';

export interface ChatInputTextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onSubmit'> {
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
}

export function ChatInputTextArea({
  onSubmit: onSubmitProp,
  value: valueProp,
  onChange: onChangeProp,
  className = '',
  placeholder = 'Message MEMORAG...',
  ...props
}: ChatInputTextAreaProps) {
  const context = useContext(ChatInputContext);
  const value = valueProp ?? context.value ?? '';
  const onChange = onChangeProp ?? context.onChange;
  const onSubmit = onSubmitProp ?? context.onSubmit;
  const rows = context.rows ?? 2;
  const disabled = context.disabled || props.disabled;

  const textareaRef = useTextareaResize(value, rows);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (typeof value !== 'string' || value.trim().length === 0 || disabled || context.loading) {
        return;
      }
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      className={`w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-main placeholder-faint resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed font-sans ${className}`}
      {...props}
    />
  );
}

ChatInputTextArea.displayName = 'ChatInputTextArea';

export interface ChatInputSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onSubmit?: () => void;
  loading?: boolean;
  onStop?: () => void;
}

export function ChatInputSubmit({
  onSubmit: onSubmitProp,
  loading: loadingProp,
  onStop: onStopProp,
  className = '',
  ...props
}: ChatInputSubmitProps) {
  const context = useContext(ChatInputContext);
  const loading = loadingProp ?? context.loading;
  const onStop = onStopProp ?? context.onStop;
  const onSubmit = onSubmitProp ?? context.onSubmit;
  const disabled = context.disabled || props.disabled;

  // 1. Loading with Stop capability
  if (loading && onStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        title="Stop response"
        className={`w-8 h-8 rounded-full bg-[#ea2804] text-white flex items-center justify-center hover:bg-[#c01f00] transition-[background-color,transform] duration-150 ease-out active:translate-y-px cursor-pointer shadow-xs select-none ${className}`}
        {...props}
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    );
  }

  // 2. Loading spinner
  if (loading) {
    return (
      <div
        className={`w-8 h-8 rounded-full bg-[#ea2804]/20 text-[#ea2804] flex items-center justify-center ${className}`}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  const isEmpty = typeof context.value !== 'string' || context.value.trim().length === 0;
  const isSubmitDisabled = isEmpty || disabled;

  return (
    <button
      type="button"
      disabled={isSubmitDisabled}
      onClick={(e) => {
        e.preventDefault();
        if (!isSubmitDisabled) {
          onSubmit?.();
        }
      }}
      title="Send prompt to MEMORAG (Enter)"
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-[background-color,color,transform] duration-150 ease-out active:translate-y-px select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSubmitDisabled
          ? 'bg-subtle text-faint cursor-not-allowed opacity-60'
          : 'bg-[#ea2804] hover:bg-[#c01f00] text-white shadow-xs cursor-pointer'
      } ${className}`}
      {...props}
    >
      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
    </button>
  );
}

ChatInputSubmit.displayName = 'ChatInputSubmit';
