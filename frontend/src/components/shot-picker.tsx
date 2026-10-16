'use client';

import {useRef, useState} from 'react';

import {Frame} from '@/components/frame';
import {Button, ErrorNote} from '@/components/ui';
import {fileToFrame, grabFrame, useCamera} from '@/lib/camera';

// Live camera with a shutter, plus file upload; works on phones without HTTPS through the file input.
export function ShotPicker({onShot, busy, cta = 'Snap'}: {onShot: (frame: Blob) => void; busy?: boolean; cta?: string}) {
  const [cameraOn, setCameraOn] = useState(true);
  const {videoRef, status, error: cameraError, size, mirrored, flip} = useCamera(cameraOn);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const snap = async () => {
    if (videoRef.current) {
      onShot(await grabFrame(videoRef.current));
    }
  };

  const upload = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      setError(null);
      onShot(await fileToFrame(file));
    } catch {
      setError('Could not read that image. Use a JPEG or PNG.');
    } finally {
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-3" data-tour="camera">
      {cameraOn && status !== 'error' ? (
        <Frame width={size?.width ?? 16} height={size?.height ?? 9} mirrored={mirrored}>
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {status !== 'live' ? <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Starting camera…</div> : null}
        </Frame>
      ) : (
        <div className="grid aspect-video place-items-center rounded-2xl bg-zinc-900 text-sm text-zinc-500 ring-1 ring-fg/10">{cameraError ? 'Camera not available. Upload a photo instead.' : 'Camera off'}</div>
      )}

      <ErrorNote error={cameraError ?? error} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={snap} disabled={busy || status !== 'live'} className="min-w-32" data-tour="snap">
          {busy ? 'Checking…' : cta}
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          Upload photo
        </Button>
        {status === 'live' ? <Button onClick={flip}>Flip camera</Button> : null}
        <Button onClick={() => setCameraOn((on) => !on)}>{cameraOn ? 'Camera off' : 'Camera on'}</Button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}
