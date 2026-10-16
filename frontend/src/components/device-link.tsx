'use client';

import QRCode from 'qrcode';
import {useEffect, useState, type FormEvent} from 'react';

import {Button, ErrorNote} from '@/components/ui';
import {api, errorText} from '@/lib/api';

// Your checks live in this browser. This moves another device onto the same data with a one-time code.
export function DeviceLink() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'show' | 'enter'>('show');

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-zinc-400 ring-1 ring-fg/10 transition hover:text-fg hover:ring-fg/30">
        <span aria-hidden>⇄</span>
        <span className="hidden sm:inline">Other device</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-zinc-900 p-5 ring-1 ring-fg/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Use on another device</h2>
                <p className="text-sm text-zinc-400">Your checks are saved in this browser. Link your phone to see the same ones there.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-fg" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/60 p-1">
              {(['show', 'enter'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? 'bg-fg text-fg-inverse' : 'text-zinc-400 hover:text-fg'}`}>
                  {t === 'show' ? 'Show a code' : 'I have a code'}
                </button>
              ))}
            </div>

            {tab === 'show' ? <ShowCode /> : <EnterCode />}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ShowCode() {
  const [code, setCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    api.createLink().then(
      async (link) => {
        const url = `${window.location.origin}/link?code=${link.code}`;
        const image = await QRCode.toDataURL(url, {margin: 1, width: 220});

        if (alive) {
          setCode(link.code);
          setQr(image);
        }
      },
      (err) => alive && setError(errorText(err)),
    );

    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <ErrorNote error={error} />;
  }

  return (
    <div className="space-y-3 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {qr ? <img src={qr} alt="QR code to link a device" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" /> : <div className="mx-auto h-44 w-44 animate-pulse rounded-xl bg-zinc-800" />}
      <p className="text-sm text-zinc-400">Scan with your phone camera, or open this app on the phone and enter:</p>
      <div className="font-mono text-3xl font-semibold tracking-[0.3em]">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}</div>
      <p className="text-xs text-zinc-500">Works once, for 10 minutes.</p>
    </div>
  );
}

function EnterCode() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.claimLink(code);
      window.location.replace('/checklists');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={claim} className="space-y-3">
      <p className="text-sm text-zinc-400">On the device that has your checks, choose “Show a code”, then type it here.</p>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="input text-center font-mono text-2xl tracking-[0.3em]" />
      <p className="text-xs text-zinc-500">Checks made in this browser so far will no longer show here.</p>
      <ErrorNote error={error} />
      <Button variant="primary" type="submit" disabled={busy || code.length !== 6} className="w-full">
        {busy ? 'Linking…' : 'Link this device'}
      </Button>
    </form>
  );
}
