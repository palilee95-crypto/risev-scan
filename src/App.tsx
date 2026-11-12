import { useCallback, useEffect, useRef, useState } from 'react';
import { parseActivationPayload } from './lib/activationCode';
import { checkCode } from './lib/resolveCode';
import { useScanQueue, itemState } from './lib/useScanQueue';
import { useQrScanner } from './lib/useQrScanner';
import { buzz, beep } from './lib/feedback';
import { nfcSupport, writeUrlToTag } from './lib/webNfc';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { ScanViewport } from './components/ScanViewport';
import { ScannedStands } from './components/ScannedStands';
import { WriteCard } from './components/WriteCard';
import { UpNext } from './components/UpNext';
import { AdminLogin, LoginGate } from './components/AdminLogin';
import { ArrowRightIcon } from './components/icons';
import { currentAdmin, logoutAdmin } from './lib/pbAuth';

type Tab = 'scan' | 'write';
type Phase = 'idle' | 'writing' | 'done' | 'failed';

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
  const [loginOpen, setLoginOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const writeAbort = useRef<AbortController | null>(null);

  const support = nfcSupport();

  /**
   * Verify one code in the background.
   *
   * Runs per scan rather than in a batch, so the row is already marked
   * Ready/Blocked by the time the operator looks at it.
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
        setTimeout(() => setLastAdded((c) => (c === parsed.code ? null : c)), 1800);
        void verifyOne(parsed.code);
        // One parcel, one stand: go straight to writing this code.
        setActiveCode(parsed.code);
        setPhase('idle');
        setMessage(null);
        setCopied(false);
        setTab('write');
      }
    },
    [queue, verifyOne],
  );

  const scanner = useQrScanner(handleDecode);

  // Auto-start the camera when the Scan tab is showing.
  useEffect(() => {
    if (tab === 'scan' && scanner.state === 'idle') {
      void scanner.start();
    }
    if (tab !== 'scan' && scanner.state === 'scanning') {
      scanner.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Resume the camera when the operator comes back to the tab.
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

  useEffect(() => () => writeAbort.current?.abort(), []);

  const handleManualAdd = (raw: string) => {
    const parsed = parseActivationPayload(raw);
    if (!parsed.ok) {
      setScanError(parsed.reason);
      beep('bad');
      return;
    }
    setScanError(null);
    const result = queue.add(parsed.code);
    buzz(30);
    if (result === 'added') {
      void verifyOne(parsed.code);
      setActiveCode(parsed.code);
      setPhase('idle');
      setMessage(null);
      setCopied(false);
      setTab('write');
    }
  };

  const activeItem = queue.items.find((i) => i.code === activeCode) ?? queue.nextWritable;
  const activeIndex = activeItem
    ? queue.items.findIndex((i) => i.code === activeItem.code)
    : 0;

  const handleWrite = async () => {
    if (!activeItem) return;
    writeAbort.current?.abort();
    const controller = new AbortController();
    writeAbort.current = controller;

    setPhase('writing');
    setMessage('Hold the stand against the back of your phone…');

    const result = await writeUrlToTag(activeItem.url, controller.signal);
    if (controller.signal.aborted) return;

    if (result.ok) {
      setPhase('done');
      setMessage('Written. The stand now opens the activation link.');
      buzz([40, 60, 40]);
      beep('ok');
      queue.markWritten(activeItem.code);
    } else {
      setPhase('failed');
      setMessage(result.reason);
      beep('bad');
    }
  };

  const handleCopy = async () => {
    if (!activeItem) return;
    try {
      await navigator.clipboard.writeText(activeItem.url);
      setCopied(true);
      buzz(30);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setMessage('Could not copy automatically — long-press the link to copy it.');
    }
  };

  const handleMarkWritten = () => {
    if (!activeItem) return;
    queue.markWritten(activeItem.code);
    setPhase('done');
    setMessage('Marked as written.');
    buzz(30);
  };

  /** Return to the scanner for the next parcel. */
  const handleScanNext = () => {
    setActiveCode(null);
    setPhase('idle');
    setMessage(null);
    setCopied(false);
    setTab('scan');
  };

  const pending = queue.items.filter((i) => itemState(i) !== 'written').length;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-canvas">
      <Header
        written={queue.counts.written}
        total={queue.counts.total}
        adminEmail={adminEmail}
        onSignOut={onSignOut}
      />

      <Tabs tab={tab} onChange={setTab} pendingCount={pending} />

      <main className="flex-1 pb-28">
        {tab === 'scan' ? (
          <>
            <ScanViewport
              scanner={scanner}
              lastAdded={lastAdded}
              scanError={scanError}
              onManualAdd={handleManualAdd}
            />
            <div className="px-5">
              <ScannedStands
                items={queue.items}
                onSelect={(code) => {
                  setActiveCode(code);
                  setPhase('idle');
                  setMessage(null);
                  setCopied(false);
                  setTab('write');
                }}
                onRemove={queue.remove}
              />
            </div>
          </>
        ) : (
          <>
            <div className="px-5 pt-4">
              <h2 className="text-[26px] font-extrabold tracking-[-0.02em]">Ready to write</h2>
              <p className="mt-0.5 text-[15px] text-muted">Write one stand at a time.</p>
            </div>

            {activeItem ? (
              <WriteCard
                item={activeItem}
                index={activeIndex}
                total={queue.items.length}
                support={support}
                copied={copied}
                onCopy={() => void handleCopy()}
                onGetApp={() =>
                  window.open(
                    'https://apps.apple.com/app/nfc-tools/id1252962749',
                    '_blank',
                    'noopener',
                  )
                }
                onWrite={() => void handleWrite()}
                onMarkWritten={handleMarkWritten}
                onScanNext={handleScanNext}
                onQuotaSaved={(quota) => queue.setQuota(activeItem.code, quota)}
                onNeedsAuth={() => setLoginOpen(true)}
                phase={phase}
                message={message}
              />
            ) : (
              <div className="mx-5 mt-4 rounded-card border border-dashed border-line px-5 py-10 text-center">
                <p className="text-[16px] font-bold">
                  {queue.counts.total === 0 ? 'Nothing to write yet' : 'All stands written'}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {queue.counts.total === 0
                    ? 'Scan a QR sticker first.'
                    : 'Every scanned code has been written to a stand.'}
                </p>
              </div>
            )}

            <UpNext
              items={queue.items}
              activeCode={activeItem?.code ?? null}
              onSelect={(code) => {
                setActiveCode(code);
                setPhase('idle');
                setMessage(null);
                setCopied(false);
              }}
            />
          </>
        )}
      </main>

      {/* Sticky primary action, as in the mockup. */}
      {tab === 'scan' && queue.items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" className="btn-primary" onClick={() => setTab('write')}>
            Continue to write · {pending}
            <ArrowRightIcon size={20} />
          </button>
          <p className="mt-2 text-center text-[12px] text-faint">
            Write each stand using NFC Tools
          </p>
        </div>
      )}

      <AdminLogin
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignedIn={() => setLoginOpen(false)}
      />
    </div>
  );
}
