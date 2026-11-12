/**
 * Web NFC wrapper.
 *
 * Availability is the whole story here:
 *   - Chrome on Android 89+ → `NDEFReader` exists, we can write in-app.
 *   - iOS Safari (all versions to date) → no Web NFC at all, so the app falls
 *     back to a clipboard handoff into NFC Tools.
 *   - Desktop → no NFC radio; the panel explains rather than failing silently.
 *
 * The API is not in TypeScript's DOM lib, so the minimal surface is declared
 * here instead of pulling a dependency.
 */

interface NDEFRecordInit {
  recordType: string;
  data?: string | BufferSource;
  id?: string;
  encoding?: string;
  lang?: string;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFReaderLike {
  write(message: { records: NDEFRecordInit[] }, options?: NDEFWriteOptions): Promise<void>;
}

type NDEFReaderCtor = new () => NDEFReaderLike;

declare global {
  interface Window {
    NDEFReader?: NDEFReaderCtor;
  }
}

export type NfcSupport = 'supported' | 'insecure' | 'unsupported';

/** Why Web NFC is or is not usable, so the UI can say something specific. */
export function nfcSupport(): NfcSupport {
  if (typeof window === 'undefined') return 'unsupported';
  // Web NFC requires a secure context; plain http:// on a LAN IP will not do.
  if (!window.isSecureContext) return 'insecure';
  if (typeof window.NDEFReader !== 'function') return 'unsupported';
  return 'supported';
}

export type WriteOutcome =
  | { ok: true }
  | { ok: false; reason: string; code: 'cancelled' | 'no-tag' | 'denied' | 'unsupported' | 'error' };

/**
 * Write one URL record to whatever tag is presented.
 *
 * Resolves only once the tag has actually been written — the browser keeps the
 * promise pending while it waits for a tag, which is exactly the "tap the
 * stand now" window the UI shows.
 */
export async function writeUrlToTag(url: string, signal?: AbortSignal): Promise<WriteOutcome> {
  const support = nfcSupport();
  if (support === 'insecure') {
    return {
      ok: false,
      code: 'unsupported',
      reason: 'NFC needs HTTPS. Open this app over https://, not a LAN IP.',
    };
  }
  if (support === 'unsupported') {
    return {
      ok: false,
      code: 'unsupported',
      reason: 'This browser has no Web NFC. Use Chrome on Android, or the NFC Tools handoff.',
    };
  }

  const Ctor = window.NDEFReader;
  if (!Ctor) {
    return { ok: false, code: 'unsupported', reason: 'Web NFC unavailable.' };
  }

  try {
    const reader = new Ctor();
    await reader.write(
      {
        records: [
          {
            // A URL record is what a phone reads as "open this link".
            recordType: 'url',
            data: url,
          },
        ],
      },
      { overwrite: true, signal },
    );
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    switch (name) {
      case 'AbortError':
        return { ok: false, code: 'cancelled', reason: 'Write cancelled.' };
      case 'NotAllowedError':
        return {
          ok: false,
          code: 'denied',
          reason: 'NFC permission denied. Allow it in Chrome site settings and retry.',
        };
      case 'NotSupportedError':
        return {
          ok: false,
          code: 'unsupported',
          reason: 'This device or tag is not supported by Web NFC.',
        };
      case 'NotReadableError':
        return {
          ok: false,
          code: 'no-tag',
          reason: 'Tag could not be read. Hold it still against the phone and retry.',
        };
      case 'NetworkError':
        return {
          ok: false,
          code: 'no-tag',
          reason: 'Tag moved away before the write finished. Try again and hold it still.',
        };
      default:
        return {
          ok: false,
          code: 'error',
          reason: err instanceof Error ? err.message : 'Unknown NFC error.',
        };
    }
  }
}
