/**
 * Typewriter sound effects synthesized via Web Audio API.
 *
 * Three sounds, all generated on the fly (no audio assets bundled):
 *  - clack: a short burst of band-passed white noise with an exponential
 *    envelope. Pitch jitters per call so successive presses don't feel
 *    looped. Used for normal letter/number/space/Tab.
 *  - backspaceClack: same family but lower pitch + softer envelope, so the
 *    delete keys feel "duller" the way a real platen-strike does on the
 *    return path.
 *  - ding: a short sine bell, used on Enter to evoke the carriage return
 *    bell of a vintage typewriter.
 *
 * The AudioContext is created lazily on the first play() call. Browsers
 * block AudioContext creation outside of a user gesture until 1 happens;
 * deferring side-steps the autoplay policy entirely.
 */
class TypewriterSoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  /** Master volume, 0 to 1. Kept low so the sounds are present but not aggressive. */
  private static readonly VOLUME = 0.25;

  private getCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = TypewriterSoundService.VOLUME;
      this.masterGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Letter / digit / punctuation / space / Tab keypress. */
  playClack(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    this.synthClack(ctx, {
      duration: 0.05,
      filterFreq: 800 + Math.random() * 400, // 800–1200 Hz, pitch jitter
      gainPeak: 0.9,
    });
  }

  /** Backspace / Delete — softer, lower pitch than a normal clack. */
  playBackspaceClack(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    this.synthClack(ctx, {
      duration: 0.06,
      filterFreq: 400 + Math.random() * 200, // 400–600 Hz
      gainPeak: 0.6,
    });
  }

  /** Enter / carriage return — the bell ring of a vintage typewriter. */
  playDing(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1750 + Math.random() * 100; // around the carriage-bell zone

    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.5, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  }

  private synthClack(
    ctx: AudioContext,
    opts: { duration: number; filterFreq: number; gainPeak: number },
  ): void {
    if (!this.masterGain) return;
    const { duration, filterFreq, gainPeak } = opts;

    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      // White noise with a fast exponential decay → "tick" character
      data[i] = (Math.random() * 2 - 1) * Math.exp((-i / sampleCount) * 8);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 2;

    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(gainPeak, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);
    src.start(t0);
  }

  /** Releases the AudioContext. Call on app teardown. */
  destroy(): void {
    if (this.ctx) {
      try { this.ctx.close(); } catch { /* ignore */ }
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const typewriterSound = new TypewriterSoundService();
export { TypewriterSoundService };
