'use client';

import {driver, type DriveStep} from 'driver.js';
import 'driver.js/dist/driver.css';
import {useCallback, useEffect} from 'react';

export type TourStep = {element?: string; title: string; text: string};

function seen(key: string) {
  try {
    return localStorage.getItem(`tour:${key}`) === '1';
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(`tour:${key}`, '1');
  } catch {}
}

// Runs once per page for a new visitor (or when forced), and can be replayed from a button.
export function useTour(key: string, steps: TourStep[], options: {auto?: boolean; force?: boolean; ready?: boolean} = {}) {
  const {auto = true, force = false, ready = true} = options;

  const start = useCallback(() => {
    const driveSteps: DriveStep[] = steps
      .filter((s) => !s.element || document.querySelector(s.element))
      .map((s) => ({element: s.element, popover: {title: s.title, description: s.text}}));

    driver({
      steps: driveSteps,
      showProgress: driveSteps.length > 1,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Got it',
      popoverClass: 'jev-tour',
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 14,
      onDestroyed: () => markSeen(key),
    }).drive();
  }, [key, steps]);

  useEffect(() => {
    if (!ready || !auto || (!force && seen(key))) {
      return;
    }

    const timer = setTimeout(start, 700);
    return () => clearTimeout(timer);
  }, [ready, auto, force, key, start]);

  return start;
}

export function TourButton({onClick}: {onClick: () => void}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-zinc-400 ring-1 ring-fg/10 transition hover:text-fg hover:ring-fg/30">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-zinc-700 text-[10px] font-bold">?</span>
      Show me around
    </button>
  );
}
