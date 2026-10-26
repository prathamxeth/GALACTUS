'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';

interface StepperContextValue {
  activeStep?: number;
  orientation?: 'horizontal' | 'vertical';
}

const StepperContext = createContext<StepperContextValue>({});

export interface StepperProps {
  children: ReactNode;
  activeStep?: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Stepper({
  children,
  activeStep = 1,
  orientation = 'vertical',
  className = '',
}: StepperProps) {
  return (
    <StepperContext.Provider value={{ activeStep, orientation }}>
      <div className={`w-full ${className}`}>
        {children}
      </div>
    </StepperContext.Provider>
  );
}

export function StepperNav({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { orientation } = useContext(StepperContext);
  return (
    <div
      className={`flex ${
        orientation === 'vertical' ? 'flex-col gap-0' : 'flex-row items-center justify-between'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export interface StepperItemProps {
  step: number;
  state?: StepState;
  children: ReactNode;
  className?: string;
  isLast?: boolean;
}

export function StepperItem({
  state = 'pending',
  children,
  className = '',
  isLast = false,
}: StepperItemProps) {
  return (
    <div className={`relative flex items-start gap-3 ${!isLast ? 'pb-5' : 'pb-0'} ${className}`}>
      {/* Vertical Connecting Line */}
      {!isLast && (
        <div
          aria-hidden="true"
          className={`absolute left-[13px] top-7 bottom-0 w-[2px] transition-colors duration-200 ${
            state === 'completed'
              ? 'bg-[#2b9a66]'
              : state === 'running'
              ? 'bg-[#cc785c]'
              : 'bg-subtle'
          }`}
        />
      )}
      {children}
    </div>
  );
}

export interface StepperIndicatorProps {
  step: number;
  state?: StepState;
  className?: string;
}

export function StepperIndicator({
  step,
  state = 'pending',
  className = '',
}: StepperIndicatorProps) {
  const isCompleted = state === 'completed';
  const isRunning = state === 'running';
  const isFailed = state === 'failed';
  const isWaiting = state === 'awaiting_approval';

  let stateStyles = 'bg-surface border-subtle text-dim';
  let content: ReactNode = step;

  if (isCompleted) {
    stateStyles = 'bg-[#2b9a66] border-[#2b9a66] text-white shadow-xs';
    content = <Check className="w-3.5 h-3.5 stroke-[2.5]" />;
  } else if (isRunning) {
    stateStyles = 'bg-[#cc785c] border-[#cc785c] text-white shadow-xs animate-pulse';
    content = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
  } else if (isFailed) {
    stateStyles = 'bg-rose-500 border-rose-500 text-white';
    content = <AlertCircle className="w-3.5 h-3.5" />;
  } else if (isWaiting) {
    stateStyles = 'bg-amber-500 border-amber-500 text-white';
    content = '!';
  }

  return (
    <div
      className={`relative z-10 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-mono font-semibold shrink-0 transition-[background-color,border-color,color] duration-200 tabular-nums ${stateStyles} ${className}`}
    >
      {content}
    </div>
  );
}

export function StepperTitle({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-xs font-semibold text-main leading-tight pt-1 ${className}`}>
      {children}
    </div>
  );
}

export function StepperDescription({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[11px] text-dim leading-relaxed font-mono mt-0.5 ${className}`}>
      {children}
    </p>
  );
}
