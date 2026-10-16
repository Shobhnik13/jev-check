'use client';

import {useEffect, useState} from 'react';

type Choice = 'system' | 'light' | 'dark';

const NEXT: Record<Choice, Choice> = {system: 'light', light: 'dark', dark: 'system'};
const LABEL: Record<Choice, string> = {system: 'Auto', light: 'Light', dark: 'Dark'};
const ICON: Record<Choice, string> = {system: '◐', light: '☀', dark: '☾'};

// Runs in <head> before paint, so the page never flashes the wrong theme.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var l=window.matchMedia('(prefers-color-scheme: light)').matches;document.documentElement.dataset.theme=t==='light'||t==='dark'?t:l?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()`;

function read(): Choice {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: Choice) {
  const light = choice === 'light' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => (read() === 'system' ? apply('system') : null);
    const timer = setTimeout(() => setChoice(read()));

    media.addEventListener('change', onChange);
    return () => {
      clearTimeout(timer);
      media.removeEventListener('change', onChange);
    };
  }, []);

  const cycle = () => {
    const next = NEXT[choice ?? 'system'];

    try {
      if (next === 'system') {
        localStorage.removeItem('theme');
      } else {
        localStorage.setItem('theme', next);
      }
    } catch {}

    apply(next);
    setChoice(next);
  };

  return (
    <button onClick={cycle} title="Change theme" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-zinc-400 ring-1 ring-fg/10 transition hover:text-fg hover:ring-fg/30">
      <span aria-hidden>{ICON[choice ?? 'system']}</span>
      {LABEL[choice ?? 'system']}
    </button>
  );
}
