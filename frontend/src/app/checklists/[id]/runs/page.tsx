'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';

import {useChecklist} from '@/components/checklist-context';
import {OutcomeIcon, RunPhoto, useRuleTitle, VerdictBadge} from '@/components/results';
import {TourButton, useTour, type TourStep} from '@/components/tour';
import {Button, ErrorNote, Panel} from '@/components/ui';
import {api, errorText, pct, type Run} from '@/lib/api';
import {answerText, VERDICT_TEXT} from '@/lib/rules';

const FILTERS = [
  {key: 'review', label: 'Need you'},
  {key: 'all', label: 'All'},
  {key: 'pass', label: 'Passed'},
  {key: 'fail', label: 'Failed'},
  {key: 'retake', label: 'Unclear'},
] as const;

type Filter = (typeof FILTERS)[number]['key'];

const TOUR: TourStep[] = [
  {element: '[data-tour="filters"]', title: 'Every photo you checked', text: '“Need you” shows photos the app was not sure about. Open one and decide.'},
  {element: '[data-tour="agreement"]', title: 'How often the app was right', text: 'Each time you decide, the app learns how much to trust each rule.'},
];

function needsYou(run: Run) {
  return run.verdict === 'review' && !run.final_verdict;
}

function finalVerdict(run: Run) {
  return run.final_verdict ?? run.verdict;
}

export default function HistoryPage() {
  const {checklist, refresh} = useChecklist();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startTour = useTour('history', TOUR, {ready: runs !== null && runs.length > 0});

  useEffect(() => {
    let alive = true;

    api.getRuns({checklist_id: checklist.id}).then(
      (list) => {
        if (alive) {
          setRuns(list);
          setFilter(list.some(needsYou) ? 'review' : 'all');
        }
      },
      (err) => alive && setError(errorText(err)),
    );

    return () => {
      alive = false;
    };
  }, [checklist.id]);

  const matches = useCallback((run: Run, f: Filter) => (f === 'all' ? true : f === 'review' ? needsYou(run) : finalVerdict(run) === f), []);
  const visible = useMemo(() => (runs ?? []).filter((r) => matches(r, filter)), [runs, filter, matches]);
  const openIndex = visible.findIndex((r) => r.id === openId);

  const save = async (run: Run, body: Parameters<typeof api.updateRun>[1]) => {
    try {
      const next = await api.updateRun(run.id, body);
      setRuns((list) => (body.active === 0 ? list!.filter((r) => r.id !== run.id) : list!.map((r) => (r.id === run.id ? next : r))));
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-900/70 p-1 ring-1 ring-fg/10" data-tour="filters">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${filter === f.key ? 'bg-fg text-fg-inverse' : 'text-zinc-300 hover:bg-zinc-800'}`}>
              {f.label} <span className="text-xs opacity-60">{(runs ?? []).filter((r) => matches(r, f.key)).length}</span>
            </button>
          ))}
        </div>
        {runs?.length ? <TourButton onClick={startTour} /> : null}
      </div>

      <ErrorNote error={error} />
      {runs && !visible.length ? <Panel className="py-12 text-center text-sm text-zinc-500">{runs.length ? 'Nothing here.' : 'No photos checked yet. Go to “Check a photo” to start.'}</Panel> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((run) => (
          <button key={run.id} onClick={() => setOpenId(run.id)} className="overflow-hidden rounded-xl bg-zinc-900 text-left ring-1 ring-fg/10 transition hover:ring-fg/30">
            <div className="relative" style={{aspectRatio: `${run.width} / ${run.height}`}}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={api.fileUrl(run.image)} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2">
                <VerdictBadge verdict={finalVerdict(run)} />
              </span>
            </div>
            <div className="flex justify-between p-2.5 text-xs text-zinc-400">
              <span>{new Date(run.created_at).toLocaleString([], {dateStyle: 'medium', timeStyle: 'short'})}</span>
              {run.final_verdict ? <span className="text-sky-300">decided by you</span> : null}
            </div>
          </button>
        ))}
      </div>

      {runs?.length ? <Agreement /> : null}

      {openIndex >= 0 ? (
        <Review
          key={visible[openIndex].id}
          run={visible[openIndex]}
          position={`${openIndex + 1} of ${visible.length}`}
          onClose={() => setOpenId(null)}
          onStep={(delta) => {
            const next = visible[openIndex + delta];

            if (next) {
              setOpenId(next.id);
            }
          }}
          onSave={save}
        />
      ) : null}
    </div>
  );
}

