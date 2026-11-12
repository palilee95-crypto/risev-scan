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
 * Only needed to *change* quota — scanning and writing work without it, because
 * validation goes through the public resolver. The session is kept by the
 * PocketBase SDK in localStorage, so this is a once-per-device step.
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
            <h2 className="text-base font-black">Admin sign-in</h2>
            <p className="mt-0.5 text-[11px] text-white/40">
              Needed only to change quota.
            </p>
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

        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          Uses your PocketBase superuser account. The session stays on this
          device only.
        </p>
      </div>
    </div>
  );
}
