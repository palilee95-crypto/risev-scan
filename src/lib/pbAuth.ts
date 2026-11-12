/**
 * Superuser access to `activation_codes`.
 *
 * Quota is NOT stored on the NFC tag — the tag only carries
 * `https://risev.app/nfc?c=<CODE>`. The merchant's capacity is computed live by
 * `quota_addons.js`:
 *
 *   SELECT SUM(CASE WHEN quota > 0 THEN quota ELSE 500 END)
 *   FROM activation_codes WHERE redeemed_by = <merchant> AND is_redeemed = true
 *
 * So changing `activation_codes.quota` changes the merchant's capacity
 * immediately, whether or not the stand has been written or redeemed yet.
 *
 * `activation_codes.updateRule` is null (superuser-only), so this needs a real
 * superuser session. The token is kept by the PocketBase SDK in localStorage.
 */

import PocketBase from 'pocketbase';

export const PB_URL = 'https://api.risev.app';

export const pb = new PocketBase(PB_URL);

// This app is not a PocketBase realtime client; skip the SSE connection.
pb.autoCancellation(false);

export interface AdminSession {
  email: string;
  id: string;
}

/** The signed-in superuser, or null. */
export function currentAdmin(): AdminSession | null {
  if (!pb.authStore.isValid) return null;
  const record = pb.authStore.model;
  if (!record) return null;
  return { email: String(record.email ?? ''), id: String(record.id ?? '') };
}

export type LoginResult = { ok: true } | { ok: false; reason: string };

/** Sign in as a PocketBase superuser. */
export async function loginAdmin(email: string, password: string): Promise<LoginResult> {
  try {
    await pb.collection('_superusers').authWithPassword(email.trim(), password);
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403) {
      return { ok: false, reason: 'Wrong email or password.' };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Could not sign in.',
    };
  }
}

export function logoutAdmin(): void {
  pb.authStore.clear();
}

export type QuotaResult =
  | { ok: true; quota: number }
  | { ok: false; reason: string; needsAuth?: boolean };

/**
 * Write a new quota onto one activation code.
 *
 * Returns the value PocketBase actually stored, so the UI never shows a number
 * the server rejected.
 */
export async function updateQuota(code: string, quota: number): Promise<QuotaResult> {
  if (!Number.isInteger(quota) || quota < 1) {
    return { ok: false, reason: 'Quota must be a whole number of at least 1.' };
  }
  if (!currentAdmin()) {
    return { ok: false, reason: 'Sign in as an admin to change quota.', needsAuth: true };
  }

  try {
    // The code is unique (idx_act_code), so this resolves exactly one row.
    const record = await pb
      .collection('activation_codes')
      .getFirstListItem(`code = "${code}"`, { requestKey: null });

    const updated = await pb.collection('activation_codes').update(record.id, { quota });
    return { ok: true, quota: Number(updated.quota) || quota };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        reason: 'Session expired. Sign in again to change quota.',
        needsAuth: true,
      };
    }
    if (status === 404) {
      return { ok: false, reason: `Code ${code} is not in PocketBase.` };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'Could not save the quota.',
    };
  }
}
