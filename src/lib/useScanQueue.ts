/**
 * The scan queue.
 *
 * One row per activation code, deduped by code, persisted to localStorage so a
 * reload (or an accidental tab close mid-batch) never loses a scanned code.
 *
 * Status is derived, not stored twice:
 *   - `writtenAt` set            → written
 *   - check.status 'available'   → ready
 *   - check.status 'redeemed'    → already sold, do not write
 *   - check.status 'invalid'     → not in PocketBase, do not write
 *   - check.status 'unknown'/null→ unverified, still writable
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activationUrl } from './activationCode';
import type { CodeCheck } from './resolveCode';

const STORAGE_KEY = 'risev_scan_queue_v1';

export interface QueueItem {
  code: string;
  url: string;
  addedAt: number;
  check: CodeCheck | null;
  writtenAt: number | null;
  /**
   * Quota the operator set for this code, if they changed it.
   *
   * Quota lives in PocketBase, not on the tag, so this is only a local record
   * of the edit — the authoritative value is re-read from the resolver.
   */
  quotaOverride?: number;
}

export type ItemState = 'written' | 'ready' | 'blocked' | 'unverified';

export function itemState(item: QueueItem): ItemState {
  if (item.writtenAt) return 'written';
  if (!item.check) return 'unverified';
  switch (item.check.status) {
    case 'available':
      return 'ready';
    case 'redeemed':
    case 'invalid':
      return 'blocked';
    default:
      return 'unverified';
  }
}

/** A code may be written when it is not already written and not known-bad. */
export function canWrite(item: QueueItem): boolean {
  const state = itemState(item);
  return state === 'ready' || state === 'unverified';
}

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trust nothing from storage: rebuild each row defensively.
    return parsed.flatMap((row): QueueItem[] => {
      if (!row || typeof row !== 'object') return [];
      const r = row as Record<string, unknown>;
      if (typeof r.code !== 'string' || !r.code) return [];
      return [
        {
          code: r.code,
          url: typeof r.url === 'string' ? r.url : activationUrl(r.code),
          addedAt: typeof r.addedAt === 'number' ? r.addedAt : Date.now(),
          check: (r.check as CodeCheck | null) ?? null,
          writtenAt: typeof r.writtenAt === 'number' ? r.writtenAt : null,
          quotaOverride:
            typeof r.quotaOverride === 'number' ? r.quotaOverride : undefined,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function useScanQueue() {
  const [items, setItems] = useState<QueueItem[]>(() =>
    typeof localStorage === 'undefined' ? [] : load(),
  );

  // Persist on every change. Cheap enough at batch sizes (tens of rows).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Quota or private mode — the in-memory queue still works for this session.
    }
  }, [items]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  /**
   * Add a scanned code. Returns 'added' | 'duplicate'.
   * Duplicates are ignored so a camera that sees the same QR for 300ms does not
   * create five rows.
   */
  const add = useCallback((code: string): 'added' | 'duplicate' => {
    let result: 'added' | 'duplicate' = 'added';
    setItems((prev) => {
      if (prev.some((i) => i.code === code)) {
        result = 'duplicate';
        return prev;
      }
      return [
        ...prev,
        { code, url: activationUrl(code), addedAt: Date.now(), check: null, writtenAt: null },
      ];
    });
    return result;
  }, []);

  const setCheck = useCallback((code: string, check: CodeCheck) => {
    setItems((prev) => prev.map((i) => (i.code === code ? { ...i, check } : i)));
  }, []);

  const markWritten = useCallback((code: string) => {
    setItems((prev) =>
      prev.map((i) => (i.code === code ? { ...i, writtenAt: Date.now() } : i)),
    );
  }, []);

  /** Record a quota the operator saved, so the row shows the new value. */
  const setQuota = useCallback((code: string, quota: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.code === code
          ? {
              ...i,
              quotaOverride: quota,
              // Keep the verified detail in step with the new capacity.
              check: i.check ? { ...i.check, quota } : i.check,
            }
          : i,
      ),
    );
  }, []);

  const clearWritten = useCallback(() => {
    setItems((prev) => prev.filter((i) => !i.writtenAt));
  }, []);

  const remove = useCallback((code: string) => {
    setItems((prev) => prev.filter((i) => i.code !== code));
  }, []);

  const reset = useCallback(() => setItems([]), []);

  const counts = useMemo(() => {
    let written = 0;
    let ready = 0;
    let blocked = 0;
    let unverified = 0;
    for (const item of items) {
      switch (itemState(item)) {
        case 'written':
          written++;
          break;
        case 'ready':
          ready++;
          break;
        case 'blocked':
          blocked++;
          break;
        default:
          unverified++;
      }
    }
    return { total: items.length, written, ready, blocked, unverified };
  }, [items]);

  /** The next row worth writing: first ready, else first unverified. */
  const nextWritable = useMemo(
    () => items.find((i) => itemState(i) === 'ready') ?? items.find((i) => itemState(i) === 'unverified') ?? null,
    [items],
  );

  return {
    items,
    counts,
    nextWritable,
    add,
    setCheck,
    markWritten,
    setQuota,
    clearWritten,
    remove,
    reset,
  };
}
