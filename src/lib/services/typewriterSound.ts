/**
 * Typewriter sound effects via HTML5 <audio> + base64 WAV.
 *
 * Why not Web Audio API: WebKitGTK's AudioDestinationGStreamer initializes the
 * destination with maxChannelCount=0 in current Tauri builds, so no sound can
 * physically come out regardless of any GainNode/oscillator setup. Confirmed
 * by the user's diagnostic: ctx.state=running but ctx.destination.maxChannelCount=0.
 *
 * HTML5 <audio> uses MediaPlayerPrivateGStreamer (the playbin pipeline) instead,
 * which is the same code path as <video> and routes correctly to the system
 * audio output. It also handles browser autoplay policies more leniently.
 *
 * Implementation:
 *  - Sample synthesis happens in pure JS (no Web Audio dependency).
 *  - Each sound has 4 pre-rendered variants (different pitch jitter) so rapid
 *    typing doesn't sound looped.
 *  - Variants are encoded as 16-bit PCM WAV → base64 data URLs → HTMLAudioElement.
 *  - Variants are pooled (round-robin) so concurrent presses overlap cleanly.
 *  - Volume controlled via audio.volume on each pooled element.
 */

const SAMPLE_RATE = 44100;
const VARIANTS_PER_SOUND = 4;

interface SoundProfile {
  duration: number;       // seconds
  freqMin: number;        // Hz
  freqMax: number;        // Hz
  waveform: 'triangle' | 'sine';
  envelope: 'percussive' | 'bell';
  gainPeak: number;       // 0..1
}

const CLACK_PROFILE: SoundProfile = {
  duration: 0.08,
  freqMin: 1200,
  freqMax: 1800,
  waveform: 'triangle',
  envelope: 'percussive',
  gainPeak: 0.9,
};

const BACKSPACE_PROFILE: SoundProfile = {
  duration: 0.1,
  freqMin: 600,
  freqMax: 900,
  waveform: 'triangle',
  envelope: 'percussive',
  gainPeak: 0.7,
};

const DING_PROFILE: SoundProfile = {
  duration: 0.5,
  freqMin: 1750,
  freqMax: 1850,
  waveform: 'sine',
  envelope: 'bell',
  gainPeak: 0.6,
};

class TypewriterSoundService {
  private clackPool: HTMLAudioElement[] = [];
  private backspacePool: HTMLAudioElement[] = [];
  private dingPool: HTMLAudioElement[] = [];
  private clackIdx = 0;
  private backspaceIdx = 0;
  private dingIdx = 0;
  private currentVolume = 1.0;
  private initialized = false;

  private ensureInit(): void {
    if (this.initialized) return;
    if (typeof Audio === 'undefined') {
      console.warn('[typewriterSound] HTMLAudioElement not available');
      return;
    }
    for (let i = 0; i < VARIANTS_PER_SOUND; i++) this.clackPool.push(this.makeAudio(CLACK_PROFILE));
    for (let i = 0; i < VARIANTS_PER_SOUND; i++) this.backspacePool.push(this.makeAudio(BACKSPACE_PROFILE));
    for (let i = 0; i < VARIANTS_PER_SOUND; i++) this.dingPool.push(this.makeAudio(DING_PROFILE));
    this.initialized = true;
    console.info(`[typewriterSound] HTML5 audio pool ready (${VARIANTS_PER_SOUND} variants × 3 sounds)`);
  }

  private makeAudio(profile: SoundProfile): HTMLAudioElement {
    const samples = synthSamples(profile);
    const wav = samplesToWav(samples, SAMPLE_RATE);
    const url = wavToDataUrl(wav);
    const audio = new Audio(url);
    audio.volume = this.currentVolume;
    audio.preload = 'auto';
    return audio;
  }

  /** Letter / digit / punctuation / space / Tab keypress. */
  playClack(): void {
    this.ensureInit();
    if (!this.clackPool.length) return;
    const audio = this.clackPool[this.clackIdx];
    this.clackIdx = (this.clackIdx + 1) % this.clackPool.length;
    this.fire(audio);
  }

  /** Backspace / Delete — softer, lower pitch. */
  playBackspaceClack(): void {
    this.ensureInit();
    if (!this.backspacePool.length) return;
    const audio = this.backspacePool[this.backspaceIdx];
    this.backspaceIdx = (this.backspaceIdx + 1) % this.backspacePool.length;
    this.fire(audio);
  }

