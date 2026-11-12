/**
 * Continuous QR scanning from the rear camera.
 *
 * Uses getUserMedia + jsQR on a canvas rather than BarcodeDetector, because
 * BarcodeDetector is still missing on iOS Safari and patchy on Android — the
 * one thing this app cannot afford is a scanner that silently does nothing on
 * the phone in someone's hand.
 *
 * Decoding runs on a throttled loop (~8 fps). That is plenty for a stand QR
 * held in front of the lens and keeps the phone from cooking.
 *
 * Concurrency: every start() takes a generation token. A start whose token is
 * stale by the time its getUserMedia resolves tears its own stream down and
 * returns, so a double-invoke (React StrictMode, or a fast tab switch) cannot
 * leave two streams fighting over one <video>.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** How long the same payload is ignored after a successful read. */
const SAME_CODE_COOLDOWN_MS = 2500;
/** Minimum gap between decode attempts. */
const DECODE_INTERVAL_MS = 120;

export type ScannerState = 'idle' | 'starting' | 'scanning' | 'error';

export interface UseQrScanner {
  state: ScannerState;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  start: () => Promise<void>;
  stop: () => void;
}

export function useQrScanner(onDecode: (text: string) => void): UseQrScanner {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDecodeRef = useRef(0);
  const lastTextRef = useRef<{ text: string; at: number } | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  /** Bumped by every start() and stop(); stale starts compare against it. */
  const generationRef = useRef(0);

  const [state, setState] = useState<ScannerState>('idle');
  const [error, setError] = useState<string | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    teardown();
    setState('idle');
  }, [teardown]);

  const start = useCallback(async () => {
    const generation = ++generationRef.current;
    const isStale = () => generation !== generationRef.current;

    setError(null);
    setState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Try Chrome or Safari over HTTPS.');
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      // A newer start() or a stop() won the race — drop this stream.
      if (isStale()) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        teardown();
        setState('idle');
        return;
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      if (isStale()) return;

      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        teardown();
        setError('Canvas is unavailable in this browser.');
        setState('error');
        return;
      }

      setState('scanning');

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - lastDecodeRef.current < DECODE_INTERVAL_MS) return;
        lastDecodeRef.current = now;

        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;

        // Downscale before decoding: a 1280px frame is more than a QR needs and
        // the smaller buffer is markedly faster on mid-range phones.
        const scale = Math.min(1, 640 / Math.max(w, h));
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (!found?.data) return;

        const text = found.data;
        const last = lastTextRef.current;
        if (last && last.text === text && now - last.at < SAME_CODE_COOLDOWN_MS) return;
        lastTextRef.current = { text, at: now };
        onDecodeRef.current(text);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      // A stale start's failure is not the user's problem.
      if (isStale()) return;

      const name = err instanceof DOMException ? err.name : '';
      const message =
        name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access for this site and retry.'
          : name === 'NotFoundError'
            ? 'No camera found on this device.'
            : name === 'NotReadableError'
              ? 'The camera is already in use by another app.'
              : err instanceof Error
                ? err.message
                : 'Could not start the camera.';
      // Release the stream first: teardown() does not touch state, so the error
      // state has to be set after it or the retry button never appears.
      teardown();
      setError(message);
      setState('error');
    }
  }, [teardown]);

  // Release the camera when the component unmounts or the tab is hidden —
  // leaving the LED on after a batch is both alarming and a battery drain.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [stop]);

  return { state, error, videoRef, start, stop };
}
