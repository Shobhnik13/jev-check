'use client';

import {useRef, type PointerEvent} from 'react';

import type {Box} from '@/lib/api';
import {clamp} from '@/lib/geometry';

type Mode = 'move' | 'new' | 'tl' | 'tr' | 'bl' | 'br';

const MIN = 0.02;
const HANDLES: Mode[] = ['tl', 'tr', 'bl', 'br'];

// Drag inside to move, drag a corner to resize, drag outside to draw a new box.
export function BoxEditor({box, onChange, tone = 'sky'}: {box: Box; onChange: (box: Box) => void; tone?: 'sky' | 'lime'}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{mode: Mode; x: number; y: number; box: Box} | null>(null);

  const point = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return {x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height)};
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const {x, y} = point(e);
    const handle = (e.target as HTMLElement).dataset.handle as Mode | undefined;
    const inside = x > box.left && x < box.right && y > box.top && y < box.bottom;
    drag.current = {mode: handle ?? (inside ? 'move' : 'new'), x, y, box};
    ref.current!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;

    if (!d) {
      return;
    }

    const {x, y} = point(e);
    let b = {...d.box};

    if (d.mode === 'move') {
      const dx = clamp(x - d.x, -b.left, 1 - b.right);
      const dy = clamp(y - d.y, -b.top, 1 - b.bottom);
      b = {left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy};
    } else if (d.mode === 'new') {
      b = {left: Math.min(d.x, x), right: Math.max(d.x, x), top: Math.min(d.y, y), bottom: Math.max(d.y, y)};

      if (b.right - b.left < MIN || b.bottom - b.top < MIN) {
        return;
      }
    } else {
      if (d.mode.includes('l')) {
        b.left = Math.min(x, b.right - MIN);
      } else {
        b.right = Math.max(x, b.left + MIN);
      }

      if (d.mode.includes('t')) {
        b.top = Math.min(y, b.bottom - MIN);
      } else {
        b.bottom = Math.max(y, b.top + MIN);
      }
    }

    onChange(b);
  };

  const onUp = () => {
    drag.current = null;
  };

  const color = tone === 'lime' ? 'border-lime-400 bg-lime-400/10' : 'border-sky-400 bg-sky-400/10';
  const handleColor = tone === 'lime' ? 'bg-lime-400' : 'bg-sky-400';

  return (
    <div ref={ref} className="absolute inset-0 cursor-crosshair touch-none select-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div
        className={`absolute cursor-move rounded-md border-2 ${color} shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]`}
        style={{left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${(box.right - box.left) * 100}%`, height: `${(box.bottom - box.top) * 100}%`}}
      >
        {HANDLES.map((h) => (
          <span
            key={h}
            data-handle={h}
            className={`absolute h-4 w-4 rounded-full border-2 border-black ${handleColor} ${h.includes('t') ? '-top-2' : '-bottom-2'} ${h.includes('l') ? '-left-2' : '-right-2'} ${h === 'tl' || h === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`}
          />
        ))}
      </div>
    </div>
  );
}
