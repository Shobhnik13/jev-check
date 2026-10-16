'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState, type FormEvent, type ReactNode} from 'react';

import {TourButton, useTour, type TourStep} from '@/components/tour';
import {Button, ErrorNote, Panel} from '@/components/ui';
import {api, errorText, type ChecklistDetail, type ItemDraft, type ItemType, type ObjectRecord} from '@/lib/api';
import {STRICTNESS, TEMPLATES} from '@/lib/rules';

const TYPES: {type: ItemType; label: string; hint: string}[] = [
  {type: 'yesno', label: 'Yes/no question', hint: 'Any question about the photo. Passes when the answer is yes.'},
  {type: 'present', label: 'Find my item', hint: 'Looks for one of your saved items, using its photo.'},
  {type: 'state', label: 'Multiple choice', hint: 'Pick from a few answers. You choose which answers are OK.'},
];

const TOUR: TourStep[] = [
  {element: '[data-tour="templates"]', title: 'Start from an example', text: 'Pick one to fill in the rules, then change anything you like.'},
  {element: '[data-tour="rule"]', title: 'A rule', text: 'Each rule is one thing the photo must show. Most rules are simple yes/no questions.'},
  {element: '[data-tour="add-rule"]', title: 'Add more rules', text: 'Add as many as you need. They are all checked at the same time.'},
  {element: '[data-tour="save"]', title: 'Save', text: 'Then point your camera and check a photo.'},
];

function blank(type: ItemType, objects: ObjectRecord[]): ItemDraft {
  return {
    type,
    object_id: type === 'present' ? (objects[0]?.id ?? null) : null,
    question: null,
    options: type === 'state' ? [{name: '', description: null}, {name: '', description: null}] : null,
    pass_options: type === 'state' ? [] : null,
    expect_present: true,
    match: 'kind',
    threshold: 0.7,
  };
}

