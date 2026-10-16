'use client';

import type {CSSProperties, ReactNode} from 'react';

import type {Box} from '@/lib/api';

// Keeps the image and its overlays in one coordinate space: percentages of the frame.
export function Frame({width, height, mirrored, maxHeight = '68vh', className = '', children}: {width: number; height: number; mirrored?: boolean; maxHeight?: string; className?: string; children: ReactNode}) {
  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-2xl bg-black ring-1 ring-fg/10 ${className}`}
      style={{aspectRatio: `${width} / ${height}`, width: `min(100%, calc(${maxHeight} * ${width / height}))`, transform: mirrored ? 'scaleX(-1)' : undefined}}
    >
      {children}
    </div>
  );
}

export type BoxTone = 'target' | 'fit' | 'near' | 'reference' | 'absent';

const TONES: Record<BoxTone, string> = {
  target: 'border-2 border-dashed border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]',
  fit: 'border-[3px] border-lime-400 bg-lime-400/10 shadow-[0_0_24px_rgba(163,230,53,0.45)]',
  near: 'border-2 border-amber-400 bg-amber-400/5',
  reference: 'border-2 border-sky-400 bg-sky-400/10',
  absent: 'border-2 border-rose-500/70 border-dotted',
};

const CHIPS: Record<BoxTone, string> = {
  target: 'bg-white text-black',
  fit: 'bg-lime-400 text-black',
  near: 'bg-amber-400 text-black',
  reference: 'bg-sky-400 text-black',
  absent: 'bg-rose-500 text-white',
};

export function BoxRect({box, tone, label, mirrored, animate = true}: {box: Box; tone: BoxTone; label?: string; mirrored?: boolean; animate?: boolean}) {
  const style: CSSProperties = {
    left: `${box.left * 100}%`,
    top: `${box.top * 100}%`,
    width: `${(box.right - box.left) * 100}%`,
    height: `${(box.bottom - box.top) * 100}%`,
  };

  return (
    <div className={`pointer-events-none absolute rounded-md ${TONES[tone]} ${animate ? 'transition-all duration-300 ease-out' : ''}`} style={style}>
      {label ? (
        <span className={`absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${CHIPS[tone]}`} style={{transform: mirrored ? 'scaleX(-1)' : undefined}}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
