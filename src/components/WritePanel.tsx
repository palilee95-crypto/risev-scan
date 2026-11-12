import { useEffect, useRef, useState } from 'react';
import { nfcSupport, writeUrlToTag } from '../lib/webNfc';
import { buzz, beep } from '../lib/feedback';
import type { QueueItem } from '../lib/useScanQueue';
import { QuotaEditor } from './QuotaEditor';

interface Props {
  item: QueueItem;
  onWritten: (code: string) => void;
  onSkip: () => void;
  onQuotaSaved: (code: string, quota: number) => void;
  onNeedsAuth: () => void;
}

type Phase = 'idle' | 'writing' | 'done' | 'failed';

/**
 * The write step.
 *
 * Android/Chrome: writes the tag in-app via Web NFC — tap the stand, done.
 * iOS: no Web NFC exists, so the honest flow is copy → open NFC Tools → paste.
 * The panel says which one you are in instead of pretending they are the same.
 */
export function WritePanel({ item, onWritten, onSkip, onQuotaSaved, onNeedsAuth }: Props) {
  const support = nfcSupport();
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // A new code resets the panel — otherwise a stale "Written" would sit under
  // the next stand's code and invite a double-write.
  useEffect(() => {
    setPhase('idle');
    setMessage(null);
    setCopied(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [item.code]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleWrite = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase('writing');
    setMessage('Hold the stand against the back of your phone…');

    const result = await writeUrlToTag(item.url, controller.signal);
    if (controller.signal.aborted) return;

    if (result.ok) {
      setPhase('done');
      setMessage('Written. The stand now opens the activation link.');
      buzz([40, 60, 40]);
      beep('ok');
      onWritten(item.code);
    } else {
      setPhase('failed');
      setMessage(result.reason);
      beep('bad');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      buzz(30);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMessage('Could not copy automatically — long-press the link below to copy it.');
    }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Writing</p>
          <p className="truncate font-mono text-lg font-bold text-amber">{item.code}</p>
        </div>
        <span className="pill shrink-0 bg-white/10 text-white/70">
          {support === 'supported' ? 'Android · in-app' : 'iOS · handoff'}
        </span>
      </div>

      <p className="mb-3 break-all rounded-lg bg-black/40 p-2 font-mono text-[11px] text-white/60">
        {item.url}
      </p>

      <div className="mb-3">
        <QuotaEditor
          code={item.code}
          current={item.quotaOverride ?? item.check?.quota}
          onSaved={(quota) => onQuotaSaved(item.code, quota)}
          onNeedsAuth={onNeedsAuth}
        />
      </div>

      {support === 'supported' ? (
        <>
          <button
            type="button"
            className="btn-amber w-full"
            onClick={handleWrite}
            disabled={phase === 'writing' || phase === 'done'}
          >
            {phase === 'writing' ? 'Waiting for tag…' : phase === 'done' ? 'Written ✓' : 'Write to stand'}
          </button>
          {phase === 'writing' && (
            <button
              type="button"
              className="btn-ghost mt-2 w-full"
              onClick={() => {
                abortRef.current?.abort();
                setPhase('idle');
                setMessage(null);
              }}
            >
              Cancel
            </button>
          )}
        </>
      ) : (
        <>
          <ol className="mb-3 space-y-1.5 text-xs text-white/70">
            <li>1. Tap <b className="text-white">Copy link</b> below.</li>
            <li>2. Open <b className="text-white">NFC Tools</b> → Write → Add a record → URL.</li>
            <li>3. Paste, then tap Write and hold the stand to the phone.</li>
          </ol>
          <div className="flex gap-2">
            <button type="button" className="btn-amber flex-1" onClick={handleCopy}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <a
              className="btn-ghost flex-1"
              href="nfctools://"
              onClick={(e) => {
                // No documented URL scheme — if the app is not installed this
                // would dead-end, so fall back to the App Store listing.
                e.preventDefault();
                window.location.href = 'https://apps.apple.com/app/nfc-tools/id1252962749';
              }}
            >
              Open NFC Tools
            </a>
          </div>
        </>
      )}

      {message && (
        <p
          className={`mt-3 text-xs ${
            phase === 'done' ? 'text-ok' : phase === 'failed' ? 'text-bad' : 'text-white/60'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <button
          type="button"
          className="text-xs font-bold text-white/50 underline-offset-2 hover:underline"
          onClick={onSkip}
        >
          Skip this code
        </button>
        {support !== 'supported' && (
          <button
            type="button"
            className="text-xs font-bold text-ok underline-offset-2 hover:underline"
            onClick={() => {
              onWritten(item.code);
              buzz(30);
            }}
          >
            Mark as written
          </button>
        )}
      </div>
    </div>
  );
}
