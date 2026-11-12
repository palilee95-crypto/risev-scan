/**
 * Read-only validation against the public stand resolver.
 *
 * `GET /api/risev/nfc/resolve?c=<CODE>` is public, CORS-open
 * (`access-control-allow-origin: *`) and read-only, so this app needs no
 * PocketBase credentials and adds no backend surface.
 *
 * It answers one of three things:
 *   - 200 + is_paired:false  → code exists, still unclaimed (writable, good)
 *   - 200 + is_paired:true   → code already bound to a merchant (already sold)
 *   - 404                    → code does not exist (typo / revoked)
 */

const RESOLVE_URL = 'https://api.risev.app/api/risev/nfc/resolve';

export type CodeStatus = 'available' | 'redeemed' | 'unknown' | 'invalid';

export interface CodeCheck {
  status: CodeStatus;
  /** Merchant name when the code is already bound. */
  merchantName?: string;
  plan?: string;
  quota?: number;
  /** Human-readable detail for the row. */
  detail: string;
  checkedAt: number;
}

interface ResolveResponse {
  success?: boolean;
  is_paired?: boolean;
  merchant_name?: string;
  plan?: string;
  quota?: number;
  message?: string;
}

/**
 * Validate one code. Never throws: a network failure yields `unknown`, which
 * the UI shows as "not checked" rather than pretending the code is fine.
 */
export async function checkCode(code: string, signal?: AbortSignal): Promise<CodeCheck> {
  const checkedAt = Date.now();
  try {
    const res = await fetch(`${RESOLVE_URL}?c=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });

    if (res.status === 404) {
      return {
        status: 'invalid',
        detail: 'Code not found in PocketBase',
        checkedAt,
      };
    }

    if (!res.ok) {
      return {
        status: 'unknown',
        detail: `Resolver returned ${res.status}`,
        checkedAt,
      };
    }

    const data = (await res.json()) as ResolveResponse;

    if (data.is_paired) {
      return {
        status: 'redeemed',
        merchantName: data.merchant_name,
        plan: data.plan,
        quota: data.quota,
        detail: data.merchant_name
          ? `Already bound to ${data.merchant_name}`
          : 'Already bound to a merchant',
        checkedAt,
      };
    }

    return {
      status: 'available',
      plan: data.plan,
      quota: data.quota,
      detail: data.plan
        ? `Unclaimed · ${data.plan}${data.quota ? ` · ${data.quota} members` : ''}`
        : 'Unclaimed and ready to write',
      checkedAt,
    };
  } catch (err) {
    // AbortError is a caller decision, not a failure worth surfacing.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'unknown', detail: 'Check cancelled', checkedAt };
    }
    return {
      status: 'unknown',
      detail: 'Offline — could not verify',
      checkedAt,
    };
  }
}
