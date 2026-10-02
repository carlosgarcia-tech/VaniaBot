/**
 * ResilienceService.ts
 *
 * Per-command circuit breaker: when a command fails repeatedly within a sliding
 * window, it is temporarily disabled so a persistently broken command stops
 * consuming resources and spamming users.
 *
 * State is persisted to JSON so a command disabled for its cooldown stays
 * disabled across restarts, and survives even if the process is recycled
 * during the cooldown window.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

const FILE = path.join(process.cwd(), 'database', 'resilience.json');

const resilienceFileStore = new JsonFileStore<ResilienceStore>({
  filePath: FILE,
  defaults: createDefaultStore,
});

/** Failure history and cooldown state for one command. */
export interface CommandFailureEntry {
  /** Timestamps of failures still inside the window. */
  failures: number[];
  /** Epoch ms until which the command is disabled; 0 when enabled. */
  disabledUntil: number;
  lastError: string;
  lastFailureAt: number;
}

export interface ResilienceStore {
  enabled: boolean;
  /** Failures within the window that trigger a cooldown. */
  threshold: number;
  /** Sliding window in which failures are counted. */
  windowMs: number;
  /** How long a tripped command stays disabled. */
  cooldownMs: number;
  commands: Record<string, CommandFailureEntry>;
}

/** Enabled, 4 failures in 10 minutes, 15-minute cooldown. */
function createDefaultStore(): ResilienceStore {
  return {
    enabled: true,
    threshold: 4,
    windowMs: 10 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
    commands: {},
  };
}

/**
 * Constrains a config value to a safe range.
 * Non-finite input falls back to the default rather than corrupting the store.
 */
function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export class ResilienceService {
  private store: ResilienceStore;

  /** Loads persisted state from disk. */
  constructor() {
    this.store = resilienceFileStore.load();
  }

  /**
   * Returns the entry for a command, creating it on first use.
   * Keys are lower-cased and trimmed so `!Ping` and `ping` share one counter.
   */
  private ensureCommand(name: string): CommandFailureEntry {
    const key = name.toLowerCase().trim();
    if (!this.store.commands[key]) {
      this.store.commands[key] = {
        failures: [],
        disabledUntil: 0,
        lastError: '',
        lastFailureAt: 0,
      };
    }
    return this.store.commands[key];
  }

  /** Drops failures that have fallen out of the sliding window. */
  private pruneFailures(entry: CommandFailureEntry): void {
    const now = Date.now();
    const windowMs = this.store.windowMs;
    entry.failures = entry.failures.filter(timestamp => now - timestamp <= windowMs);
  }

  /**
   * Records a failure and trips the cooldown once the threshold is reached.
   *
   * Failures are cleared when tripping so the next window starts clean, and
   * `lastError` is truncated to keep the persisted file small.
   */
  recordFailure(commandName: string, error: unknown): void {
    if (!this.store.enabled) return;

    const entry = this.ensureCommand(commandName);
    this.pruneFailures(entry);
    entry.failures.push(Date.now());
    entry.lastFailureAt = Date.now();
    entry.lastError = String(
      (error as { message?: string })?.message || error || 'error desconocido',
    ).slice(0, 220);

    if (entry.failures.length >= this.store.threshold) {
      entry.disabledUntil = Date.now() + this.store.cooldownMs;
      entry.failures = [];
    }

    resilienceFileStore.save(this.store);
  }

  /** Clears a command's failure history after a successful run. */
  recordSuccess(commandName: string): void {
    const entry = this.ensureCommand(commandName);
    entry.failures = [];
    resilienceFileStore.save(this.store);
  }

  /**
   * Reports whether the command is currently in its cooldown.
   * An expired cooldown is cleared here (and persisted), so the state does not
   * linger in the file.
   */
  isBlocked(commandName: string): { blocked: boolean; remainingMs: number; lastError: string } {
    const entry = this.ensureCommand(commandName);
    const disabledUntil = entry.disabledUntil;
    const now = Date.now();

    if (!disabledUntil || now >= disabledUntil) {
      if (disabledUntil) {
        entry.disabledUntil = 0;
        resilienceFileStore.save(this.store);
      }
      return { blocked: false, remainingMs: 0, lastError: entry.lastError };
    }

    return {
      blocked: true,
      remainingMs: disabledUntil - now,
      lastError: entry.lastError,
    };
  }

  /** Per-command state for the dashboard, longest-blocked first. */
  getSnapshot(): {
    enabled: boolean;
    threshold: number;
    cooldownMs: number;
    commands: Array<{
      command: string;
      blocked: boolean;
      disabledUntil: number;
      lastError: string;
    }>;
  } {
    const commands = Object.entries(this.store.commands)
      .map(([command, entry]) => ({
        command,
        blocked: entry.disabledUntil > Date.now(),
        disabledUntil: entry.disabledUntil,
        lastError: entry.lastError,
      }))
      .sort((a, b) => b.disabledUntil - a.disabledUntil);

    return {
      enabled: this.store.enabled,
      threshold: this.store.threshold,
      cooldownMs: this.store.cooldownMs,
      commands,
    };
  }

  /**
   * Updates the breaker configuration.
   * Numeric values are clamped (threshold 2-20, cooldown 1 minute to 24 hours)
   * so an owner command cannot disable the bot indefinitely by accident.
   */
  setConfig(patch: { enabled?: boolean; threshold?: number; cooldownMs?: number }): void {
    if (patch.enabled !== undefined) {
      this.store.enabled = Boolean(patch.enabled);
    }
    if (patch.threshold !== undefined) {
      this.store.threshold = clampNumber(patch.threshold, 2, 20, 4);
    }
    if (patch.cooldownMs !== undefined) {
      this.store.cooldownMs = clampNumber(
        patch.cooldownMs,
        60_000,
        24 * 60 * 60 * 1000,
        15 * 60 * 1000,
      );
    }
    resilienceFileStore.save(this.store);
  }

  /** Forgets a command entirely, lifting its cooldown immediately. */
  clearCommand(commandName: string): void {
    const key = commandName.toLowerCase().trim();
    delete this.store.commands[key];
    resilienceFileStore.save(this.store);
  }
}

export const resilienceService = new ResilienceService();
export { formatTime as formatDuration } from '@/utils/helpers.js';
