import { itemState, type QueueItem } from '../lib/useScanQueue';

interface Props {
  items: QueueItem[];
  activeCode: string | null;
  onSelect: (code: string) => void;
  onRemove: (code: string) => void;
}

const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  written: { label: 'Written', cls: 'bg-ok/20 text-ok' },
  ready: { label: 'Ready', cls: 'bg-amber/20 text-amber' },
  blocked: { label: 'Blocked', cls: 'bg-bad/20 text-bad' },
  unverified: { label: 'Unverified', cls: 'bg-white/10 text-white/60' },
};

export function QueueList({ items, activeCode, onSelect, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm font-bold text-white/70">No codes scanned yet</p>
        <p className="mt-1 text-xs text-white/40">
          Point the camera at the QR stickers from the admin portal.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const state = itemState(item);
        const style = STATE_STYLE[state] ?? STATE_STYLE.unverified!;
        const isActive = item.code === activeCode;
        return (
          <li
            key={item.code}
            className={`card flex items-center gap-3 p-3 ${
              isActive ? 'border-amber/60 bg-amber/[0.06]' : ''
            }`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect(item.code)}
            >
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-bold">{item.code}</span>
                <span className={`pill ${style.cls}`}>{style.label}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/40">
                {item.check?.detail ?? 'Not checked against PocketBase yet'}
                {item.quotaOverride !== undefined && (
                  <span className="ml-1 text-amber/80">
                    · {item.quotaOverride.toLocaleString()} members
                  </span>
                )}
              </p>
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.code}`}
              className="shrink-0 rounded-lg px-2 py-1 text-white/30 hover:bg-white/10 hover:text-white/70"
              onClick={() => onRemove(item.code)}
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
