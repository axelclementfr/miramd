import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TypewriterSoundService } from '$lib/services/typewriterSound';

class MockEnvelope {
  events: { method: string; gain: number; time: number }[] = [];
  private _value = 1;
  get value() { return this._value; }
  set value(v: number) { this._value = v; }
  setValueAtTime(v: number, t: number) { this.events.push({ method: 'setValueAtTime', gain: v, time: t }); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push({ method: 'linearRampToValueAtTime', gain: v, time: t }); }
  exponentialRampToValueAtTime(v: number, t: number) { this.events.push({ method: 'exponentialRampToValueAtTime', gain: v, time: t }); }
}

class MockGainNode {
  type = 'gain';
  connections: MockNode[] = [];
  gain = new MockEnvelope();
  connect(target: MockNode) { this.connections.push(target); }
}

class MockOscillator {
  type: OscillatorType = 'sine';
  nodeType = 'oscillator';
  connections: MockNode[] = [];
  frequency = { value: 440 };
  started = false;
  startedAt = -1;
  stoppedAt = -1;
  connect(target: MockNode) { this.connections.push(target); }
  start(t = 0) { this.started = true; this.startedAt = t; }
  stop(t = 0) { this.stoppedAt = t; }
}

class MockBiquadFilter {
  nodeType = 'biquadFilter';
  connections: MockNode[] = [];
  type: BiquadFilterType = 'lowpass';
  frequency = { value: 0 };
  Q = { value: 0 };
  connect(target: MockNode) { this.connections.push(target); }
}

class MockBufferSource {
  nodeType = 'bufferSource';
  connections: MockNode[] = [];
  buffer: MockBuffer | null = null;
  started = false;
  startedAt = -1;
  connect(target: MockNode) { this.connections.push(target); }
  start(t = 0) { this.started = true; this.startedAt = t; }
}

class MockBuffer {
  data: Float32Array;
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {
    this.data = new Float32Array(length);
  }
  getChannelData(_channel: number) { return this.data; }
}

type MockNode = MockGainNode | MockOscillator | MockBiquadFilter | MockBufferSource | { nodeType: 'destination'; connections: MockNode[] };

class MockAudioContext {
  sampleRate = 44100;
  currentTime = 0;
  destination = { nodeType: 'destination' as const, connections: [] as MockNode[] };
  closed = false;
  nodes: MockNode[] = [];

  createGain() {
    const n = new MockGainNode();
    this.nodes.push(n);
    return n;
  }
  createOscillator() {
    const n = new MockOscillator();
    this.nodes.push(n);
    return n;
  }
  createBiquadFilter() {
    const n = new MockBiquadFilter();
    this.nodes.push(n);
    return n;
  }
  createBufferSource() {
    const n = new MockBufferSource();
    this.nodes.push(n);
    return n;
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new MockBuffer(channels, length, rate);
  }
  close() { this.closed = true; return Promise.resolve(); }
}

