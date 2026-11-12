import { useState } from 'react';
import { BoltIcon, CheckCircleIcon, KeyboardIcon } from './icons';
import type { UseQrScanner } from '../lib/useQrScanner';

interface Props {
  scanner: UseQrScanner;
  lastAdded: string | null;
  scanError: string | null;
  onManualAdd: (code: string) => void;
}

/**
 * Camera viewport with the corner-bracket reticle, the "QR added" toast, the
 * torch button, and the manual-entry row — as in the mockup.
 */
export function ScanViewport({ scanner, lastAdded, scanError, onManualAdd }: Props) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');

  const submitManual = () => {
    if (!manual.trim()) return;
    onManualAdd(manual);
    setManual('');
    setManualOpen(false);
  };

  return (
    <>
      <div className="relative mx-5 mt-4 aspect-[4/3] overflow-hidden rounded-card bg-ink">
        <video
          ref={scanner.videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[62%] w-[62%]">
            <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-md border-l-[3px] border-t-[3px] border-amber" />
            <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-md border-r-[3px] border-t-[3px] border-amber" />
            <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-md border-b-[3px] border-l-[3px] border-amber" />
            <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-md border-b-[3px] border-r-[3px] border-amber" />
          </div>
        </div>

        {/* "QR added" toast */}
        {lastAdded && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 shadow-tab">
            <CheckCircleIcon size={16} className="text-ok" />
            <span className="text-[13px] font-bold">QR added</span>
          </div>
        )}

        {/* Torch */}
        <button
          type="button"
          aria-label="Torch"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink/70 text-surface backdrop-blur"
        >
          <BoltIcon size={19} />
        </button>

        {/* Hint pill */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-pill bg-ink/70 px-4 py-2 text-[13px] font-semibold text-surface backdrop-blur">
            Position QR inside the frame
          </span>
        </div>

        {/* Camera not running */}
        {scanner.state !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 px-6 text-center">
            <p className="text-[15px] font-bold text-surface">
              {scanner.state === 'starting' ? 'Starting camera…' : 'Camera off'}
            </p>
            {scanner.error && (
              <p className="text-[12px] leading-relaxed text-surface/70">{scanner.error}</p>
            )}
            {scanner.state !== 'starting' && (
              <button
                type="button"
                onClick={() => void scanner.start()}
                className="rounded-xl bg-amber px-4 py-2.5 text-[14px] font-bold text-ink"
              >
                {scanner.state === 'error' ? 'Retry camera' : 'Start camera'}
              </button>
            )}
          </div>
        )}
      </div>

      {scanError && (
        <p className="mx-5 mt-3 rounded-xl bg-bad-soft px-3 py-2 text-[12px] font-medium text-bad">
          {scanError}
        </p>
      )}

      {/* Manual entry */}
      {manualOpen ? (
        <div className="mx-5 mt-4 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            placeholder="RSV-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3 font-mono text-[15px] uppercase tracking-wide outline-none placeholder:text-faint focus:border-ink"
          />
          <button
            type="button"
            onClick={submitManual}
            className="rounded-xl bg-ink px-4 py-3 text-[14px] font-bold text-surface"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="mx-auto mt-4 flex items-center gap-2 text-[15px] font-bold text-ink"
        >
          <KeyboardIcon size={20} />
          Enter code manually
        </button>
      )}
    </>
  );
}
