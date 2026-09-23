import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry, withTimeout } from '../../src/services/system/RetryService.js';

describe('withRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return result on first success', async () => {
    const result = await withRetry(async () => 'success', { maxAttempts: 3, baseDelay: 5 });
    expect(result).toBe('success');
  });

  it('should retry retryable errors and eventually succeed', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('ECONNRESET: connection reset');
        return 'recovered';
      },
      { maxAttempts: 3, baseDelay: 5, maxDelay: 20 },
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('should throw immediately on non-retryable errors', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('invalid credentials');
        },
        { maxAttempts: 3, baseDelay: 5 },
      ),
    ).rejects.toThrow('invalid credentials');
    expect(calls).toBe(1);
  });

  it('should throw after max attempts on persistent retryable errors', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('503 service unavailable');
        },
        { maxAttempts: 2, baseDelay: 5 },
      ),
    ).rejects.toThrow('503 service unavailable');
    expect(calls).toBe(2);
  });

  it('should respect onRetry veto', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('ETIMEDOUT');
        },
        { maxAttempts: 3, baseDelay: 5, onRetry: () => false },
      ),
    ).rejects.toThrow('ETIMEDOUT');
    expect(calls).toBe(1);
  });
});

describe('withTimeout', () => {
  it('should resolve when the promise wins the race', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('should reject with the timeout error when it expires', async () => {
    await expect(
      withTimeout(
        new Promise<string>(() => {}),
        20,
        'custom timeout message',
      ),
    ).rejects.toThrow('custom timeout message');
  });

  it('should clear the timer when the operation settles', async () => {
    vi.useFakeTimers();
    try {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const promise = withTimeout(Promise.resolve('fast'), 10_000);
      await promise;
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
