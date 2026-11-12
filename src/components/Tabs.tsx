interface Props {
  tab: 'scan' | 'write';
  onChange: (tab: 'scan' | 'write') => void;
  pendingCount: number;
}

/**
 * The two-up segmented control from the mockup.
 *
 * The active half is a white pill with a shadow; the inactive half sits on the
 * grey track. The Write half carries a count badge.
 */
export function Tabs({ tab, onChange, pendingCount }: Props) {
  return (
    <div className="mx-5 mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-chip p-1">
      <button
        type="button"
        onClick={() => onChange('scan')}
        className={`flex items-center justify-center gap-2 rounded-xl py-3 text-[16px] font-bold transition ${
          tab === 'scan' ? 'bg-surface shadow-tab' : 'text-muted'
        }`}
      >
        <span className={tab === 'scan' ? 'text-ink' : 'text-faint'}>1</span>
        <span>Scan QR</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('write')}
        className={`flex items-center justify-center gap-2 rounded-xl py-3 text-[16px] font-bold transition ${
          tab === 'write' ? 'bg-surface shadow-tab' : 'text-muted'
        }`}
      >
        <span className={tab === 'write' ? 'text-ink' : 'text-faint'}>2</span>
        <span>Write NFC</span>
        {pendingCount > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-line px-1.5 text-[12px] font-bold text-muted">
            {pendingCount}
          </span>
        )}
      </button>
    </div>
  );
}