function Agreement() {
  const {checklist} = useChecklist();
  const title = useRuleTitle();
  const reviewed = checklist.agreement.filter((a) => a.reviewed);

  return (
    <Panel className="space-y-3" data-tour="agreement">
      <h2 className="font-medium">How often the app agreed with you</h2>
      {!reviewed.length ? (
        <p className="text-sm text-zinc-400">Open a photo and tell the app whether it was right. Your answers show up here, rule by rule.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {checklist.agreement.map((a) => {
            const decided = a.reviewed - a.unsure;
            const rate = decided ? a.agreed / decided : null;

            return (
              <div key={a.item_id} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-zinc-200">{title(a.item_id)}</span>
                  <span className="whitespace-nowrap text-xs text-zinc-400">{rate === null ? 'not enough answers' : `${pct(rate)} of ${decided}`}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full ${rate === null ? '' : rate >= 0.9 ? 'bg-lime-400' : rate >= 0.7 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{width: rate === null ? 0 : pct(rate)}} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function Review({run, position, onClose, onStep, onSave}: {run: Run; position: string; onClose: () => void; onStep: (delta: number) => void; onSave: (run: Run, body: Parameters<typeof api.updateRun>[1]) => Promise<void>}) {
  const title = useRuleTitle();
  const [calls, setCalls] = useState<Record<number, 'pass' | 'fail'>>(() =>
    Object.fromEntries(run.results.map((r) => [r.item_id, run.reviews.find((v) => v.item_id === r.item_id)?.outcome ?? (r.outcome === 'review' ? undefined : r.outcome)]).filter(([, v]) => v)),
  );
  const suggested: 'pass' | 'fail' = run.results.some((r) => calls[r.item_id] === 'fail') ? 'fail' : 'pass';

  const decide = useCallback(
    async (verdict: 'pass' | 'fail') => {
      const reviews = Object.entries(calls).map(([itemId, outcome]) => ({item_id: Number(itemId), outcome}));
      await onSave(run, {final_verdict: verdict, reviews});
      onStep(1);
    },
    [calls, run, onSave, onStep],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const actions: Record<string, () => void> = {ArrowRight: () => onStep(1), ArrowLeft: () => onStep(-1), Escape: onClose};
      actions[e.key]?.();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStep, onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_380px]" onClick={(e) => e.stopPropagation()}>
        <RunPhoto src={api.fileUrl(run.image)} result={run} maxHeight="80vh" />

        <Panel className="h-fit space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-500">{position}</div>
              <h2 className="text-lg font-medium">The app said: {VERDICT_TEXT[run.verdict].short.toLowerCase()}</h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-fg" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-zinc-400">Is each rule right? Tap ✓ or ✗.</div>
          </div>

          <ul className="space-y-3">
            {run.results.map((r) => (
              <li key={r.item_id} className="flex items-center gap-3">
                <OutcomeIcon outcome={r.outcome} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-100">{title(r.item_id)}</div>
                  <div className="text-xs text-zinc-500">App: {r.choice ? r.choice : answerText(r).toLowerCase()}</div>
                </div>
                <div className="flex gap-1">
                  {(['pass', 'fail'] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setCalls((c) => ({...c, [r.item_id]: o}))}
                      className={`h-9 w-9 rounded-lg text-sm font-bold ring-1 ${calls[r.item_id] === o ? (o === 'pass' ? 'bg-lime-400 text-black ring-lime-400' : 'bg-rose-500 text-white ring-rose-500') : 'text-zinc-400 ring-fg/15 hover:text-fg'}`}
                      aria-label={o === 'pass' ? 'Rule is met' : 'Rule is not met'}
                    >
                      {o === 'pass' ? '✓' : '✗'}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2">
            <Button variant={suggested === 'pass' ? 'primary' : 'ghost'} onClick={() => decide('pass')}>
              Mark as passed
            </Button>
            <Button variant={suggested === 'fail' ? 'danger' : 'ghost'} onClick={() => decide('fail')}>
              Mark as failed
            </Button>
          </div>
          <div className="flex justify-between text-sm">
            <button onClick={() => onSave(run, {active: 0}).then(onClose)} className="text-zinc-500 hover:text-rose-300">
              Delete photo
            </button>
            <span className="text-xs text-zinc-600">← → to browse</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
