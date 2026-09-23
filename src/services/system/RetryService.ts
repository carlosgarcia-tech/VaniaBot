import { logger } from '@/utils/logger.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: (string | RegExp)[];
  onRetry?: (attempt: number, error: Error, delay: number) => boolean | void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ECONNRESET',
    'timeout',
    '503',
    '502',
    '429',
    'rate_limit',
    'Socket closed',
    'fail',
  ],
};

function isRetryableError(errorMessage: string, retryableErrors: (string | RegExp)[]): boolean {
  for (const pattern of retryableErrors) {
    if (typeof pattern === 'string') {
      if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    } else if (pattern.test(errorMessage)) {
      return true;
    }
  }
  return false;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Runs an operation with exponential backoff and throws the last error when
 * every attempt fails. Only errors matching `retryableErrors` are retried;
 * anything else surfaces immediately.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.baseDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await operation();

      if (attempt > 1) {
        logger.info(`✅ retry: Operation succeeded on attempt ${attempt}/${opts.maxAttempts}`);
      }
      return result;
    } catch (error) {
      const lastError = error as Error;
      const errorMessage = lastError?.message || String(lastError);

      if (!isRetryableError(errorMessage, opts.retryableErrors)) {
        logger.warn(`⚠️ retry: Non-retryable error: ${errorMessage}`);
        throw lastError;
      }

      if (attempt >= opts.maxAttempts) {
        logger.error(
          `❌ retry: All ${opts.maxAttempts} attempts failed. Final error: ${errorMessage}`,
        );
        throw lastError;
      }

      let shouldRetry = true;
      if (opts.onRetry) {
        const verdict = opts.onRetry(attempt, lastError, delay);
        if (typeof verdict === 'boolean') shouldRetry = verdict;
      }

      if (!shouldRetry) throw lastError;

      logger.warn(
        `🔄 retry: Attempt ${attempt}/${opts.maxAttempts} failed. Retrying in ${delay}ms... Error: ${errorMessage}`,
      );
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // Unreachable: every loop path either returns or throws.
  throw new Error('Retry loop exited unexpectedly');
}

/**
 * Races a promise against a timeout. The timer is cleared as soon as the
 * operation settles so pending timeouts do not keep the event loop alive.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(timeoutError || `Operation timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([
    promise.finally(() => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]) as Promise<T>;
}
