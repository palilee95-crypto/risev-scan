import { itemState, type QueueItem } from '../lib/useScanQueue';
import { QuotaEditor } from './QuotaEditor';
import {
  CheckCircleIcon,
  CheckIcon,
  ExternalIcon,
  InfoIcon,
  PhoneIcon,
  SignalIcon,
  StandIcon,
} from './icons';

interface Props {
  item: QueueItem;
  index: number;
  total: number;
  support: 'supported' | 'insecure' | 'unsupported';
  copied: boolean;
  onCopy: () => void;
  onGetApp: () => void;
  onWrite: () => void;
  onMarkWritten: () => void;
  onScanNext: () => void;
  onQuotaSaved: (quota: number) => void;
  onNeedsAuth: () => void;
  phase: 'idle' | 'writing' | 'done' | 'failed';
  message: string | null;
}

/**
 * "Ready to write" card.
 *
 * Mirrors the mockup: STAND NN OF MM header with a Verified chip, the
 * stand-to-phone illustration, the code, a three-step checklist, and the
 * primary action pinned at the bottom.
 */
export function WriteCard({
  item,
  index,
  total,
  support,
  copied,
  onCopy,
  onGetApp,
  onWrite,
  onMarkWritten,
  onScanNext,
  onQuotaSaved,
  onNeedsAuth,
  phase,
  message,
}: Props) {
  const blocked = itemState(item) === 'blocked';
  const written = phase === 'done' || itemState(item) === 'written';
  const android = support === 'supported';

  // Checklist state: QR verified → open NFC Tools → confirm written.
  const step2Done = android ? phase === 'writing' || written : copied || written;
  const step3Done = written;

  return (
    <div className="card mx-5 mt-4 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <p className="label">
          Stand {String(index + 1).padStart(2, '0')} of {String(total).padStart(2, '0')}
        </p>
        {blocked ? (
          <span className="chip bg-bad-soft text-bad">Blocked</span>
        ) : (
          <span className="chip bg-ok-soft text-ok">
            <CheckCircleIcon size={14} />
            Verified
          </span>
        )}
      </div>

      {/* Illustration */}
      <div className="flex items-center justify-center gap-3 py-5">
        <StandIcon size={78} className="text-ink" />
        <SignalIcon size={34} className="text-amber" />
        <PhoneIcon size={62} className="text-ink" />
      </div>

      <p className="text-center text-[26px] font-extrabold tracking-[-0.02em]">
        {item.code}
      </p>
      <p className="mt-1 text-center text-[14px] text-muted">
        {blocked
          ? 'Do not write this stand'
          : written
            ? 'Written to stand'
            : android
              ? 'Ready for Web NFC'
              : 'Ready for NFC Tools'}
      </p>

      {/* Checklist */}
      <div className="mx-4 mt-4 border-t border-line pt-4">
        <ol className="space-y-3">
          <Step done label="QR verified" />
          <Step
            done={step2Done}
            active={!step2Done}
            label={android ? 'Tap Write to stand' : 'Open NFC Tools'}
          />
          <Step done={step3Done} active={step2Done && !step3Done} label="Confirm writing complete" />
        </ol>
      </div>

      {blocked ? (
        <div className="mx-4 mt-4 rounded-xl bg-bad-soft px-3 py-2.5">
          <p className="text-[12px] leading-relaxed text-bad">
            {item.check?.detail ?? 'This code failed verification.'} Writing it would
            produce a stand that activates nothing.
          </p>
        </div>
      ) : (
        <div className="mx-4 mt-4">
          <QuotaEditor
            code={item.code}
            current={item.quotaOverride ?? item.check?.quota}
            onSaved={onQuotaSaved}
            onNeedsAuth={onNeedsAuth}
          />
        </div>
      )}

      {message && (
        <p
          className={`mx-4 mt-3 text-[12px] ${
            phase === 'done' ? 'text-ok' : phase === 'failed' ? 'text-bad' : 'text-muted'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 bg-chip px-4 py-3">
        <InfoIcon size={18} className="shrink-0 text-muted" />
        <p className="text-[12px] leading-snug text-muted">
          {android
            ? 'Hold the stand against the back of your phone.'
            : 'Return here after writing the NFC tag.'}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2 px-4 py-4">
        {blocked ? (
          <button type="button" className="btn-primary" onClick={onScanNext}>
            Scan next parcel
          </button>
        ) : android ? (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={onWrite}
              disabled={phase === 'writing' || written}
            >
              {phase === 'writing' ? 'Waiting for tag…' : written ? 'Written' : 'Write to stand'}
            </button>
            {written && (
              <button type="button" className="btn-secondary" onClick={onScanNext}>
                Scan next parcel
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={onCopy}>
              {copied ? 'Link copied' : 'Copy link'}
              <ExternalIcon size={19} />
            </button>
            <button type="button" className="btn-secondary" onClick={onGetApp}>
              Get NFC Tools
            </button>
            <button
              type="button"
              className="w-full py-2 text-[15px] font-bold text-ink"
              onClick={onMarkWritten}
            >
              Mark as written
            </button>
            <p className="text-center text-[12px] text-faint">
              Confirm only after the tag is written.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Step({
  done,
  active,
  label,
}: {
  done: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-ok text-surface'
            : active
              ? 'border-2 border-amber bg-amber/20'
              : 'border-2 border-line'
        }`}
      >
        {done && <CheckIcon size={14} />}
      </span>
      <span
        className={`text-[15px] ${
          done ? 'font-semibold text-ink' : active ? 'font-bold text-ink' : 'text-faint'
        }`}
      >
        {label}
      </span>
    </li>
  );
}
