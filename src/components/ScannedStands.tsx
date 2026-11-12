import { useMemo, useState } from 'react';
import { itemState, type QueueItem } from '../lib/useScanQueue';
import { CheckCircleIcon, DotsIcon, StandIcon } from './icons';

interface Props {
  items: QueueItem[];
  onSelect: (code: string) => void;
  onRemove: (code: string) => void;
}

/** How many rows the collapsed list shows. */
const RECENT_LIMIT = 5;

/**
 * "Scanned stands" list.
 *
 * Each row: stand glyph in a tinted square, the code, a status line, then a
 * green check and an overflow button — as in the mockup.
 *
 * Collapsed to the five most recent scans so a 33-parcel batch does not push
 * the camera off screen; "View all" expands the full queue.
 */
export function ScannedStands({ items, onSelect, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);

  const ready = items.filter((i) => itemState(i) === 'ready').length;

  // Newest first: the queue is append-ordered, so the last scan is the one the
  // operator most likely wants to see.
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.addedAt - a.addedAt),
    [items],
  );

  const hasMore = sorted.length > RECENT_LIMIT;
  const visible = expanded ? sorted : sorted.slice(0, RECENT_LIMIT);
  const hidden = sorted.length - visible.length;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">Scanned stands</h2>
        {items.length > 0 && (
          <p className="text-[14px] font-medium text-muted">{ready} ready</p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-ink">No stands scanned yet</p>
          <p className="mt-1 text-[13px] text-muted">
            Point the camera at a QR sticker to begin.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {visible.map((item) => {
              const state = itemState(item);
              const blocked = state === 'blocked';
              return (
                <li
                  key={item.code}
                  className="flex items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      blocked ? 'bg-bad-soft text-bad' : 'bg-chip text-ink'
                    }`}
                  >
                    <StandIcon size={24} />
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelect(item.code)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-[16px] font-bold tracking-[-0.01em]">
                      {item.code}
                    </p>
                    <p
                      className={`mt-0.5 truncate text-[13px] ${
                        blocked ? 'text-bad' : 'text-muted'
                      }`}
                    >
                      {blocked
                        ? (item.check?.detail ?? 'Failed verification')
                        : state === 'written'
                          ? 'Written to stand'
                          : state === 'ready'
                            ? 'Verified and ready'
                            : 'Verifying…'}
                    </p>
                  </button>

                  {blocked ? (
                    <span className="chip bg-bad-soft text-bad">Blocked</span>
                  ) : state === 'written' ? (
                    <span className="chip bg-chip text-muted">Done</span>
                  ) : (
                    <CheckCircleIcon size={24} className="shrink-0 text-ok" />
                  )}

                  <button
                    type="button"
                    aria-label={`Remove ${item.code}`}
                    onClick={() => onRemove(item.code)}
                    className="shrink-0 rounded-lg p-1 text-faint active:bg-chip"
                  >
                    <DotsIcon size={20} />
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full rounded-xl border border-line bg-surface py-3 text-[14px] font-bold text-ink active:bg-chip"
            >
              {expanded ? 'Show less' : `View all ${sorted.length} stands`}
            </button>
          )}

          {!expanded && hidden > 0 && (
            <p className="mt-3 text-center text-[13px] text-faint">
              Showing the {RECENT_LIMIT} most recent
            </p>
          )}

          {expanded && (
            <p className="mt-3 text-center text-[13px] text-faint">
              Scan another QR to add more stands
            </p>
          )}
        </>
      )}
    </section>
  );
}