  /** Enter / carriage return — bell ring. */
  playDing(): void {
    this.ensureInit();
    if (!this.dingPool.length) return;
    const audio = this.dingPool[this.dingIdx];
    this.dingIdx = (this.dingIdx + 1) % this.dingPool.length;
    this.fire(audio);
  }

  /** Diagnostic: 1s 440Hz sine via the same HTML5 pipeline. */
  testTone(): void {
    if (typeof Audio === 'undefined') {
      console.warn('[typewriterSound] testTone: HTMLAudioElement not available');
      return;
    }
    const samples = synthSamples({
      duration: 1.0,
      freqMin: 440,
      freqMax: 440,
      waveform: 'sine',
      envelope: 'bell',
      gainPeak: 0.7,
    });
    const wav = samplesToWav(samples, SAMPLE_RATE);
    const audio = new Audio(wavToDataUrl(wav));
    audio.volume = 1.0;
    audio.play().catch((e) => console.warn('[typewriterSound] testTone play failed:', e));
    console.info('[typewriterSound] testTone played (HTML5 audio path)');
  }

  /** Sets the master volume (0–1). Applies to all pooled elements. */
  setVolume(value: number): void {
    const v = Math.max(0, Math.min(1, value));
    this.currentVolume = v;
    for (const a of this.clackPool) a.volume = v;
    for (const a of this.backspacePool) a.volume = v;
    for (const a of this.dingPool) a.volume = v;
  }

  /** Releases the audio elements. */
  destroy(): void {
    for (const a of this.clackPool) {
      try { a.pause(); a.src = ''; } catch { /* ignore */ }
    }
    for (const a of this.backspacePool) {
      try { a.pause(); a.src = ''; } catch { /* ignore */ }
    }
    for (const a of this.dingPool) {
      try { a.pause(); a.src = ''; } catch { /* ignore */ }
    }
    this.clackPool = [];
    this.backspacePool = [];
    this.dingPool = [];
    this.initialized = false;
  }

  private fire(audio: HTMLAudioElement): void {
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* swallow autoplay rejection silently */ });
      }
    } catch {
      /* ignore */
    }
  }
}

// --- WAV synthesis helpers (pure JS, no Web Audio) ---

function synthSamples(profile: SoundProfile): Float32Array {
  const n = Math.floor(SAMPLE_RATE * profile.duration);
  const samples = new Float32Array(n);
  const freq = profile.freqMin + Math.random() * (profile.freqMax - profile.freqMin);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let wave: number;
    if (profile.waveform === 'sine') {
      wave = Math.sin(2 * Math.PI * freq * t);
    } else {
      // Triangle: -1 → +1 → -1 over 1/freq period.
      const phase = (freq * t) % 1;
      wave = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    }
    let env: number;
    if (profile.envelope === 'bell') {
      // Slow exp decay over the full duration.
      env = Math.exp(-i / n * 4);
      // Soft attack to avoid click.
      const attackSamples = Math.floor(SAMPLE_RATE * 0.005);
      if (i < attackSamples) env *= i / attackSamples;
    } else {
      // Fast exp decay (percussive).
      env = Math.exp(-i / n * 8);
    }
    samples[i] = wave * env * profile.gainPeak;
  }
  return samples;
}

function samplesToWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const byteLen = 44 + samples.length * 2;
  const buffer = new ArrayBuffer(byteLen);
  const view = new DataView(buffer);
  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, byteLen - 8, true);
  writeAscii(view, 8, 'WAVE');
  // fmt subchunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM subchunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  // data subchunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  // PCM 16-bit samples (little-endian)
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return new Uint8Array(buffer);
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function wavToDataUrl(wav: Uint8Array): string {
  // Build a binary string for btoa (avoid TextDecoder which doesn't preserve bytes).
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < wav.length; i += chunk) {
    binary += String.fromCharCode.apply(null, wav.subarray(i, i + chunk) as unknown as number[]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export const typewriterSound = new TypewriterSoundService();
export { TypewriterSoundService };

// Dev diagnostic: expose the singleton on window for DevTools console use.
if (typeof window !== 'undefined') {
  (window as unknown as { typewriterSound: TypewriterSoundService }).typewriterSound = typewriterSound;
}
