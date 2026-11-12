# RISEV SCAN

Scan activation QR codes and write them to RISEV NFC stands — in one app, on one phone.

Replaces the old loop: scan QR in the admin portal → open Safari → copy → switch to
NFC Tools → paste → write.

## What it does

1. **Scan** — continuous rear-camera QR scanning. Every sticker from the admin
   portal's A4 sheet is read, deduped, and queued. Manual entry exists for a
   creased or unreadable sticker.
2. **Verify** — each code is checked against the public stand resolver, so you
   know before writing whether it is unclaimed, already sold, or not in
   PocketBase at all.
3. **Write** — writes `https://risev.app/nfc?c=<CODE>` to the stand's NFC tag.

## The one platform limit worth knowing

**iOS Safari has no Web NFC.** It is unsupported in every iOS version to date
(confirmed against caniuse: unsupported through iOS 27.x), and WebKit's position
is opposed. There is no way for a web app to write an NFC tag on an iPhone.

So the app has two write paths and picks one at runtime:

| Device | Path | Steps per stand |
| --- | --- | --- |
| **Android / Chrome** | Web NFC, in-app | Tap **Write to stand**, hold the stand to the phone. Done. |
| **iPhone / Safari** | Clipboard handoff | Tap **Copy link** → NFC Tools → paste → write. |

The Android path is the true one-app flow. On iPhone the app still removes the
Safari round-trip and the manual code copying — it hands you the exact URL and
tracks what is done — but the final write has to happen in NFC Tools, because
iOS gives a web page no NFC access.

NFC Tools for iOS has **no URL scheme** to prefill a write, so the handoff is
clipboard-based by necessity, not by choice.

## Validation is read-only

Codes are checked with `GET /api/risev/nfc/resolve?c=<CODE>`, which is public,
CORS-open (`access-control-allow-origin: *`) and read-only. This app therefore
needs **no PocketBase credentials, no login, and no new backend hook**.

It reports three outcomes:

- `200` + `is_paired: false` → **Ready** (unclaimed, safe to write)
- `200` + `is_paired: true` → **Blocked** (already bound to a merchant)
- `404` → **Blocked** (code not in PocketBase — typo or revoked)

A network failure shows **Unverified**, never a false "ready".

## Sign-in is mandatory

The app does not mount until a PocketBase superuser session exists. Nothing
scans, writes, or calls PocketBase behind the login screen — the camera is not
even opened. Sign out from the header to return to the gate.

The session is kept by the PocketBase SDK in localStorage, so it survives a
reload. If it expires mid-batch, the write panel prompts for re-auth rather
than failing silently.

## Verification is automatic

Every scanned code is checked against the resolver **as it is scanned**, so the
row is already marked Ready or Blocked by the time you look at it. The camera
keeps running while the check resolves.

**Verify all** is a recovery action, not the normal path: it retries rows that
were scanned offline or whose check failed.

## Changing quota

Quota is **not** on the NFC tag. The tag only carries
`https://risev.app/nfc?c=<CODE>`. The merchant's capacity is computed live by
`quota_addons.js`:

```sql
SELECT SUM(CASE WHEN quota > 0 THEN quota ELSE 500 END)
FROM activation_codes
WHERE redeemed_by = <merchant> AND is_redeemed = true
```

So editing `activation_codes.quota` changes the merchant's capacity
immediately — **before writing, after writing, and even after the merchant has
redeemed the stand**. Writing the tag and setting the quota are independent.

Tap **Change** next to the quota on the Write tab. Presets are 250 / 500 /
1000 / 1500, or type any whole number ≥ 1.

### This needs an admin sign-in

`activation_codes.updateRule` is `null` (superuser-only), so changing quota
requires a PocketBase superuser session — which the app now requires anyway to
open at all.

## The queue

Persisted to `localStorage`, so a reload or an accidental tab close mid-batch
never loses scanned codes. Status is derived, not stored twice:

| State | Meaning | Writable |
| --- | --- | --- |
| Written | Tag written this session | — |
| Ready | Verified unclaimed | Yes |
| Blocked | Already sold / not found | No |
| Unverified | Not checked yet (offline) | Yes |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # typecheck + tests + build
```

Camera and Web NFC both require a **secure context**. `localhost` counts;
a LAN IP over plain `http://` does not — use the deployed HTTPS URL to test on
a real phone.

## Deploy

Vercel, static. `vercel.json` rewrites everything to `index.html` and keeps
`sw.js` uncached so a new build is picked up.

Target: `scan.risev.app` (needs a DNS record + Vercel project).

## Tests

`npm test` covers the two things that would silently write a wrong stand:

- **`activationCode.test.ts`** — parsing. Accepts the admin portal's URL form,
  the `s`/`code` aliases, bare codes, and custom prefixes; rejects unrelated QR
  content, malformed codes, and the ambiguous characters (`0 O 1 I L`) the
  generator excludes.
- **`qrPipeline.test.ts`** — renders a real QR to an RGBA buffer, decodes it
  through jsQR, and parses it. Proves the actual scan path, not just the parser.

## Layout

```
src/
  lib/
    activationCode.ts   parse + build activation URLs
    resolveCode.ts      read-only PocketBase validation
    webNfc.ts           Web NFC wrapper + capability detection
    useQrScanner.ts     camera + jsQR decode loop
    useScanQueue.ts     queue state, persistence, derived status
    feedback.ts         haptics + beep
  components/
    QueueList.tsx       scanned-code list with status
    WritePanel.tsx      Android in-app write / iOS handoff
  App.tsx               scan + write tabs
```