describe('TypewriterSoundService', () => {
  let service: TypewriterSoundService;
  let mockCtx: MockAudioContext | null;
  let originalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    originalAudioContext = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    mockCtx = null;
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() {
        mockCtx = new MockAudioContext();
        return mockCtx as unknown as AudioContext;
      }
    };
    service = new TypewriterSoundService();
  });

  afterEach(() => {
    service.destroy();
    if (originalAudioContext) {
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = originalAudioContext;
    } else {
      delete (window as unknown as Record<string, unknown>).AudioContext;
    }
  });

  describe('lazy initialization', () => {
    it('does NOT create an AudioContext before any sound is played', () => {
      expect(mockCtx).toBeNull();
    });

    it('creates the AudioContext on the first playClack()', () => {
      service.playClack();
      expect(mockCtx).not.toBeNull();
    });

    it('creates the AudioContext on the first playDing()', () => {
      service.playDing();
      expect(mockCtx).not.toBeNull();
    });

    it('reuses the same AudioContext across calls', () => {
      service.playClack();
      const firstCtx = mockCtx;
      service.playClack();
      service.playDing();
      expect(mockCtx).toBe(firstCtx);
    });
  });

  describe('playClack', () => {
    it('creates a buffer source + bandpass filter + envelope chain', () => {
      service.playClack();
      const types = mockCtx!.nodes.map((n) => 'nodeType' in n ? n.nodeType : 'gain');
      expect(types).toContain('bufferSource');
      expect(types).toContain('biquadFilter');
    });

    it('uses bandpass filter for the wood-thud feel', () => {
      service.playClack();
      const filter = mockCtx!.nodes.find((n): n is MockBiquadFilter => 'nodeType' in n && n.nodeType === 'biquadFilter');
      expect(filter?.type).toBe('bandpass');
    });

    it('jitters filter frequency between calls so it does not feel looped', () => {
      // First call also creates the AudioContext, so all subsequent filters
      // accumulate in mockCtx.nodes. Collect each new biquad's frequency.
      const seen = new Set<number>();
      for (let i = 0; i < 12; i++) service.playClack();
      const filters = mockCtx!.nodes.filter((n): n is MockBiquadFilter => 'nodeType' in n && n.nodeType === 'biquadFilter');
      for (const f of filters) seen.add(f.frequency.value);
      expect(seen.size).toBeGreaterThan(3);
    });

    it('starts the buffer source', () => {
      service.playClack();
      const src = mockCtx!.nodes.find((n): n is MockBufferSource => 'nodeType' in n && n.nodeType === 'bufferSource');
      expect(src?.started).toBe(true);
    });
  });

  describe('playBackspaceClack', () => {
    it('uses a lower filter frequency than playClack (softer character)', () => {
      service.playBackspaceClack();
      const filter = mockCtx!.nodes.find((n): n is MockBiquadFilter => 'nodeType' in n && n.nodeType === 'biquadFilter');
      // Backspace range: 400-600 Hz, normal clack: 800-1200 Hz
      expect(filter!.frequency.value).toBeLessThanOrEqual(600);
      expect(filter!.frequency.value).toBeGreaterThanOrEqual(400);
    });
  });

  describe('playDing', () => {
    it('creates a sine oscillator with a bell-zone frequency', () => {
      service.playDing();
      const osc = mockCtx!.nodes.find((n): n is MockOscillator => 'nodeType' in n && n.nodeType === 'oscillator');
      expect(osc).toBeDefined();
      expect(osc!.type).toBe('sine');
      expect(osc!.frequency.value).toBeGreaterThanOrEqual(1750);
      expect(osc!.frequency.value).toBeLessThanOrEqual(1850);
    });

    it('schedules an exponential decay on the envelope', () => {
      service.playDing();
      // The per-ding gain is the most-recently-created gain node (master is created first)
      const gains = mockCtx!.nodes.filter((n): n is MockGainNode => n instanceof MockGainNode);
      const env = gains[gains.length - 1];
      const methods = env.gain.events.map((e) => e.method);
      expect(methods).toContain('exponentialRampToValueAtTime');
    });

    it('starts and stops the oscillator', () => {
      service.playDing();
      const osc = mockCtx!.nodes.find((n): n is MockOscillator => 'nodeType' in n && n.nodeType === 'oscillator');
      expect(osc?.started).toBe(true);
      expect(osc?.stoppedAt).toBeGreaterThan(0);
    });
  });

  describe('destroy', () => {
    it('closes the AudioContext', () => {
      service.playClack();
      const ctx = mockCtx!;
      service.destroy();
      expect(ctx.closed).toBe(true);
    });

    it('is a no-op if no sound was ever played', () => {
      expect(() => service.destroy()).not.toThrow();
      expect(mockCtx).toBeNull();
    });

    it('is idempotent — calling destroy twice does not throw', () => {
      service.playClack();
      service.destroy();
      expect(() => service.destroy()).not.toThrow();
    });
  });

  describe('environments without Web Audio', () => {
    it('returns gracefully when AudioContext is undefined', () => {
      delete (window as unknown as Record<string, unknown>).AudioContext;
      delete (window as unknown as Record<string, unknown>).webkitAudioContext;
      const fresh = new TypewriterSoundService();
      expect(() => fresh.playClack()).not.toThrow();
      expect(() => fresh.playDing()).not.toThrow();
      expect(() => fresh.playBackspaceClack()).not.toThrow();
    });
  });
});
