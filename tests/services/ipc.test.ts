import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, IpcTimeoutError } from '$lib/services/ipc';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves with the inner value when the promise settles before the deadline', async () => {
    const inner = Promise.resolve(42);
    const result = await withTimeout(inner, 'test_cmd', 1000);
    expect(result).toBe(42);
  });

  it('rejects with IpcTimeoutError when the deadline elapses first', async () => {
    const pending = new Promise<number>(() => {});
    const raced = withTimeout(pending, 'slow_cmd', 5000);

    vi.advanceTimersByTime(5000);

    await expect(raced).rejects.toBeInstanceOf(IpcTimeoutError);
  });

  it('attaches the command name and timeout on the error', async () => {
    const pending = new Promise<number>(() => {});
    const raced = withTimeout(pending, 'read_file', 7500);

    vi.advanceTimersByTime(7500);

    try {
      await raced;
      expect.fail('expected rejection');
    } catch (e) {
      expect(e).toBeInstanceOf(IpcTimeoutError);
      const err = e as IpcTimeoutError;
      expect(err.command).toBe('read_file');
      expect(err.timeoutMs).toBe(7500);
      expect(err.name).toBe('IpcTimeoutError');
    }
  });

  it('propagates the inner rejection if the promise rejects before the deadline', async () => {
    const inner = Promise.reject(new Error('boom'));
    await expect(withTimeout(inner, 'cmd', 1000)).rejects.toThrow('boom');
  });

  it('clears the timer once the inner promise resolves so it does not leak', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await withTimeout(Promise.resolve('ok'), 'cmd', 1000);
    expect(clearSpy).toHaveBeenCalled();
  });

  it('clears the timer once the inner promise rejects', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await expect(
      withTimeout(Promise.reject(new Error('x')), 'cmd', 1000),
    ).rejects.toThrow('x');
    expect(clearSpy).toHaveBeenCalled();
  });
});
