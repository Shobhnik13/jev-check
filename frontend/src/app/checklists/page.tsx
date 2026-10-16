'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';

import {TourButton, useTour, type TourStep} from '@/components/tour';
import {Button, buttonClass, ErrorNote} from '@/components/ui';
import {api, errorText, type Checklist} from '@/lib/api';
import {demoChecklistId} from '@/lib/demo';

const TOUR: TourStep[] = [
  {title: 'Welcome!', text: 'A “check” is a list of simple rules about a photo, like “Is the parcel at the door?”. This page lists your checks.'},
  {element: '[data-tour="demo"]', title: 'Try the demo first', text: 'A ready-made check that works with your laptop camera. No setup needed.'},
  {element: '[data-tour="new"]', title: 'Make your own', text: 'Start from an example (deliveries, safety gear, packing) or write your own rules.'},
  {element: '[data-tour="nav-items"]', title: 'Your items', text: 'Want the app to spot a specific thing, like your product? Add a photo of it here once.'},
];

export default function ChecksPage() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<Checklist[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTour = useTour('checks', TOUR, {ready: checklists !== null});

  useEffect(() => {
    api.getChecklists().then(setChecklists, (err) => setError(errorText(err)));
  }, []);

  const openDemo = async () => {
    setBusy(true);

    try {
      router.push(`/checklists/${await demoChecklistId()}?tour=1`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">My checks</h1>
          <p className="text-zinc-400">Pick a check, then take a photo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TourButton onClick={startTour} />
          <Button onClick={openDemo} disabled={busy} data-tour="demo">
            {busy ? 'Opening…' : 'Try the demo'}
          </Button>
          <Link href="/checklists/new" className={buttonClass('primary')} data-tour="new">
            + New check
          </Link>
        </div>
      </div>

      <ErrorNote error={error} />

      {checklists && !checklists.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <button onClick={openDemo} className="space-y-2 rounded-2xl bg-lime-400/10 p-6 text-left ring-1 ring-lime-400/30 transition hover:bg-lime-400/15">
            <div className="text-lg font-medium text-lime-200">Try the demo check →</div>
            <p className="text-sm text-zinc-300">Point your laptop camera at your desk. The app checks for a mug, a laptop and a smile.</p>
          </button>
          <Link href="/checklists/new" className="space-y-2 rounded-2xl p-6 ring-1 ring-fg/10 transition hover:ring-fg/30">
            <div className="text-lg font-medium">Create your own check →</div>
            <p className="text-sm text-zinc-400">Start from an example like deliveries or safety gear, or write your own rules.</p>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(checklists ?? []).map((c) => {
          const s = c.stats;
          return (
            <Link key={c.id} href={`/checklists/${c.id}`} className="flex flex-col gap-3 rounded-2xl bg-zinc-900/70 p-5 ring-1 ring-fg/10 transition hover:ring-fg/30">
              <div>
                <div className="text-lg font-medium">{c.name}</div>
                <p className="text-sm text-zinc-400">{c.description || `${c.items.length} rules`}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                {s.runs ? (
                  <span>
                    {s.runs} photos checked · {s.pass} passed
                  </span>
                ) : (
                  <span>No photos checked yet</span>
                )}
                {s.needs_review ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-medium text-black">{s.needs_review} need you</span> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
