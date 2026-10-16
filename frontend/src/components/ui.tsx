'use client';

import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from 'react';

export function Stat({label, value}: {label: string; value: ReactNode}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="truncate font-mono text-sm tabular-nums text-zinc-100">{value}</div>
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'ghost' | 'danger'};

const VARIANTS = {
  primary: 'bg-lime-400 text-black hover:brightness-110',
  ghost: 'bg-zinc-800/80 text-zinc-100 hover:bg-zinc-700 ring-1 ring-fg/10',
  danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 ring-1 ring-rose-500/30',
};

export function buttonClass(variant: keyof typeof VARIANTS = 'ghost', className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`;
}

export function Button({variant = 'ghost', className = '', ...props}: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ErrorNote({error}: {error: string | null}) {
  return error ? <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">{error}</div> : null;
}

export function Panel({children, className = '', ...props}: HTMLAttributes<HTMLDivElement> & {[key: `data-${string}`]: string}) {
  return (
    <div className={`rounded-2xl bg-zinc-900/70 p-4 ring-1 ring-fg/10 ${className}`} {...props}>
      {children}
    </div>
  );
}
