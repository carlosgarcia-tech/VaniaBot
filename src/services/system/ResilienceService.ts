import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

const FILE = path.join(process.cwd(), 'database', 'resilience.json');

const resilienceFileStore = new JsonFileStore<ResilienceStore>({
  filePath: FILE,
  defaults: createDefaultStore,
});

export interface CommandFailureEntry {
  failures: number[];
  disabledUntil: number;
  lastError: string;
  lastFailureAt: number;
}

export interface ResilienceStore {
  enabled: boolean;
  threshold: number;
  windowMs: number;
  cooldownMs: number;
  commands: Record<string, CommandFailureEntry>;
}

function createDefaultStore(): ResilienceStore {
  return {
    enabled: true,
    threshold: 4,
    windowMs: 10 * 60 * 1000,
    cooldownMs: 15 * 60 * 1000,
    commands: {},
  };
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export class ResilienceService {
  private store: ResilienceStore;

  constructor() {
    this.store = resilienceFileStore.load();
  }

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

  private pruneFailures(entry: CommandFailureEntry): void {
    const now = Date.now();
    const windowMs = this.store.windowMs;
    entry.failures = entry.failures.filter(timestamp => now - timestamp <= windowMs);
  }

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

  recordSuccess(commandName: string): void {
    const entry = this.ensureCommand(commandName);
    entry.failures = [];
    resilienceFileStore.save(this.store);
  }

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

  clearCommand(commandName: string): void {
    const key = commandName.toLowerCase().trim();
    delete this.store.commands[key];
    resilienceFileStore.save(this.store);
  }
}

export const resilienceService = new ResilienceService();
export { formatTime as formatDuration } from '@/utils/helpers.js';
