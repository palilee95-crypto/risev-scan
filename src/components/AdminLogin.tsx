import { useState } from 'react';
import { loginAdmin } from '../lib/pbAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}

/**
 * Re-auth sheet, shown when a session expires mid-batch.
 *
 * Signing in is mandatory: the app does not mount until a session exists, so
 * this is only the recovery path (see LoginGate for the first-run screen).
 */
export function AdminLogin({ open, onClose, onSignedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await loginAdmin(email, password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      onSignedIn();
      onClose();
    } else {
      setError(result.reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-sheet">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[18px] font-extrabold">Session expired</h2>
            <p className="mt-0.5 text-[13px] text-muted">Sign in again to continue.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-faint active:bg-chip"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@risev.app"
          className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[15px] outline-none placeholder:text-faint focus:border-ink"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          className="mb-3 w-full rounded-xl border border-line bg-surface px-3 py-3 text-[15px] outline-none placeholder:text-faint focus:border-ink"
        />

        {error && <p className="mb-3 text-[12px] text-bad">{error}</p>}

        <button type="button" className="btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

/**
 * The mandatory sign-in screen.
 *
 * Shown instead of the app, not over it: nothing scans, writes, or reads
 * PocketBase until a superuser session exists.
 */
export function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await loginAdmin(email, password);
    setBusy(false);
    if (result.ok) {
      setPassword('');
      onSignedIn();
    } else {
      setError(result.reason);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em]">
          Risev Scan
        </h1>
        <p className="mt-0.5 text-[15px] text-muted">Activate your NFC stands</p>
      </div>

      <div className="card p-5">
        <h2 className="text-[18px] font-extrabold">Admin sign-in</h2>
        <p className="mb-4 mt-1 text-[13px] leading-relaxed text-muted">
          Required to scan and write stands. Use your PocketBase superuser account.
        </p>

        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@risev.app"
          className="mb-2 w-full rounded-xl border border-line bg-surface px-3 py-3.5 text-[15px] outline-none placeholder:text-faint focus:border-ink"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          className="mb-3 w-full rounded-xl border border-line bg-surface px-3 py-3.5 text-[15px] outline-none placeholder:text-faint focus:border-ink"
        />

        {error && <p className="mb-3 text-[12px] text-bad">{error}</p>}

        <button type="button" className="btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-faint">
        The session stays on this device. Tap the avatar to sign out.
      </p>
    </div>
  );
}
