'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';

import {Button, buttonClass, ErrorNote} from '@/components/ui';
import {errorText} from '@/lib/api';
import {demoChecklistId} from '@/lib/demo';

const FEATURES = [
  {icon: '◉', title: 'Uses your camera', text: 'Take a photo or point your phone or laptop camera. No special hardware.'},
  {icon: '☰', title: 'Checks many things at once', text: 'Is the item there? Is the label readable? Is the box sealed? All answered together.'},
  {icon: '▢', title: 'Shows where things are', text: 'Items it finds are outlined right on the photo.'},
  {icon: '?', title: 'Asks you when unsure', text: 'Borderline photos wait for a person instead of guessing.'},
];

const STEPS = [
  {title: 'Say what to look for', text: 'Pick an example or write simple rules like “Is the parcel at the door?”'},
  {title: 'Take a photo', text: 'Snap one, or let the live camera check as you move.'},
  {title: 'Get the answer', text: 'A clear pass or fail, with each rule ticked or crossed.'},
];

const USES = ['Packing orders', 'Delivery proof', 'Safety gear', 'Shelf checks', 'Equipment inspections', 'Room handovers'];

export default function Landing() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryDemo = async () => {
    setBusy(true);
    setError(null);

    try {
      router.push(`/checklists/${await demoChecklistId()}?tour=1`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-24 py-8">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Check photos
            <br />
            <span className="text-lime-300">automatically.</span>
          </h1>
          <p className="max-w-xl text-lg text-zinc-400">Tell the app what should be in a photo. Take a picture. It tells you if everything is there, and shows you where.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/checklists" className={buttonClass('primary', 'px-6 py-3 text-base')}>
              Start
            </Link>
            <Button onClick={tryDemo} disabled={busy} className="px-6 py-3 text-base">
              {busy ? 'Opening demo…' : 'Try a 30-second demo'}
            </Button>
          </div>
          <ErrorNote error={error} />
        </div>
        <DemoCard />
      </section>

      <section className="space-y-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight">What it does</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="space-y-3 rounded-2xl bg-zinc-900/60 p-5 ring-1 ring-fg/5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-400/10 text-lg text-lime-300">{f.icon}</span>
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="space-y-2 rounded-2xl p-5 ring-1 ring-fg/10">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400 font-semibold text-black">{i + 1}</span>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm text-zinc-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-5 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Good for</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {USES.map((u) => (
            <span key={u} className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-zinc-300 ring-1 ring-fg/10">
              {u}
            </span>
          ))}
        </div>
        <div className="pt-6">
          <Link href="/checklists" className={buttonClass('primary', 'px-8 py-3 text-base')}>
            Start checking
          </Link>
        </div>
      </section>
    </div>
  );
}

// A static picture of a result, so the idea lands before anyone clicks.
function DemoCard() {
  const rules = [
    {text: 'Mug is in the photo', ok: true},
    {text: 'Laptop is in the photo', ok: true},
    {text: 'Desk is tidy', ok: false},
  ];

  return (
    <div className="rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-fg/10">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900">
        <div className="absolute bottom-[18%] left-[12%] h-[34%] w-[22%] rounded-b-2xl rounded-t-md bg-amber-200/80" />
        <div className="absolute bottom-[18%] right-[10%] h-[40%] w-[46%] rounded-lg bg-zinc-400/70" />
        <div className="absolute bottom-[14%] left-0 right-0 h-[4%] bg-zinc-950/50" />
        <Outline className="bottom-[16%] left-[10%] h-[38%] w-[26%]" label="Mug" />
        <Outline className="bottom-[16%] right-[8%] h-[44%] w-[50%]" label="Laptop" delay />
      </div>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-rose-500/15 px-3 py-2 text-rose-200 ring-1 ring-rose-500/30">
          <span className="font-semibold">Something is wrong</span>
          <span className="text-sm opacity-80">2 of 3 rules passed</span>
        </div>
        {rules.map((r) => (
          <div key={r.text} className="flex items-center gap-3 px-1 text-sm">
            <span className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${r.ok ? 'bg-lime-400 text-black' : 'bg-rose-500 text-white'}`}>{r.ok ? '✓' : '✗'}</span>
            {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Outline({className, label, delay}: {className: string; label: string; delay?: boolean}) {
  return (
    <div className={`absolute animate-pulse rounded-lg border-[3px] border-lime-400 shadow-[0_0_24px_rgba(163,230,53,0.4)] ${className}`} style={{animationDelay: delay ? '0.6s' : undefined}}>
      <span className="absolute -top-6 left-0 rounded bg-lime-400 px-1.5 py-0.5 text-[11px] font-semibold text-black">{label}</span>
    </div>
  );
}
