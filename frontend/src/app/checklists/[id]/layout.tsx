'use client';

import Link from 'next/link';
import {useParams, usePathname} from 'next/navigation';
import {useCallback, useEffect, useState, type ReactNode} from 'react';

import {ChecklistContext} from '@/components/checklist-context';
import {ErrorNote} from '@/components/ui';
import {api, errorText, type ChecklistDetail} from '@/lib/api';

export default function ChecklistLayout({children}: {children: ReactNode}) {
  const {id} = useParams<{id: string}>();
  const pathname = usePathname();
  const [checklist, setChecklist] = useState<ChecklistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setChecklist(await api.getChecklist(Number(id)));
    } catch (err) {
      setError(errorText(err));
    }
  }, [id]);

  useEffect(() => {
    let alive = true;

    api.getChecklist(Number(id)).then(
      (c) => alive && setChecklist(c),
      (err) => alive && setError(errorText(err)),
    );

    return () => {
      alive = false;
    };
  }, [id, pathname]);

  const base = `/checklists/${id}`;
  const tabs = [
    {href: base, label: 'Check a photo', tour: 'tab-check'},
    {href: `${base}/runs`, label: 'History', tour: 'tab-history', badge: checklist?.stats.needs_review},
    {href: `${base}/edit`, label: 'Edit rules', tour: 'tab-edit'},
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div>
          <Link href="/checklists" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← My checks
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{checklist?.name ?? '…'}</h1>
          {checklist?.description ? <p className="text-zinc-400">{checklist.description}</p> : null}
        </div>
        <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-900/70 p-1 ring-1 ring-fg/10 sm:w-fit">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} data-tour={tab.tour} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition ${pathname === tab.href ? 'bg-fg font-medium text-fg-inverse' : 'text-zinc-300 hover:bg-zinc-800'}`}>
              {tab.label}
              {tab.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-medium text-black">{tab.badge}</span> : null}
            </Link>
          ))}
        </nav>
      </header>

      <ErrorNote error={error} />
      {checklist ? <ChecklistContext.Provider value={{checklist, refresh}}>{children}</ChecklistContext.Provider> : null}
    </div>
  );
}
