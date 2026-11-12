import { ClockIcon, UserIcon } from './icons';

interface Props {
  written: number;
  total: number;
  adminEmail: string;
  onSignOut: () => void;
}

/**
 * App header + the "Stand activation" progress card.
 *
 * Matches the mockup: title block on the left, clock and avatar buttons on the
 * right, then a grey progress card showing "N of M complete".
 */
export function Header({ written, total, adminEmail, onSignOut }: Props) {
  const pct = total === 0 ? 0 : Math.round((written / total) * 100);

  return (
    <header className="px-5 pt-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
            Risev Scan
          </h1>
          <p className="mt-0.5 text-[15px] text-muted">Activate your NFC stands</p>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            aria-label="History"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink"
          >
            <ClockIcon size={21} />
          </button>
          <button
            type="button"
            aria-label={`Signed in as ${adminEmail}. Sign out`}
            title={`${adminEmail} — tap to sign out`}
            onClick={onSignOut}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-chip text-ink"
          >
            <UserIcon size={21} />
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-card bg-chip px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[17px] font-bold">Stand activation</p>
          <p className="text-[13px] font-medium text-muted">
            {written} of {total} complete
          </p>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-pill bg-line">
          <div
            className="h-full rounded-pill bg-ink transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </header>
  );
}
