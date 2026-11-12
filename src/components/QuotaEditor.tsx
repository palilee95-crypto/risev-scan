import { useEffect, useState } from 'react';
import { updateQuota } from '../lib/pbAuth';
import { buzz } from '../lib/feedback';

interface Props {
  code: string;
  /** Quota currently on the record, if known. */
  current: number | undefined;
  /** Called with the value PocketBase actually stored. */
  onSaved: (quota: number) => void;
  /** Opens the sign-in sheet when the session is missing or expired. */
  onNeedsAuth: () => void;
}

/** Common stand capacities, so the usual case is one tap. */
const PRESETS = [250, 500, 1000, 1500];

/**
 * Edit the quota on one activation code.
 *
 * Quota is a database value, not tag content, so this works at any point:
 * before writing, after writing, and even after the merchant has redeemed the
 * stand (the merchant's capacity is a live SUM over their redeemed codes).
 */
export function QuotaEditor({ code, current, onSaved, onNeedsAuth }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(current ? String(current) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the record when the active code changes.
  useEffect(() => {
    setValue(current ? String(current) : '');
    setError(null);
    setOpen(false);
  }, [code, current]);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 1;
  const changed = current === undefined || parsed !== current;

  const save = async () => {
    if (!valid) {
      setError('Enter a whole number of at least 1.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateQuota(code, parsed);
    setSaving(false);

    if (result.ok) {
      buzz(30);
      onSaved(result.quota);
      setOpen(false);
    } else if (result.needsAuth) {
      onNeedsAuth();
      setError(result.reason);
    } else {
      setError(result.reason);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-chip px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="label">Quota</p>
          <p className="mt-0.5 text-[15px] font-bold">
            {current === undefined ? (
              <span className="text-faint">unknown</span>
            ) : (
              <>
                {current.toLocaleString()}
                <span className="ml-1 text-[12px] font-medium text-muted">members</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-bold"
          onClick={() => setOpen(true)}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber bg-amber/10 p-3">
      <p className="label mb-2 text-ink">Quota for {code}</p>

      <div className="mb-2 flex gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setValue(String(preset))}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold ${
              parsed === preset ? 'bg-ink text-surface' : 'bg-surface text-ink'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void save()}
        placeholder="e.g. 1500"
        className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-[15px] outline-none placeholder:text-faint focus:border-ink"
      />

      {error && <p className="mb-2 text-[12px] text-bad">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-lg bg-ink py-2.5 text-[14px] font-bold text-surface disabled:opacity-40"
          onClick={() => void save()}
          disabled={saving || !valid || !changed}
        >
          {saving ? 'Saving…' : changed ? 'Save quota' : 'Unchanged'}
        </button>
        <button
          type="button"
          className="rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] font-bold"
          onClick={() => {
            setOpen(false);
            setValue(current ? String(current) : '');
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Changes the merchant&apos;s capacity immediately — the tag itself only
        carries the activation link.
      </p>
    </div>
  );
}
