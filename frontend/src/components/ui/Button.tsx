import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'memorag' | 'chat' | 'dev';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#ea2804] hover:bg-[#c01f00] text-white font-semibold shadow-xs active:translate-y-px border border-transparent rounded-full',
  secondary:
    'bg-elevated hover:bg-subtle text-main border border-subtle font-medium active:translate-y-px rounded-full',
  outline:
    'bg-transparent hover:bg-elevated text-dim hover:text-main border border-medium font-medium active:translate-y-px rounded-full',
  ghost:
    'bg-transparent hover:bg-elevated text-dim hover:text-main border border-transparent font-medium rounded-full',
  danger:
    'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 active:translate-y-px rounded-full font-medium',
  memorag:
    'bg-[#cc785c] hover:bg-[#a9583e] text-white font-medium shadow-xs active:translate-y-px border border-transparent rounded-full',
  chat:
    'bg-[#ea2804] hover:bg-[#c01f00] text-white font-medium shadow-xs active:translate-y-px border border-transparent rounded-full',
  dev:
    'bg-[#cc785c] hover:bg-[#a9583e] text-white font-medium shadow-xs active:translate-y-px border border-transparent rounded-full',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-xs gap-1.5',
  md: 'px-4 py-1.5 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
};

/* Hallmark · component: button · states: default · hover · focus-visible · active · disabled · loading */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center whitespace-nowrap select-none transition-[background-color,border-color,color,transform,opacity] duration-150 ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-current ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5 shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
