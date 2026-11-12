import { useState } from 'react';
import { loginAdmin } from '../lib/pbAuth';

interface Props {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}

/**
 * Superuser sign-in.
 *
 * Signing in is mandatory: the app does not mount until a session exists, so
 * this doubles as the gate (see LoginGate) and as the re-auth sheet shown when
 * a session expires mid-batch.
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-black">Session expired</h2>
            <p className="mt-0.5 text-[11px] text-white/40">Sign in again to continue.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-white/40 hover:bg-white/10"
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
          className="mb-2 w-full rounded-lg bg-black/50 px-3 py-2.5 text-sm outline-none placeholder:text-white/25"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          className="mb-2 w-full rounded-lg bg-black/50 px-3 py-2.5 text-sm outline-none placeholder:text-white/25"
        />

        {error && <p className="mb-2 text-[11px] text-bad">{error}</p>}

        <button
          type="button"
          className="btn-amber w-full"
          onClick={() => void submit()}
          disabled={busy}
        >
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight">
          RISEV <span className="text-amber">SCAN</span>
        </h1>
        <p className="mt-1 text-xs text-white/40">Stand activation</p>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 text-base font-black">Admin sign-in</h2>
        <p className="mb-4 text-[11px] leading-relaxed text-white/40">
          Required to scan and write stands. Use your PocketBase superuser
          account.
        </p>

        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@risev.app"
          className="mb-2 w-full rounded-lg bg-black/50 px-3 py-3 text-sm outline-none placeholder:text-white/25"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          className="mb-3 w-full rounded-lg bg-black/50 px-3 py-3 text-sm outline-none placeholder:text-white/25"
        />

        {error && <p className="mb-3 text-[11px] text-bad">{error}</p>}

        <button
          type="button"
          className="btn-amber w-full py-3"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-white/25">
        The session stays on this device. Sign out from the header when you are
        done.
      </p>
    </div>
  );
}
