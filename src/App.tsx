import { useCallback, useEffect, useRef, useState } from 'react';
import { parseActivationPayload } from './lib/activationCode';
import { checkCode } from './lib/resolveCode';
import { useScanQueue, itemState } from './lib/useScanQueue';
import { useQrScanner } from './lib/useQrScanner';
import { buzz, beep } from './lib/feedback';
import { nfcSupport } from './lib/webNfc';
import { QueueList } from './components/QueueList';
import { WritePanel } from './components/WritePanel';
import { AdminLogin, LoginGate } from './components/AdminLogin';
import { currentAdmin, logoutAdmin } from './lib/pbAuth';

type Tab = 'scan' | 'write';

export default function App() {
  const [admin, setAdmin] = useState(() => currentAdmin());

  // Mandatory gate: nothing below mounts without a session, so the camera
  // never starts and no PocketBase call is made behind a login screen.
  if (!admin) {
    return <LoginGate onSignedIn={() => setAdmin(currentAdmin())} />;
  }

  return (
    <Workspace
      adminEmail={admin.email}
      onSignOut={() => {
        logoutAdmin();
        setAdmin(null);
      }}
    />
  );
}

function Workspace({ adminEmail, onSignOut }: { adminEmail: string; onSignOut: () => void }) {
  const queue = useScanQueue();
  const [tab, setTab] = useState<Tab>('scan');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [checking, setChecking] = useState(false);
  const checkAbort = useRef<AbortController | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const support = nfcSupport();

  /**
   * Verify one code in the background.
   *
   * Runs per scan rather than in a batch, so the row is already marked
   * Ready/Blocked by the time the operator looks at it. Failures are silent:
   * the row simply stays Unverified and can be retried with "Verify all".
   */
  const verifyOne = useCallback(
    async (code: string) => {
      const check = await checkCode(code);
      queue.setCheck(code, check);
    },
    [queue],
  );

  const handleDecode = useCallback(
    (text: string) => {
      const parsed = parseActivationPayload(text);
      if (!parsed.ok) {
        setScanError(parsed.reason);
        beep('bad');
        return;
      }
      setScanError(null);
      const result = queue.add(parsed.code);
      if (result === 'added') {
        buzz(35);
        beep('ok');
        setLastAdded(parsed.code);
        setTimeout(() => setLastAdded((c) => (c === parsed.code ? null : c)), 1600);
        // Fire and forget: the camera keeps running while this resolves.
        void verifyOne(parsed.code);
        // One parcel, one stand: go straight to writing this code. The write
        // panel disables itself if verification comes back blocked.
        setActiveCode(parsed.code);
        setTab('write');
      }
    },
    [queue, verifyOne],
  );

  const scanner = useQrScanner(handleDecode);

  // Auto-start the camera when the Scan tab is showing. The user gesture that
  // got them here (opening the app / tapping the tab) satisfies autoplay.
  useEffect(() => {
    if (tab === 'scan' && scanner.state === 'idle') {
      void scanner.start();
    }
    if (tab !== 'scan' && scanner.state === 'scanning') {
      scanner.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // The scanner releases the camera when the tab is hidden (see useQrScanner).
  // Resume it when the operator comes back, so they are not left staring at a
  // dead viewport mid-batch.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && tab === 'scan') {
        void scanner.start();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Retry anything still unverified (offline at scan time, or a failed check).
  // Codes are verified on scan, so this is a recovery action, not the norm.
  const runChecks = useCallback(async () => {
    const pending = queue.items.filter((i) => !i.check && !i.writtenAt);
    if (pending.length === 0) return;
    setChecking(true);
    checkAbort.current?.abort();
    const controller = new AbortController();
    checkAbort.current = controller;

    for (const item of pending) {
      if (controller.signal.aborted) break;
      const check = await checkCode(item.code, controller.signal);
      queue.setCheck(item.code, check);
    }
    setChecking(false);
  }, [queue]);

  useEffect(() => () => checkAbort.current?.abort(), []);

  const handleManualAdd = () => {
    const parsed = parseActivationPayload(manual);
    if (!parsed.ok) {
      setScanError(parsed.reason);
      beep('bad');
      return;
    }
    setScanError(null);
    const result = queue.add(parsed.code);
    setManual('');
    buzz(30);
    if (result === 'added') {
      void verifyOne(parsed.code);
      // Same one-parcel-one-stand loop as a camera scan.
      setActiveCode(parsed.code);
      setTab('write');
    }
  };

  const activeItem = queue.items.find((i) => i.code === activeCode) ?? queue.nextWritable;

  const handleWritten = (code: string) => {
    queue.markWritten(code);
    // Stay on the write panel so the operator sees the confirmation and can
    // tap "Scan next parcel" — jumping back automatically would hide the
    // success and risk writing the same stand twice.
  };

  /** Return to the scanner for the next parcel. */
  const handleScanNext = () => {
    setActiveCode(null);
    setTab('scan');
  };

  const handleSkip = () => {
    const idx = queue.items.findIndex((i) => i.code === activeItem?.code);
    const next = queue.items.slice(idx + 1).find((i) => itemState(i) !== 'written');
    setActiveCode(next?.code ?? null);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h1 className="text-lg font-black tracking-tight">
            RISEV <span className="text-amber">SCAN</span>
          </h1>
          <p className="text-[11px] text-white/40">Stand activation · {support === 'supported' ? 'Web NFC ready' : 'NFC Tools handoff'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black leading-none text-amber">
            {queue.counts.written}
            <span className="text-sm text-white/40">/{queue.counts.total}</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-white/40">written</p>
          <button
            type="button"
            className="mt-1 max-w-[9rem] truncate text-[10px] font-bold text-white/40 underline-offset-2 hover:underline"
            title={adminEmail}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1">
        {(['scan', 'write'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-sm font-bold capitalize transition ${
              tab === t ? 'bg-amber text-ink' : 'text-white/60'
            }`}
          >
            {t}
            {t === 'write' && queue.counts.total > 0 && (
              <span className="ml-1 text-[10px] opacity-70">
                {queue.counts.written}/{queue.counts.total}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="flex-1 space-y-3 px-4 pb-6">
        {tab === 'scan' ? (
          <>
            {/* Camera viewport */}
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                ref={scanner.videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              {/* Reticle */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/5 w-3/5 rounded-2xl border-2 border-amber/70" />
              </div>
              {scanner.state !== 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-6 text-center">
                  <p className="text-sm font-bold">
                    {scanner.state === 'starting' ? 'Starting camera…' : 'Camera off'}
                  </p>
                  {scanner.error && <p className="text-xs text-bad">{scanner.error}</p>}
                  {scanner.state !== 'starting' && (
                    <button type="button" className="btn-amber mt-2" onClick={() => void scanner.start()}>
                      {scanner.state === 'error' ? 'Retry camera' : 'Start camera'}
                    </button>
                  )}
                </div>
              )}
              {lastAdded && (
                <div className="absolute inset-x-3 bottom-3 rounded-xl bg-ok/90 px-3 py-2 text-center text-sm font-bold text-white">
                  Added {lastAdded}
                </div>
              )}
            </div>

            {scanError && (
              <p className="rounded-lg bg-bad/15 px-3 py-2 text-xs text-bad">{scanError}</p>
            )}

            {/* Manual entry — a sticker can be creased or the camera can refuse. */}
            <div className="card flex gap-2 p-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                placeholder="RSV-XXXX-XXXX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm uppercase outline-none placeholder:text-white/25"
              />
              <button type="button" className="btn-ghost px-3 py-2" onClick={handleManualAdd}>
                Add
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                {queue.counts.total} scanned · {queue.counts.ready} ready
                {queue.counts.blocked > 0 && ` · ${queue.counts.blocked} blocked`}
              </p>
              <button
                type="button"
                className="text-xs font-bold text-amber disabled:opacity-40"
                onClick={() => void runChecks()}
                disabled={checking || queue.items.every((i) => i.check || i.writtenAt)}
              >
                {checking ? 'Checking…' : 'Verify all'}
              </button>
            </div>

            <QueueList
              items={queue.items}
              activeCode={activeItem?.code ?? null}
              onSelect={(code) => {
                setActiveCode(code);
                setTab('write');
              }}
              onRemove={queue.remove}
            />
          </>
        ) : (
          <>
            {activeItem ? (
              <WritePanel
                item={activeItem}
                onWritten={handleWritten}
                onSkip={handleSkip}
                onQuotaSaved={queue.setQuota}
                onNeedsAuth={() => setLoginOpen(true)}
                onScanNext={handleScanNext}
              />
            ) : (
              <div className="card p-6 text-center">
                <p className="text-sm font-bold text-white/70">
                  {queue.counts.total === 0
                    ? 'Nothing to write yet'
                    : queue.counts.blocked > 0
                      ? 'Nothing left that can be written'
                      : 'All codes written'}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {queue.counts.total === 0
                    ? 'Scan the QR stickers first.'
                    : queue.counts.blocked > 0
                      ? `${queue.counts.blocked} code(s) are blocked — already sold or not in PocketBase. Remove them to finish the batch.`
                      : 'Every scanned code has been written to a stand.'}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                {queue.counts.written} written ·{' '}
                {queue.counts.ready + queue.counts.unverified} left
                {queue.counts.blocked > 0 && ` · ${queue.counts.blocked} blocked`}
              </p>
              {queue.counts.written > 0 && (
                <button
                  type="button"
                  className="text-xs font-bold text-white/50"
                  onClick={queue.clearWritten}
                >
                  Clear written
                </button>
              )}
            </div>

            <QueueList
              items={queue.items}
              activeCode={activeItem?.code ?? null}
              onSelect={setActiveCode}
              onRemove={queue.remove}
            />

            {queue.counts.total > 0 && (
              <button
                type="button"
                className="w-full py-3 text-xs font-bold text-bad/70"
                onClick={() => {
                  if (confirm('Clear the whole queue? Written codes stay written on the stands.')) {
                    queue.reset();
                    setActiveCode(null);
                  }
                }}
              >
                Clear entire queue
              </button>
            )}
          </>
        )}
      </main>

      <AdminLogin
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignedIn={() => setLoginOpen(false)}
      />
    </div>
  );
}
