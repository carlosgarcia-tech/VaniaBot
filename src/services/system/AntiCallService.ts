import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

export interface AntiCallConfig {
  enabled: boolean;
  blockedUsers: string[];
}

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
  private config: AntiCallConfig;
  /**
   * Atomic file-backed store for the anti-call config. Replaces the
   * previous plain writeFileSync, which could corrupt the file on a
   * crash mid-write.
   */
  private readonly configStore = new JsonFileStore<AntiCallConfig>({
    filePath: path.join(process.cwd(), 'data', 'anticall.json'),
    defaults: () => ({ enabled: false, blockedUsers: [] }),
    validate: validateAntiCallConfig,
  });

  constructor() {
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

  shouldBlock(callerJid: string): boolean {
    return this.config.blockedUsers.includes(callerJid);
  }

  blockUser(userJid: string): void {
    if (!this.config.blockedUsers.includes(userJid)) {
      this.config.blockedUsers.push(userJid);
      this.saveConfig();
    }
  }

  unblockUser(userJid: string): void {
    const index = this.config.blockedUsers.indexOf(userJid);
    if (index > -1) {
      this.config.blockedUsers.splice(index, 1);
      this.saveConfig();
    }
  }

  getBlockedUsers(): string[] {
    return this.config.blockedUsers;
  }
}

export const antiCallService = AntiCallService.getInstance();
