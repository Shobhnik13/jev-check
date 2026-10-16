'use client';

import {useChecklist} from '@/components/checklist-context';
import {BoxRect, Frame} from '@/components/frame';
import type {ItemResult, Outcome, RunResult, Verdict} from '@/lib/api';
import {answerText, ruleTitle, VERDICT_TEXT} from '@/lib/rules';

const VERDICT_STYLE: Record<Verdict, {badge: string; banner: string}> = {
  pass: {badge: 'bg-lime-400 text-black', banner: 'bg-lime-400/15 text-lime-200 ring-lime-400/40'},
  fail: {badge: 'bg-rose-500 text-white', banner: 'bg-rose-500/15 text-rose-200 ring-rose-500/40'},
  review: {badge: 'bg-amber-400 text-black', banner: 'bg-amber-400/15 text-amber-200 ring-amber-400/40'},
  retake: {badge: 'bg-zinc-300 text-black', banner: 'bg-zinc-400/15 text-zinc-200 ring-zinc-400/40'},
};

const OUTCOME_ICON: Record<Outcome, {icon: string; className: string}> = {
  pass: {icon: '✓', className: 'bg-lime-400 text-black'},
  fail: {icon: '✗', className: 'bg-rose-500 text-white'},
  review: {icon: '?', className: 'bg-amber-400 text-black'},
};

export function VerdictBadge({verdict}: {verdict: Verdict}) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${VERDICT_STYLE[verdict].badge}`}>{VERDICT_TEXT[verdict].short}</span>;
}

export function VerdictBanner({result}: {result: RunResult}) {
  const passed = result.results.filter((r) => r.outcome === 'pass').length;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 ring-1 ${VERDICT_STYLE[result.verdict].banner}`}>
      <span className="text-lg font-semibold">{VERDICT_TEXT[result.verdict].title}</span>
      <span className="text-sm opacity-80">
        {passed} of {result.results.length} rules passed
      </span>
    </div>
  );
}

export function OutcomeIcon({outcome}: {outcome: Outcome}) {
  const o = OUTCOME_ICON[outcome];
  return <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold ${o.className}`}>{o.icon}</span>;
}

export function useRuleTitle() {
  const {checklist} = useChecklist();
  return (itemId: number) =>
    ruleTitle(
      checklist.items.find((i) => i.id === itemId),
      checklist.objects,
    );
}

export function ResultList({results}: {results: ItemResult[]}) {
  const title = useRuleTitle();

  return (
    <ul className="space-y-3">
      {results.map((r) => (
        <li key={r.item_id} className="flex items-start gap-3">
          <OutcomeIcon outcome={r.outcome} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-zinc-100">{title(r.item_id)}</div>
            <div className="text-xs text-zinc-500">{r.choice ? `Answer: ${r.choice}` : answerText(r)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// The photo with an outline on every item the app found.
export function RunPhoto({src, result, size, mirrored, video, maxHeight}: {src?: string; result: RunResult | null; size?: {width: number; height: number} | null; mirrored?: boolean; video?: React.ReactNode; maxHeight?: string}) {
  const title = useRuleTitle();
  const width = size?.width ?? result?.width ?? 16;
  const height = size?.height ?? result?.height ?? 9;

  return (
    <Frame width={width} height={height} mirrored={mirrored} maxHeight={maxHeight}>
      {video ?? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Checked photo" className="h-full w-full object-cover" draggable={false} />
      )}
      {result?.results.map((r) =>
        r.box ? <BoxRect key={r.item_id} box={r.box} tone={r.outcome === 'pass' ? 'fit' : r.outcome === 'review' ? 'near' : 'absent'} label={title(r.item_id).replace(/ is (not )?in the photo$/, '')} mirrored={mirrored} animate={Boolean(video)} /> : null,
      )}
    </Frame>
  );
}
