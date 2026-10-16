'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useCallback, useEffect, useState} from 'react';

import {BoxEditor} from '@/components/box-editor';
import {Frame} from '@/components/frame';
import {ShotPicker} from '@/components/shot-picker';
import {Button, ErrorNote, Panel} from '@/components/ui';
import {api, errorText, type Box, type ObjectRecord, type Reference} from '@/lib/api';

type Editing = {reference: Reference; box: Box; note: string | null};

export default function ObjectPage() {
  const {id} = useParams<{id: string}>();
  const [object, setObject] = useState<ObjectRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api.getObject(Number(id)).then(setObject, (err) => setError(errorText(err))), [id]);

  useEffect(() => {
    api.getObject(Number(id)).then(
      (o) => {
        setObject(o);
        setLabel(o.label);
        setAdding(!o.references.length);
      },
      (err) => setError(errorText(err)),
    );
  }, [id]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);

    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onShot = (frame: Blob) =>
    act(async () => {
      const reference = await api.createReference(Number(id), frame);
      const located = reference.located;
      setAdding(false);
      setEditing({reference, box: reference.box, note: located && located.present < 0.5 ? `The app could not find a ${object?.label} in this photo. Draw the box yourself, or take another photo.` : 'The app outlined your item. Drag the box if it is not quite right.'});
      await load();
    });

  const saveBox = () =>
    act(async () => {
      if (editing) {
        await api.updateReference(editing.reference.id, {box: editing.box});
        setEditing(null);
        await load();
      }
    });

  const remove = (reference: Reference) =>
    act(async () => {
      await api.updateReference(reference.id, {active: 0});
      setEditing(null);
      await load();
    });

  if (!object) {
    return <ErrorNote error={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/objects" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← My items
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{object.name}</h1>
        </div>
        <div className="flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input w-72" aria-label="Description" placeholder="Describe it" />
          <Button onClick={() => act(async () => setObject(await api.updateObject(object.id, {label: label.trim()})))} disabled={busy || !label.trim() || label.trim() === object.label}>
            Save
          </Button>
        </div>
      </div>

      <ErrorNote error={error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {adding ? (
            <ShotPicker onShot={onShot} busy={busy} cta="Take photo" />
          ) : editing ? (
            <>
              <Frame width={editing.reference.width} height={editing.reference.height}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.fileUrl(editing.reference.image)} alt="Reference photo" className="h-full w-full object-cover" draggable={false} />
                <BoxEditor box={editing.box} onChange={(box) => setEditing({...editing, box})} />
              </Frame>
              <p className="text-center text-sm text-zinc-500">Drag the box to move it. Drag a corner to resize it.</p>
            </>
          ) : (
            <Panel className="grid min-h-64 place-items-center text-center text-sm text-zinc-500">
              <div className="space-y-3">
                <p>Tap a photo on the right to adjust it, or add another angle.</p>
                <Button variant="primary" onClick={() => setAdding(true)}>
                  Add a photo
                </Button>
              </div>
            </Panel>
          )}
        </div>

        <aside className="space-y-4">
          {editing ? (
            <Panel className="space-y-3">
              <h2 className="font-medium">Is the box around your item?</h2>
              {editing.note ? <p className="text-sm text-zinc-300">{editing.note}</p> : null}
              <p className="text-sm text-zinc-400">The app uses what is inside the box to recognise this item.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={saveBox} disabled={busy || JSON.stringify(editing.box) === JSON.stringify(editing.reference.box)}>
                  Save box
                </Button>
                <Button onClick={() => setEditing(null)}>Done</Button>
                <Button variant="danger" onClick={() => remove(editing.reference)} disabled={busy}>
                  Remove photo
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Photos</h2>
              {!adding ? (
                <Button onClick={() => setAdding(true)} className="px-3 py-1">
                  + Add
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-zinc-500">1 photo is enough. 2–3 from different angles help.</p>
            <div className="grid grid-cols-3 gap-2">
              {object.references.map((r) => (
                <button key={r.id} onClick={() => setEditing({reference: r, box: r.box, note: null})} className={`overflow-hidden rounded-lg ring-2 ${editing?.reference.id === r.id ? 'ring-sky-400' : 'ring-transparent hover:ring-fg/30'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={api.fileUrl(r.crop)} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
