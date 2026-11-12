/** Short haptic confirmation. Silently ignored where unsupported (iOS). */
export function buzz(pattern: number | number[] = 35): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety, never a requirement.
  }
}

/** Two-tone beep via WebAudio — works on iOS where vibrate does not. */
let audioCtx: AudioContext | null = null;

export function beep(kind: 'ok' | 'bad' = 'ok'): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio is a nicety, never a requirement.
  }
}
