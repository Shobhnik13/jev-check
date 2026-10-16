'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useRef, useState} from 'react';

import {useChecklist} from '@/components/checklist-context';
import {ResultList, RunPhoto, VerdictBadge, VerdictBanner} from '@/components/results';
import {ShotPicker} from '@/components/shot-picker';
import {TourButton, useTour, type TourStep} from '@/components/tour';
import {Button, buttonClass, ErrorNote, Panel} from '@/components/ui';
import {api, errorText, type Preview, type Run} from '@/lib/api';
import {grabFrame, useCamera} from '@/lib/camera';
import {ruleTitle} from '@/lib/rules';

const MIN_INTERVAL_MS = 350;
const MAX_ERRORS = 3;
const COOLDOWN_MS = 2500;
const HOLD_FRAMES = 2;

const TOUR: TourStep[] = [
  {element: '[data-tour="modes"]', title: 'Two ways to check', text: 'Take a single photo, or switch to the live camera and it keeps checking while you move.'},
  {element: '[data-tour="camera"]', title: 'Your camera', text: 'Point it at what you want to check. You can also upload a photo.'},
  {element: '[data-tour="snap"]', title: 'Check the photo', text: 'Press this. The answer comes back in under a second.'},
  {element: '[data-tour="rules"]', title: 'The rules', text: 'After a photo, each rule gets ✓ yes, ✗ no, or ? not sure. If any rule fails, the photo fails.'},
  {element: '[data-tour="tab-history"]', title: 'History', text: 'Every checked photo is saved. The “not sure” ones wait here for you to decide.'},
  {element: '[data-tour="tab-edit"]', title: 'Change the rules', text: 'Add or remove rules any time.'},
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CheckPage() {
  const {checklist} = useChecklist();
  const params = useSearchParams();
  const [mode, setMode] = useState<'snap' | 'live'>('snap');
  const missing = checklist.objects.filter((o) => !o.references.length);
  const startTour = useTour('check', TOUR, {force: params.get('tour') === '1', ready: !missing.length});

  if (missing.length) {
    return (
      <Panel className="space-y-3">
        <p className="text-amber-300">Before checking, add a photo of:</p>
        <div className="flex flex-wrap gap-2">
          {missing.map((o) => (
            <Link key={o.id} href={`/objects/${o.id}`} className={buttonClass('primary')}>
              {o.name}
            </Link>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-zinc-900/70 p-1 ring-1 ring-fg/10" data-tour="modes">
          {(['snap', 'live'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-4 py-1.5 text-sm ${mode === m ? 'bg-fg text-fg-inverse' : 'text-zinc-300 hover:bg-zinc-800'}`}>
              {m === 'snap' ? 'Take a photo' : 'Live camera'}
            </button>
          ))}
        </div>
        <TourButton onClick={startTour} />
      </div>
      {mode === 'snap' ? <SnapCheck /> : <LiveCheck />}
    </div>
  );
}

function SnapCheck() {
  const {checklist, refresh} = useChecklist();
  const [runs, setRuns] = useState<(Run & {url: string})[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onShot = async (frame: Blob) => {
    setBusy(true);
    setError(null);

    try {
      const run = await api.runCheck(checklist.id, frame, 'snap');
      setRuns((list) => [{...run, url: URL.createObjectURL(frame)}, ...list]);
      setCurrent(0);
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const run = current === null ? null : runs[current];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {run ? (
          <>
            <RunPhoto src={run.url} result={run} />
            <div className="flex justify-center">
              <Button variant="primary" onClick={() => setCurrent(null)}>
                Check another photo
              </Button>
            </div>
          </>
        ) : (
          <ShotPicker onShot={onShot} busy={busy} cta="Check photo" />
        )}
        <ErrorNote error={error} />
      </div>

      <aside className="space-y-4">
        <Panel className="space-y-4" data-tour="rules">
          {run ? (
            <>
              <VerdictBanner result={run} />
              <ResultList results={run.results} />
            </>
          ) : (
            <RulesPreview />
          )}
        </Panel>

        {runs.length ? (
          <Panel className="space-y-3">
            <h2 className="text-sm font-medium">Photos you just checked</h2>
            <div className="grid grid-cols-4 gap-2">
              {runs.map((r, i) => (
                <button key={r.id} onClick={() => setCurrent(i)} className={`relative overflow-hidden rounded-lg ring-2 ${i === current ? 'ring-fg' : 'ring-transparent'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt="" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 left-1">
                    <VerdictBadge verdict={r.verdict} />
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        ) : null}
      </aside>
    </div>
  );
}

// Checks frames continuously without saving them; the frame where everything passes is saved.
function LiveCheck() {
  const {checklist, refresh} = useChecklist();
  const {videoRef, status, error: cameraError, size, mirrored, flip} = useCamera(true);
  const [running, setRunning] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [last, setLast] = useState<Preview | null>(null);
  const [saved, setSaved] = useState<Run[]>([]);
  const [flash, setFlash] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings = useRef({autoSave, streak: 0});
  const frames = useRef(new Map<string, Blob>());

  useEffect(() => {
    settings.current.autoSave = autoSave;
  }, [autoSave]);

  const save = useCallback(
    async (preview: Preview) => {
      const run = await api.savePreview(checklist.id, preview.preview_id, frames.current.get(preview.preview_id)!);
      setSaved((list) => [run, ...list]);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      navigator.vibrate?.(60);
    },
    [checklist.id],
  );

  useEffect(() => {
    if (!running || status !== 'live') {
      return;
    }

    let alive = true;
    let errors = 0;

    (async () => {
      while (alive) {
        const startedAt = performance.now();

        try {
          const frame = await grabFrame(videoRef.current!);
          const preview = await api.previewCheck(checklist.id, frame);

          if (!alive) {
            break;
          }

          // Keep the last few frames so a save can resend the exact photo that was judged.
          frames.current.set(preview.preview_id, frame);
          [...frames.current.keys()].slice(0, -5).forEach((id) => frames.current.delete(id));

          errors = 0;
          setError(null);
          setLast(preview);

          const s = settings.current;
          s.streak = preview.verdict === 'pass' ? s.streak + 1 : 0;

          if (s.autoSave && s.streak >= HOLD_FRAMES) {
            await save(preview);
            s.streak = 0;
            setCooldown(true);
            await sleep(COOLDOWN_MS);
            setCooldown(false);
          }
        } catch (err) {
          setError(errorText(err));

          if (++errors >= MAX_ERRORS) {
            setRunning(false);
            break;
          }

          await sleep(1000);
        }

        await sleep(Math.max(0, MIN_INTERVAL_MS - (performance.now() - startedAt)));
      }
    })();

    return () => {
      alive = false;
      refresh();
    };
  }, [running, status, videoRef, checklist.id, save, refresh]);

  const result = running ? last : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <div className="relative" data-tour="camera">
          <RunPhoto result={result} size={size} mirrored={mirrored} video={<video ref={videoRef} playsInline muted className="h-full w-full object-cover" />} />
          <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-white transition-opacity duration-150 ${flash ? 'opacity-70' : 'opacity-0'}`} />
          {cooldown ? <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-lime-400 px-4 py-1.5 text-sm font-semibold text-black">All good, photo saved ✓</div> : null}
          {status !== 'live' ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-zinc-400">{cameraError ?? 'Starting camera…'}</div> : null}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant={running ? 'danger' : 'primary'} onClick={() => setRunning((r) => !r)} disabled={status !== 'live'} className="min-w-36" data-tour="snap">
            {running ? 'Stop' : 'Start checking'}
          </Button>
          <Button onClick={() => last && save(last).catch((err) => setError(errorText(err)))} disabled={!last || !running}>
            Save this photo
          </Button>
          <Button onClick={flip}>Switch camera</Button>
        </div>

        <label className="flex items-center justify-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="accent-lime-400" />
          Save the photo automatically when everything is good
        </label>

        <ErrorNote error={error} />

        {saved.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {saved.map((r) => (
              <div key={r.id} className="relative h-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-fg/10" style={{aspectRatio: `${r.width} / ${r.height}`}}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={api.fileUrl(r.image)} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1">
                  <VerdictBadge verdict={r.verdict} />
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <aside>
        <Panel className="space-y-4" data-tour="rules">
          {result ? (
            <>
              <VerdictBanner result={result} />
              <ResultList results={result.results} />
            </>
          ) : (
            <RulesPreview />
          )}
        </Panel>
      </aside>
    </div>
  );
}

function RulesPreview() {
  const {checklist} = useChecklist();

  return (
    <div className="space-y-3">
      <h2 className="font-medium">The app will check</h2>
      <ol className="space-y-2.5 text-sm">
        {checklist.items.map((item) => {
          const object = checklist.objects.find((o) => o.id === item.object_id);
          return (
            <li key={item.id} className="flex items-center gap-3">
              {object?.references[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={api.fileUrl(object.references[0].crop)} alt="" className="h-8 w-8 rounded-md object-cover" />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ring-fg/20 text-xs text-zinc-500">•</span>
              )}
              <span className="text-zinc-200">{ruleTitle(item, checklist.objects)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
