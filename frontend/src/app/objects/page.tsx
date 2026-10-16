'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState, type FormEvent} from 'react';

import {Button, ErrorNote, Panel} from '@/components/ui';
import {api, errorText, type ObjectRecord} from '@/lib/api';

export default function ObjectsPage() {
  const router = useRouter();
  const [objects, setObjects] = useState<ObjectRecord[] | null>(null);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getObjects().then(setObjects, (err) => setError(errorText(err)));
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const object = await api.createObject({label: label.trim(), name: name.trim() || undefined});
      router.push(`/objects/${object.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My items</h1>
          <p className="text-sm text-zinc-400">Specific things you want the app to find, like your product or a tool. Add one photo of each.</p>
        </div>
        <ErrorNote error={error} />
        {objects && !objects.length ? <Panel className="py-10 text-center text-sm text-zinc-500">No items yet. You only need items for “Find my item” rules. Yes/no questions work without them.</Panel> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(objects ?? []).map((o) => (
            <Link key={o.id} href={`/objects/${o.id}`} className="flex gap-3 rounded-2xl bg-zinc-900/70 p-3 ring-1 ring-fg/10 transition hover:ring-fg/30">
              <div className="flex -space-x-4">
                {o.references.slice(0, 3).map((r) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={r.id} src={api.fileUrl(r.crop)} alt="" className="h-16 w-16 rounded-xl object-cover ring-2 ring-zinc-900" />
                ))}
                {!o.references.length ? <div className="grid h-16 w-16 place-items-center rounded-xl bg-zinc-800 text-[11px] text-amber-300">add photo</div> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{o.name}</div>
                <div className="truncate text-sm text-zinc-400">{o.label}</div>
                <div className="text-xs text-zinc-500">{o.references.length} {o.references.length === 1 ? 'photo' : 'photos'}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Panel className="h-fit">
        <form onSubmit={create} className="space-y-3">
          <h2 className="font-medium">New item</h2>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Describe it</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. black wireless earbuds case" required className="input" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Short name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Earbuds" className="input" />
          </label>
          <p className="text-xs text-zinc-500">Plain words work best, like you would describe it to a friend.</p>
          <Button variant="primary" type="submit" disabled={busy || !label.trim()} className="w-full">
            {busy ? 'Creating…' : 'Next: add a photo'}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
