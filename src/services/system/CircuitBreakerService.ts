/**
 * CircuitBreakerService.ts
 *
 * Circuit breaker pattern used to stop hammering an unhealthy dependency.
 *
 * Three states:
 * - CLOSED   — traffic flows normally.
 * - OPEN     — calls are rejected immediately until the cooldown elapses.
 * - HALF_OPEN— a limited number of probe calls are allowed through; enough
 *              consecutive successes close the circuit, any failure reopens it.
 *
 * Rejecting fast while OPEN matters: without it, a failing provider would be
 * retried on every message and each attempt would add to the failure count.
 *
 * CircuitBreakerManager keeps one named circuit per dependency so states do not
 * interfere with each other.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { logger } from '@/utils/logger.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/** Thresholds and timeouts governing state transitions. */
export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the circuit OPEN. */
  failureThreshold: number;
  /** Consecutive successes in HALF_OPEN needed to close it again. */
  successThreshold: number;
  /** Milliseconds the circuit stays OPEN before probing, and per-call timeout. */
  timeout: number;
  /** Metrics window; informational. */
  monitoringPeriod: number;
  name?: string;
}

/** Cumulative and consecutive counters exposed to the dashboard. */
export interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailure: number | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  state: CircuitState;
  totalRequests: number;
  failedRequests: number;
}

/**
 * Defaults: open after 5 consecutive failures, recover after 2 successes, and
 * wait 30s before probing.
 */
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  monitoringPeriod: 60000,
  name: 'circuit-breaker',
};

/** A single circuit guarding one dependency. */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailure: number | null = null;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private nextAttempt: number = 0;
  private options: CircuitBreakerOptions;
  private readonly name: string;

  private metrics: CircuitMetrics = {
    failures: 0,
    successes: 0,
    lastFailure: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    state: 'CLOSED',
    totalRequests: 0,
    failedRequests: 0,
  };

  constructor(options: Partial<CircuitBreakerOptions> = {}, name?: string) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.name = name || this.options.name || 'circuit-breaker';
  }

  /**
   * Runs an operation through the breaker.
   *
   * @throws CircuitOpenError while OPEN, or the original error when the
   *         operation itself fails.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.metrics.failedRequests++;
        throw new CircuitOpenError(
          `Circuit ${this.name} is OPEN. Next attempt: ${new Date(this.nextAttempt).toISOString()}`,
          this.nextAttempt - Date.now(),
        );
      }
      this.state = 'HALF_OPEN';
      logger.info(`🔄 Circuit ${this.name}: HALF_OPEN - Testing recovery`);
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${this.options.timeout}ms`)),
          this.options.timeout,
        ),
      ),
    ]);
  }

  /**
   * Records a success. Only meaningful for closing the circuit: while HALF_OPEN,
   * enough consecutive successes move it back to CLOSED.
   */
  private onSuccess(): void {
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses++;

    this.metrics.successes++;
    this.metrics.consecutiveSuccesses = this.consecutiveSuccesses;
    this.metrics.consecutiveFailures = 0;

    if (this.state === 'HALF_OPEN' && this.consecutiveSuccesses >= this.options.successThreshold) {
      this.state = 'CLOSED';
      this.consecutiveSuccesses = 0;
      logger.info(`✅ Circuit ${this.name}: CLOSED - Recovered successfully`);
    }

    this.updateMetrics();
  }

  /**
   * Records a failure and decides whether to trip.
   *
   * A failure while HALF_OPEN reopens the circuit immediately (the dependency
   * is still unhealthy), whereas while CLOSED it must reach the threshold first.
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailure = Date.now();

    this.metrics.failures++;
    this.metrics.lastFailure = this.lastFailure;
    this.metrics.consecutiveFailures = this.consecutiveFailures;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.failedRequests++;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(
        `⚠️ Circuit ${this.name}: OPEN - Recovery failed, will retry at ${new Date(this.nextAttempt).toISOString()}`,
      );
    } else if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.timeout;
      logger.warn(
        `⚠️ Circuit ${this.name}: OPEN - Threshold reached (${this.consecutiveFailures}/${this.options.failureThreshold}), will retry at ${new Date(this.nextAttempt).toISOString()}`,
      );
    }

    this.updateMetrics();
  }

  private updateMetrics(): void {
    this.metrics.state = this.state;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitMetrics {
    return {
      ...this.metrics,
    };
  }

  /** Forces the circuit back to CLOSED and clears all counters. */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.lastFailure = null;
    this.nextAttempt = 0;
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailure: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      state: 'CLOSED',
      totalRequests: 0,
      failedRequests: 0,
    };
    logger.info(`🔄 Circuit ${this.name}: RESET - Manual reset performed`);
  }

  getHealthStatus(): {
    healthy: boolean;
    state: CircuitState;
    metrics: CircuitMetrics;
  } {
    return {
      healthy: this.state === 'CLOSED',
      state: this.state,
      metrics: this.getMetrics(),
    };
  }
}

/**
 * Thrown when a call is rejected because the circuit is OPEN.
 * `retryAfter` is the number of milliseconds until the next probe.
 */
export class CircuitOpenError extends Error {
  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = 'CircuitOpenError';
    this.retryAfter = retryAfter;
  }
}

/** Registry of named circuits, so each dependency is isolated from the others. */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuits: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  /**
   * Returns the circuit for `name`, creating it on first use.
   * Options are only honoured at creation time; later calls reuse the existing
   * circuit so its accumulated state is not silently discarded.
   */
  getOrCreate(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(options, name));
      logger.debug(`🔧 Circuit breaker created: ${name}`);
    }
    const circuit = this.circuits.get(name);
    if (!circuit) {
      throw new Error(`Failed to create circuit breaker: ${name}`);
    }
    return circuit;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  getAllCircuits(): Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> {
    const result: Record<string, ReturnType<CircuitBreaker['getHealthStatus']>> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      result[name] = circuit.getHealthStatus();
    }
    return result;
  }

  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
    logger.info('🔄 All circuit breakers reset');
  }

  remove(name: string): boolean {
    return this.circuits.delete(name);
  }
}

export const circuitBreakerManager = CircuitBreakerManager.getInstance();
