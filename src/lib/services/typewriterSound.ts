/**
 * Typewriter sound effects synthesized via Web Audio API.
 *
 * Three sounds, all generated on the fly (no audio assets bundled):
 *  - clack: a short oscillator burst (square wave + filter envelope) for
 *    that wood-thunk character. Pitch jitters per call so successive presses
 *    don't feel looped. Used for normal letter/number/space/Tab.
 *  - backspaceClack: same family but lower pitch + softer envelope, so the
 *    delete keys feel "duller" the way a real platen-strike does on the
 *    return path.
 *  - ding: a sine bell, used on Enter to evoke the carriage return bell of
 *    a vintage typewriter.
 *
 * The AudioContext is created lazily on the first play() call. Browsers
 * block AudioContext creation outside of a user gesture until 1 happens;
 * deferring side-steps the autoplay policy entirely.
 *
 * For diagnostic, the singleton is exposed on `window.typewriterSound` in
 * dev — call `typewriterSound.testTone()` from DevTools to verify the audio
 * output chain works end to end.
 */
class TypewriterSoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  /** Master volume, 0 to 1. Bumped from earlier 0.25/0.6 because subtle
   *  sounds were inaudible on WebKitGTK + PulseAudio. User can override via
   *  the Settings slider (preferences.typewriterSoundsVolume → setVolume). */
  private static readonly VOLUME = 1.0;
  private currentVolume = TypewriterSoundService.VOLUME;

  private getCtx(): AudioContext | null {
    if (this.ctx) {
      // Some platforms (WebKitGTK in particular) start the context in
      // 'suspended' state until the first user gesture. Calling resume()
      // is a no-op when already running and cheap to invoke per call.
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch((e) => {
          console.warn('[typewriterSound] resume() rejected:', e);
        });
      }
      return this.ctx;
    }
    try {
      const Ctor =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        console.warn('[typewriterSound] AudioContext not available in this environment');
        return null;
      }
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
      console.info(`[typewriterSound] AudioContext created (state=${this.ctx.state}, sampleRate=${this.ctx.sampleRate})`);
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch((e) => {
          console.warn('[typewriterSound] resume() rejected:', e);
        });
      }
      return this.ctx;
    } catch (e) {
      console.warn('[typewriterSound] AudioContext creation failed:', e);
      return null;
    }
  }

  /** Letter / digit / punctuation / space / Tab keypress. */
  playClack(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    this.synthClack(ctx, {
      duration: 0.08,
      filterFreq: 1200 + Math.random() * 600, // 1200–1800 Hz, pitch jitter
      gainPeak: 1.0,
    });
  }

  /** Backspace / Delete — softer, lower pitch than a normal clack. */
  playBackspaceClack(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;
    this.synthClack(ctx, {
      duration: 0.1,
      filterFreq: 600 + Math.random() * 300, // 600–900 Hz
      gainPeak: 0.7,
    });
  }

  /** Enter / carriage return — the bell ring of a vintage typewriter. */
  playDing(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1750 + Math.random() * 100;

    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.6, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.5);
  }

  /**
   * Diagnostic helper. Plays a clearly audible 500ms 800Hz tone. Use from
   * DevTools to verify the audio output chain (AudioContext → speakers).
   * If you can hear this but not the clacks, the clack synth is too subtle —
   * not an environment problem.
   */
  testTone(): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) {
      console.warn('[typewriterSound] testTone: no AudioContext');
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0.7, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.5);
    console.info('[typewriterSound] testTone played');
  }

  /**
   * Synth the clack using a filtered triangle wave. Triangle is more audible
   * than a noise burst on most output chains (the noise approach was too
   * subtle on WebKitGTK + PulseAudio).
   */
  private synthClack(
    ctx: AudioContext,
    opts: { duration: number; filterFreq: number; gainPeak: number },
  ): void {
    if (!this.masterGain) return;
    const { duration, filterFreq, gainPeak } = opts;
    const t0 = ctx.currentTime;

    // Triangle wave at the filter pitch — gives the percussive "tonk" body.
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = filterFreq;

    // Bandpass for tighter character.
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 4;

    // Tight percussive envelope.
    const env = ctx.createGain();
    env.gain.setValueAtTime(gainPeak, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  /** Sets the master volume (0–1, clamped). Applies immediately if the
   *  AudioContext exists; otherwise stored for the next getCtx(). */
  setVolume(value: number): void {
    const v = Math.max(0, Math.min(1, value));
    this.currentVolume = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
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

// Dev diagnostic: expose the singleton on window so you can call
// `typewriterSound.testTone()` / `playClack()` / `playDing()` from DevTools.
if (typeof window !== 'undefined') {
  (window as unknown as { typewriterSound: TypewriterSoundService }).typewriterSound = typewriterSound;
}