export function ChecklistForm({checklist}: {checklist?: ChecklistDetail}) {
  const router = useRouter();
  const [objects, setObjects] = useState<ObjectRecord[]>([]);
  const [name, setName] = useState(checklist?.name ?? '');
  const [items, setItems] = useState<ItemDraft[]>(checklist?.items ?? [blank('yesno', [])]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startTour = useTour('rules', TOUR, {auto: !checklist});

  useEffect(() => {
    api.getObjects().then(setObjects, (err) => setError(errorText(err)));
  }, []);

  const patch = (index: number, change: Partial<ItemDraft>) => setItems((list) => list.map((item, i) => (i === index ? {...item, ...change} : item)));

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setName(t.name);
    setItems(t.items.map((item) => ({...item})));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const body = {name: name.trim(), items};

    try {
      const saved = checklist ? await api.updateChecklist(checklist.id, body) : await api.createChecklist(body);
      router.push(`/checklists/${saved.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const missingPhotos = objects.filter((o) => !o.references.length && items.some((i) => i.type === 'present' && i.object_id === o.id));

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{checklist ? 'Edit rules' : 'New check'}</h1>
          <p className="text-zinc-400">Write what a good photo should show. Keep each rule simple.</p>
        </div>
        <TourButton onClick={startTour} />
      </div>

      {!checklist ? (
        <div className="space-y-2" data-tour="templates">
          <div className="text-sm text-zinc-400">Start from an example</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button key={t.name} type="button" onClick={() => applyTemplate(t)} className={`rounded-xl p-3 text-left ring-1 transition ${name === t.name ? 'bg-lime-400/10 ring-lime-400/50' : 'ring-fg/10 hover:ring-fg/30'}`}>
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-zinc-400">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Delivery photo" required className="input text-base" />
      </Field>

      <div className="space-y-3">
        <div className="text-sm text-zinc-400">Rules</div>
        {items.map((item, index) => (
          <Panel key={item.id ?? `new-${index}`} className="space-y-4" {...(index === 0 ? {'data-tour': 'rule'} : {})}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1 rounded-xl bg-zinc-950/60 p-1">
                {TYPES.map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    title={t.hint}
                    onClick={() => (t.type === item.type ? null : patch(index, {...blank(t.type, objects), id: item.id}))}
                    className={`rounded-lg px-3 py-1 text-sm ${item.type === t.type ? 'bg-fg text-fg-inverse' : 'text-zinc-400 hover:text-zinc-100'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setItems((list) => list.filter((_, i) => i !== index))} className="text-sm text-zinc-500 hover:text-rose-300">
                Remove
              </button>
            </div>

            <p className="text-xs text-zinc-500">{TYPES.find((t) => t.type === item.type)?.hint}</p>

            {item.type === 'yesno' ? <input value={item.question ?? ''} onChange={(e) => patch(index, {question: e.target.value})} placeholder="e.g. Is the shipping label readable?" className="input" /> : null}

            {item.type === 'present' ? (
              objects.length ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <select value={item.object_id ?? ''} onChange={(e) => patch(index, {object_id: Number(e.target.value)})} className="input w-auto">
                    {objects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <select value={item.expect_present ? 'yes' : 'no'} onChange={(e) => patch(index, {expect_present: e.target.value === 'yes'})} className="input w-auto">
                    <option value="yes">should be in the photo</option>
                    <option value="no">should NOT be in the photo</option>
                  </select>
                  <label className="flex w-full items-center gap-2 pt-1 text-zinc-400">
                    <input type="checkbox" checked={item.match === 'exact'} onChange={(e) => patch(index, {match: e.target.checked ? 'exact' : 'kind'})} className="accent-lime-400" />
                    Must be this exact item, not just something similar
                  </label>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  You have no saved items yet.{' '}
                  <Link href="/objects" className="text-lime-300 underline">
                    Add one with a photo
                  </Link>
                  , then come back.
                </p>
              )
            ) : null}

            {item.type === 'state' ? (
              <div className="space-y-2">
                <input value={item.question ?? ''} onChange={(e) => patch(index, {question: e.target.value})} placeholder="e.g. Is the box closed?" className="input" />
                <div className="text-xs text-zinc-500">Answers. Tick the ones that are OK.</div>
                {(item.options ?? []).map((option, o) => (
                  <div key={o} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(option.name) && (item.pass_options ?? []).includes(option.name)}
                      onChange={(e) => patch(index, {pass_options: e.target.checked ? [...(item.pass_options ?? []), option.name] : (item.pass_options ?? []).filter((n) => n !== option.name)})}
                      disabled={!option.name}
                      className="accent-lime-400"
                      aria-label="This answer is OK"
                    />
                    <input
                      value={option.name}
                      onChange={(e) => {
                        const options = [...(item.options ?? [])];
                        const old = options[o].name;
                        options[o] = {...options[o], name: e.target.value};
                        patch(index, {options, pass_options: (item.pass_options ?? []).map((n) => (n === old ? e.target.value : n))});
                      }}
                      placeholder={['e.g. sealed', 'e.g. open', 'e.g. damaged'][o] ?? 'answer'}
                      className="input"
                    />
                    <button type="button" onClick={() => patch(index, {options: (item.options ?? []).filter((_, i) => i !== o), pass_options: (item.pass_options ?? []).filter((n) => n !== option.name)})} className="px-2 text-zinc-500 hover:text-rose-300" aria-label="Remove answer">
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => patch(index, {options: [...(item.options ?? []), {name: '', description: null}]})} className="text-sm text-lime-300">
                  + Add answer
                </button>
              </div>
            ) : null}

            <div className="flex items-center gap-3 text-sm">
              <span className="text-zinc-500">How sure must the app be?</span>
              <div className="flex gap-1 rounded-lg bg-zinc-950/60 p-0.5">
                {STRICTNESS.map((s) => (
                  <button key={s.label} type="button" onClick={() => patch(index, {threshold: s.value})} className={`rounded-md px-2.5 py-0.5 ${Math.abs(item.threshold - s.value) < 0.03 ? 'bg-zinc-700 text-fg' : 'text-zinc-400 hover:text-fg'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        ))}

        <Button type="button" onClick={() => setItems((list) => [...list, blank('yesno', objects)])} data-tour="add-rule">
          + Add rule
        </Button>
      </div>

      {missingPhotos.length ? <p className="text-sm text-amber-300">Add a photo of {missingPhotos.map((o) => o.name).join(', ')} before checking.</p> : null}
      <ErrorNote error={error} />

      <div className="flex justify-end">
        <Button variant="primary" type="submit" disabled={busy || !name.trim() || !items.length} className="px-6" data-tour="save">
          {busy ? 'Saving…' : checklist ? 'Save changes' : 'Save and start checking'}
        </Button>
      </div>
    </form>
  );
}

function Field({label, children}: {label: string; children: ReactNode}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
