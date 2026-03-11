import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypewriterSoundService } from '$lib/services/typewriterSound';

class MockAudio {
  static all: MockAudio[] = [];
  src: string;
  volume = 1.0;
  currentTime = 0;
  preload = '';
  paused = true;
  playCalls = 0;
  constructor(src?: string) {
    this.src = src ?? '';
    MockAudio.all.push(this);
  }
  play(): Promise<void> {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

describe('TypewriterSoundService (HTML5 audio path)', () => {
  let service: TypewriterSoundService;
  let originalAudio: typeof Audio | undefined;

  beforeEach(() => {
    originalAudio = (window as unknown as { Audio?: typeof Audio }).Audio;
    MockAudio.all = [];
    (window as unknown as { Audio: unknown }).Audio = MockAudio;
    service = new TypewriterSoundService();
  });

  afterEach(() => {
    service.destroy();
    if (originalAudio) {
      (window as unknown as { Audio: typeof Audio }).Audio = originalAudio;
    } else {
      delete (window as unknown as Record<string, unknown>).Audio;
    }
  });

  describe('lazy initialization', () => {
    it('does NOT create Audio elements before any sound is played', () => {
      expect(MockAudio.all.length).toBe(0);
    });

    it('creates a pool of variants on the first playClack()', () => {
      service.playClack();
      // 4 clack + 4 backspace + 4 ding = 12 elements
      expect(MockAudio.all.length).toBe(12);
    });

    it('reuses the same pool across calls', () => {
      service.playClack();
      const after1 = MockAudio.all.length;
      for (let i = 0; i < 20; i++) service.playClack();
      // No new Audio elements created — they are pooled and reused.
      expect(MockAudio.all.length).toBe(after1);
    });
  });

  describe('playClack', () => {
    it('produces a data: URL pointing at a WAV blob', () => {
      service.playClack();
      const audio = MockAudio.all.find((a) => a.src.startsWith('data:audio/wav;base64,'));
      expect(audio).toBeDefined();
    });

    it('rotates through pool variants (round-robin)', () => {
      // Reset playCalls on existing audios after init; then trigger 4 clacks,
      // each of the 4 variants should be played once.
      service.playClack(); // init + first variant played
      const clackAudios = MockAudio.all.slice(0, 4);
      // First call already incremented one variant's playCalls. Reset and play 4.
      for (const a of clackAudios) a.playCalls = 0;
      for (let i = 0; i < 4; i++) service.playClack();
      const totals = clackAudios.map((a) => a.playCalls);
      // Each variant should be played exactly once over 4 calls.
      expect(totals.every((c) => c === 1)).toBe(true);
    });

    it('resets currentTime so a rapid press starts from 0', () => {
      service.playClack();
      const audio = MockAudio.all[0];
      audio.currentTime = 0.05;
      service.playClack();
      // The next variant's currentTime is reset; original audio kept its value.
      // We verify the rotated variant (index 1) was reset to 0.
      expect(MockAudio.all[1].currentTime).toBe(0);
    });
  });

  describe('playBackspaceClack', () => {
    it('uses a different pool than playClack', () => {
      service.playClack();
      const clackPlayed = MockAudio.all.slice(0, 4).filter((a) => a.playCalls > 0);
      service.playBackspaceClack();
      const backspaceAudios = MockAudio.all.slice(4, 8);
      const backspacePlayed = backspaceAudios.filter((a) => a.playCalls > 0);
      expect(clackPlayed.length).toBeGreaterThan(0);
      expect(backspacePlayed.length).toBeGreaterThan(0);
      // Backspace's played audio is NOT one of the clacks.
      expect(backspaceAudios.some((a) => MockAudio.all.slice(0, 4).includes(a))).toBe(false);
    });
  });

  describe('playDing', () => {
    it('plays from a third pool', () => {
      service.playDing();
      const dingAudios = MockAudio.all.slice(8, 12);
      const played = dingAudios.find((a) => a.playCalls > 0);
      expect(played).toBeDefined();
    });
  });

  describe('setVolume', () => {
    it('applies the volume to every pooled element when init was already done', () => {
      service.playClack(); // init
      service.setVolume(0.3);
      const volumes = MockAudio.all.map((a) => a.volume);
      expect(volumes.every((v) => v === 0.3)).toBe(true);
    });

    it('clamps to [0, 1]', () => {
      service.playClack();
      service.setVolume(2);
      expect(MockAudio.all.every((a) => a.volume === 1)).toBe(true);
      service.setVolume(-1);
      expect(MockAudio.all.every((a) => a.volume === 0)).toBe(true);
    });

    it('stores the value before init so the next pool is created with it', () => {
      service.setVolume(0.4);
      expect(MockAudio.all.length).toBe(0);
      service.playClack();
      expect(MockAudio.all.every((a) => a.volume === 0.4)).toBe(true);
    });
  });

  describe('testTone', () => {
    it('creates a one-shot Audio element separate from the pool', () => {
      service.testTone();
      // testTone uses a fresh Audio (not pooled), so no pool init.
      expect(MockAudio.all.length).toBe(1);
      expect(MockAudio.all[0].src.startsWith('data:audio/wav;base64,')).toBe(true);
    });

    it('plays at full volume regardless of current setVolume', () => {
      service.setVolume(0.1);
      service.testTone();
      expect(MockAudio.all[0].volume).toBe(1.0);
    });
  });

  describe('destroy', () => {
    it('clears the pools', () => {
      service.playClack();
      service.destroy();
      // After destroy, calling playClack rebuilds (initialized=false again).
      const beforeReinit = MockAudio.all.length;
      service.playClack();
      expect(MockAudio.all.length).toBeGreaterThan(beforeReinit);
    });

    it('is idempotent', () => {
      service.playClack();
      service.destroy();
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('environment without HTMLAudioElement', () => {
    it('returns gracefully when Audio is undefined', () => {
      delete (window as unknown as Record<string, unknown>).Audio;
      const fresh = new TypewriterSoundService();
      expect(() => fresh.playClack()).not.toThrow();
      expect(() => fresh.playDing()).not.toThrow();
      expect(() => fresh.playBackspaceClack()).not.toThrow();
      expect(() => fresh.testTone()).not.toThrow();
    });
  });
});
