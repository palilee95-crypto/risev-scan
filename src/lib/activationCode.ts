/**
 * Activation-code parsing.
 *
 * The admin portal mints codes as `RSV-XXXX-XXXX` (charset excludes the
 * ambiguous 0/O/1/I/L) and encodes them into QR stickers as
 * `https://risev.app/nfc?c=<CODE>`.
 *
 * A scanned payload can therefore be:
 *   1. the full activation URL          → extract `c`
 *   2. a bare code                      → normalise
 *   3. a URL with the code in `s`/`code` → extract (the resolver accepts these)
 *   4. something else entirely          → reject, never guess
 */

/** Base URL the admin portal encodes into every stand QR sticker. */
export const ACTIVATE_URL_BASE = 'https://risev.app/nfc?c=';

/** Charset used by the admin portal generator (no 0/O/1/I/L). */
const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * `RSV-XXXX-XXXX`, but the prefix is operator-configurable in the admin portal,
 * so accept any 2–6 alphanumeric prefix followed by two 4-char blocks.
 */
const CODE_RE = new RegExp(`^[A-Z0-9]{2,6}-[${CODE_CHARSET}]{4}-[${CODE_CHARSET}]{4}$`);

export type ParseResult =
  | { ok: true; code: string; source: 'url' | 'bare' }
  | { ok: false; reason: string; raw: string };

/** Uppercase, strip whitespace and any stray separators around the code. */
function normalise(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Pull the code out of a scanned string.
 *
 * Deliberately strict: a QR that is not an activation code must be rejected
 * loudly rather than written to a stand, because a wrong write means a
 * customer taps a stand that activates nothing.
 */
export function parseActivationPayload(raw: string): ParseResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'Empty scan', raw: trimmed };

  // 1. URL form — the only form the admin portal actually prints.
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, reason: 'Malformed URL', raw: trimmed };
    }

    // The resolver reads c → s → code, in that order.
    const candidate =
      url.searchParams.get('c') ??
      url.searchParams.get('s') ??
      url.searchParams.get('code') ??
      '';

    const code = normalise(candidate);
    if (!code) {
      return { ok: false, reason: 'URL has no activation code', raw: trimmed };
    }
    if (!CODE_RE.test(code)) {
      return { ok: false, reason: `Not a valid code: ${code}`, raw: trimmed };
    }
    return { ok: true, code, source: 'url' };
  }

  // 2. Bare code.
  const code = normalise(trimmed);
  if (!CODE_RE.test(code)) {
    return { ok: false, reason: `Not a valid code: ${code}`, raw: trimmed };
  }
  return { ok: true, code, source: 'bare' };
}

/** The URL that gets written to the NFC tag. */
export function activationUrl(code: string): string {
  return ACTIVATE_URL_BASE + code;
}

/** True when the string looks like a stand code, without throwing. */
export function isActivationCode(value: string): boolean {
  return CODE_RE.test(normalise(value));
}
