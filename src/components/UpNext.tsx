import { itemState, type QueueItem } from '../lib/useScanQueue';
import { StandIcon } from './icons';

interface Props {
  items: QueueItem[];
  activeCode: string | null;
  onSelect: (code: string) => void;
}

/** "Up next" — the remaining stands, greyed out. */
export function UpNext({ items, activeCode, onSelect }: Props) {
  const rest = items.filter((i) => i.code !== activeCode);
  if (rest.length === 0) return null;

  return (
    <section className="mx-5 mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Up next</h2>
        <p className="text-[14px] font-medium text-muted">
          {rest.length} {rest.length === 1 ? 'stand' : 'stands'}
        </p>
      </div>

      <ul className="space-y-2.5">
        {rest.map((item) => {
          const state = itemState(item);
          return (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => onSelect(item.code)}
                className="flex w-full items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chip text-ink">
                  <StandIcon size={24} />
                </div>
                <p className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.01em]">
                  {item.code}
                </p>
                <span className="shrink-0 text-[13px] font-medium text-faint">
                  {state === 'written' ? 'Written' : state === 'blocked' ? 'Blocked' : 'Waiting'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
