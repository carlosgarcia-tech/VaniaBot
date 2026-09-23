import { logger } from '@/utils/logger.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: (string | RegExp)[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  name?: string;
}

export interface RetryResult<T> {
  success: boolean;
  attempts: number;
  totalTime: number;
  result?: T;
  error?: Error;
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

export class RetryService {
  private options: RetryOptions;
  private readonly name: string;

  constructor(options: Partial<RetryOptions> = {}, name?: string) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.name = name || 'retry-service';
  }

  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let delay = this.options.baseDelay;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const result = await operation();

        if (attempt > 1) {
          logger.info(
            `✅ ${this.name}: Operation succeeded on attempt ${attempt}/${this.options.maxAttempts}`,
          );
        }

        return {
          success: true,
          attempts: attempt,
          totalTime: Date.now() - startTime,
          result,
        };
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message || String(lastError);

        if (!this.isRetryableError(errorMessage)) {
          logger.warn(`⚠️ ${this.name}: Non-retryable error: ${errorMessage}`);
          return {
            success: false,
            attempts: attempt,
            totalTime: Date.now() - startTime,
            error: lastError,
          };
        }

        if (attempt < this.options.maxAttempts) {
          let shouldRetry = true;
          if (this.options.onRetry) {
            const result = this.options.onRetry(attempt, lastError, delay);
            if (typeof result === 'boolean') {
              shouldRetry = result;
            }
          }

          if (shouldRetry) {
            logger.warn(
              `🔄 ${this.name}: Attempt ${attempt}/${this.options.maxAttempts} failed. Retrying in ${delay}ms... Error: ${errorMessage}`,
            );
            await this.sleep(delay);
            delay = Math.min(delay * this.options.backoffMultiplier, this.options.maxDelay);
          }
        } else {
          logger.error(
            `❌ ${this.name}: All ${this.options.maxAttempts} attempts failed. Final error: ${errorMessage}`,
          );
        }
      }
    }

    return {
      success: false,
      attempts: this.options.maxAttempts,
      totalTime: Date.now() - startTime,
      error: lastError,
    };
  }

  private isRetryableError(errorMessage: string): boolean {
    for (const pattern of this.options.retryableErrors) {
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setOptions(options: Partial<RetryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  addRetryableError(pattern: string | RegExp): void {
    this.options.retryableErrors.push(pattern);
  }
}

export class RetryManager {
  private static instance: RetryManager;
  private retryServices: Map<string, RetryService> = new Map();

  private constructor() {}

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  getOrCreate(name: string, options?: Partial<RetryOptions>): RetryService {
    if (!this.retryServices.has(name)) {
      this.retryServices.set(name, new RetryService(options, name));
    }
    const service = this.retryServices.get(name);
    if (!service) {
      throw new Error(`Failed to create retry service: ${name}`);
    }
    return service;
  }

  async retryOperation<T>(
    name: string,
    operation: () => Promise<T>,
    options?: Partial<RetryOptions>,
  ): Promise<RetryResult<T>> {
    const retryService = this.getOrCreate(name, options);
    return retryService.execute(operation);
  }
}

export const retryManager = RetryManager.getInstance();

export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const result = await new RetryService(options).execute(operation);

  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }

  if (!result.result) {
    throw new Error('Operation failed: no result');
  }

  return result.result;
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
