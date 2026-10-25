import React from 'react';

export type BadgeVariant = 'emerald' | 'amber' | 'sky' | 'rose' | 'zinc' | 'purple' | 'replicate' | 'claude';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-600 dark:bg-amber-400',
  },
  sky: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-800 dark:text-sky-400',
    border: 'border-sky-500/30',
    dot: 'bg-sky-600 dark:bg-sky-400',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-800 dark:text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-600 dark:bg-rose-400',
  },
  zinc: {
    bg: 'bg-elevated',
    text: 'text-dim',
    border: 'border-subtle',
    dot: 'bg-zinc-400',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    text: 'text-purple-800 dark:text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-600 dark:bg-purple-400',
  },
  replicate: {
    bg: 'bg-[#ea2804]/10 dark:bg-[#ea2804]/15',
    text: 'text-[#ea2804] dark:text-[#ff4e2f]',
    border: 'border-[#ea2804]/30',
    dot: 'bg-[#ea2804]',
  },
  claude: {
    bg: 'bg-[#cc785c]/10 dark:bg-[#cc785c]/15',
    text: 'text-[#cc785c] dark:text-[#e08f75]',
    border: 'border-[#cc785c]/30',
    dot: 'bg-[#cc785c]',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'zinc',
  dot = false,
  className = '',
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${styles.bg} ${styles.text} ${styles.border} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      {children}
    </span>
  );
};
