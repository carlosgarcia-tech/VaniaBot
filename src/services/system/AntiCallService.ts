/**
 * AntiCallService.ts
 *
 * Configuration store for the incoming-call blocker.
 *
 * A blocked caller is rejected outright by ClientEventHandlers, and a block
 * list lets the bot decline specific numbers even when blocking is disabled
 * globally. State lives in a JSON file so it survives restarts.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

export interface AntiCallConfig {
  enabled: boolean;
  blockedUsers: string[];
}

/**
 * Coerces arbitrary parsed JSON into a valid config.
 * Non-boolean `enabled` and non-string list entries are dropped rather than
 * trusted, so a hand-edited or truncated file cannot crash startup.
 */
function validateAntiCallConfig(data: unknown): AntiCallConfig {
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    blockedUsers: Array.isArray(raw.blockedUsers)
      ? raw.blockedUsers.filter((user): user is string => typeof user === 'string')
      : [],
  };
}

export class AntiCallService {
  private static instance: AntiCallService;
  /** In-memory mirror of the persisted config, rewritten on every mutation. */
  private config: AntiCallConfig;
  /**
   * Atomic file-backed store for the anti-call config. Replaces the
   * previous plain writeFileSync, which could corrupt the file on a
   * crash mid-write.
   */
  private readonly configStore: JsonFileStore<AntiCallConfig>;

  /**
   * @param configPath overrides the config file location (defaults to
   *   `<cwd>/data/anticall.json`). Used by tests to isolate tmp dirs.
   */
  constructor(configPath?: string) {
    this.configStore = new JsonFileStore<AntiCallConfig>({
      filePath: configPath ?? path.join(process.cwd(), 'data', 'anticall.json'),
      defaults: () => ({ enabled: false, blockedUsers: [] }),
      validate: validateAntiCallConfig,
    });
    this.config = this.configStore.load();
  }

  static getInstance(): AntiCallService {
    if (!AntiCallService.instance) {
      AntiCallService.instance = new AntiCallService();
    }
    return AntiCallService.instance;
  }

  private saveConfig(): void {
    this.configStore.save(this.config);
  }

  /** True when call rejection is enabled globally. */
  /** True when call rejection is enabled globally. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  enable(): void {
    this.config.enabled = true;
    this.saveConfig();
  }

  disable(): void {
    this.config.enabled = false;
    this.saveConfig();
  }

  getConfig(): AntiCallConfig {
    return this.config;
  }

  /** True when this specific caller is on the block list. */
  /** True when this specific caller is on the block list. */
  shouldBlock(callerJid: string): boolean {
    return this.config.blockedUsers.includes(callerJid);
  }

  /** Adds a caller to the block list. No-op when already present. */
  blockUser(userJid: string): void {
    if (!this.config.blockedUsers.includes(userJid)) {
      this.config.blockedUsers.push(userJid);
      this.saveConfig();
    }
  }

  /** Removes a caller from the block list. No-op when absent. */
  /** Removes a caller from the block list. No-op when absent. */
  unblockUser(userJid: string): void {
    const index = this.config.blockedUsers.indexOf(userJid);
    if (index > -1) {
      this.config.blockedUsers.splice(index, 1);
      this.saveConfig();
    }
  }

  /**
   * Snapshot of the block list.
   * Returns the live array, so callers must not mutate it.
   */
  /**
   * Snapshot of the block list.
   * Returns the live array, so callers must not mutate it.
   */
  getBlockedUsers(): string[] {
    return this.config.blockedUsers;
  }
}

export const antiCallService = AntiCallService.getInstance();
