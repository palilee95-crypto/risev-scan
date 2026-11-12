import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { parseActivationPayload } from './activationCode';

/**
 * End-to-end proof of the scan pipeline: a QR rendered the way the admin portal
 * renders it must decode through jsQR and parse into the right activation code.
 *
 * This is the path that decides whether a stand gets the right link, so it is
 * worth pinning rather than trusting by inspection.
 *
 * Rendered to a raw RGBA buffer (not a DOM canvas) so the test runs in plain
 * Node with no jsdom.
 */
async function renderQrToRgba(text: string, size = 320) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const count = modules.size;
  const quiet = 2;
  const total = count + quiet * 2;
  const scale = Math.max(1, Math.floor(size / total));
  const dim = total * scale;

  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (!modules.get(x, y)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (x + quiet) * scale + dx;
          const py = (y + quiet) * scale + dy;
          const i = (py * dim + px) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width: dim, height: dim };
}

describe('QR scan pipeline', () => {
  it('decodes the activation URL the admin portal prints', async () => {
    const url = 'https://risev.app/nfc?c=RSV-HTG7-D9AY';
    const { data, width, height } = await renderQrToRgba(url);

    const found = jsQR(data, width, height);
    expect(found?.data).toBe(url);

    const parsed = parseActivationPayload(found!.data);
    expect(parsed).toEqual({ ok: true, code: 'RSV-HTG7-D9AY', source: 'url' });
  });

  it('decodes a bare-code QR', async () => {
    const { data, width, height } = await renderQrToRgba('RSV-RRKX-DEE5');
    const found = jsQR(data, width, height);
    expect(parseActivationPayload(found!.data)).toMatchObject({
      ok: true,
      code: 'RSV-RRKX-DEE5',
    });
  });

  it('rejects a QR that is not an activation code', async () => {
    const { data, width, height } = await renderQrToRgba('https://example.com/promo');
    const found = jsQR(data, width, height);
    expect(parseActivationPayload(found!.data).ok).toBe(false);
  });
});
