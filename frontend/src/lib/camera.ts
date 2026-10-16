'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

export type Facing = 'environment' | 'user';

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<{width: number; height: number} | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      setStatus('starting');
      setError(null);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera needs HTTPS or localhost. Run `npm run dev:https` to use a phone.');
        }

        stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: facing}, width: {ideal: 1920}, height: {ideal: 1080}}});

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setSize({width: video.videoWidth, height: video.videoHeight});
        setStatus('live');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, facing]);

  const flip = useCallback(() => setFacing((f) => (f === 'environment' ? 'user' : 'environment')), []);

  return {videoRef, status, error, size, facing, mirrored: facing === 'user', flip};
}

export async function grabFrame(video: HTMLVideoElement, maxSide = 1024): Promise<Blob> {
  return _toJpeg(video, video.videoWidth, video.videoHeight, maxSide);
}

export async function fileToFrame(file: Blob, maxSide = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  try {
    return await _toJpeg(bitmap, bitmap.width, bitmap.height, maxSide);
  } finally {
    bitmap.close();
  }
}

async function _toJpeg(source: CanvasImageSource, width: number, height: number, maxSide: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode frame'))), 'image/jpeg', 0.85));
}
