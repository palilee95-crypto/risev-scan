import { describe, expect, it } from 'vitest';
import {
  activationUrl,
  isActivationCode,
  parseActivationPayload,
} from './activationCode';

describe('parseActivationPayload', () => {
  it('extracts the code from the URL the admin portal prints', () => {
    const result = parseActivationPayload('https://risev.app/nfc?c=RSV-8K2P-9M4X');
    expect(result).toEqual({ ok: true, code: 'RSV-8K2P-9M4X', source: 'url' });
  });

  it('accepts the s and code query aliases the resolver also reads', () => {
    expect(parseActivationPayload('https://risev.app/nfc?s=RSV-8K2P-9M4X')).toMatchObject({
      ok: true,
      code: 'RSV-8K2P-9M4X',
    });
    expect(parseActivationPayload('https://risev.app/nfc?code=RSV-8K2P-9M4X')).toMatchObject({
      ok: true,
      code: 'RSV-8K2P-9M4X',
    });
  });

  it('accepts a bare code and normalises case and whitespace', () => {
    expect(parseActivationPayload('  rsv-8k2p-9m4x ')).toEqual({
      ok: true,
      code: 'RSV-8K2P-9M4X',
      source: 'bare',
    });
  });

  it('accepts a custom prefix, since the admin portal allows one', () => {
    expect(parseActivationPayload('https://risev.app/nfc?c=TIKTOK-8K2P-9M4X')).toMatchObject({
      ok: true,
      code: 'TIKTOK-8K2P-9M4X',
    });
  });

  it('rejects a URL with no code parameter', () => {
    const result = parseActivationPayload('https://risev.app/nfc');
    expect(result.ok).toBe(false);
  });

  it('rejects a URL whose code is malformed', () => {
    // 0, O, 1, I and L are excluded from the generator charset.
    const result = parseActivationPayload('https://risev.app/nfc?c=RSV-0O1I-L0O1');
    expect(result.ok).toBe(false);
  });

  it('rejects unrelated QR content rather than guessing', () => {
    expect(parseActivationPayload('https://example.com/promo').ok).toBe(false);
    expect(parseActivationPayload('WIFI:S:Shop;T:WPA;P:secret;;').ok).toBe(false);
    expect(parseActivationPayload('hello world').ok).toBe(false);
  });

  it('rejects empty input', () => {
    expect(parseActivationPayload('').ok).toBe(false);
    expect(parseActivationPayload('   ').ok).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(parseActivationPayload('https://').ok).toBe(false);
  });
});

describe('activationUrl', () => {
  it('round-trips through the parser', () => {
    const url = activationUrl('RSV-8K2P-9M4X');
    expect(url).toBe('https://risev.app/nfc?c=RSV-8K2P-9M4X');
    expect(parseActivationPayload(url)).toMatchObject({ ok: true, code: 'RSV-8K2P-9M4X' });
  });
});

describe('isActivationCode', () => {
  it('recognises valid codes case-insensitively', () => {
    expect(isActivationCode('rsv-8k2p-9m4x')).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(isActivationCode('RSV-8K2P')).toBe(false);
    expect(isActivationCode('RSV-8K2P-9M4X-EXTRA')).toBe(false);
  });
});
