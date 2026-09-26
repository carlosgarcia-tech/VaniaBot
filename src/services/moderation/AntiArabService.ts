import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';
import { normalizeJid } from '../PermissionService.js';

const FILE = path.join(process.cwd(), 'database', 'antiarab.json');

const antiArabStore = new JsonFileStore<AntiArabStore>({
  filePath: FILE,
  defaults: () => ({ groups: {} }),
});

const DEFAULT_PREFIXES = [
  '212', // Morocco
  '213', // Algeria
  '216', // Tunisia
  '218', // Libya
  '20', // Egypt
  '964', // Iraq
  '962', // Jordan
  '963', // Syria
  '965', // Kuwait
  '961', // Lebanon
  '967', // Yemen
  '970', // Palestine
  '971', // UAE
  '973', // Bahrain
  '974', // Qatar
  '968', // Oman
];

export interface AntiArabConfig {
  enabled: boolean;
  prefixes: string[];
}

export interface AntiArabStore {
  groups: Record<string, AntiArabConfig>;
}

export class AntiArabService {
  private store: AntiArabStore;

  constructor() {
    this.store = antiArabStore.load();
  }

  private getOrCreateConfig(groupId: string): AntiArabConfig {
    const key = normalizeJid(groupId);
    if (!this.store.groups[key]) {
      this.store.groups[key] = {
        enabled: false,
        prefixes: [...DEFAULT_PREFIXES],
      };
    }
    return this.store.groups[key];
  }

  private saveConfig(groupId: string, config: AntiArabConfig): void {
    const key = normalizeJid(groupId);
    this.store.groups[key] = config;
    antiArabStore.save(this.store);
  }

  enableGroup(groupId: string): void {
    const config = this.getOrCreateConfig(groupId);
    config.enabled = true;
    this.saveConfig(groupId, config);
  }

  disableGroup(groupId: string): void {
    const config = this.getOrCreateConfig(groupId);
    config.enabled = false;
    this.saveConfig(groupId, config);
  }

  isEnabled(groupId: string): boolean {
    const config = this.getOrCreateConfig(groupId);
    return config.enabled;
  }

  getGroupConfig(groupId: string): AntiArabConfig {
    const config = this.getOrCreateConfig(groupId);
    return {
      enabled: config.enabled,
      prefixes: [...config.prefixes],
    };
  }

  addPrefix(groupId: string, prefix: string): void {
    const config = this.getOrCreateConfig(groupId);
    const cleanPrefix = prefix.replace(/[^\d+]/g, '');
    if (!config.prefixes.includes(cleanPrefix)) {
      config.prefixes.push(cleanPrefix);
      this.saveConfig(groupId, config);
    }
  }

  removePrefix(groupId: string, prefix: string): boolean {
    const config = this.getOrCreateConfig(groupId);
    const cleanPrefix = prefix.replace(/[^\d+]/g, '');
    const index = config.prefixes.indexOf(cleanPrefix);
    if (index !== -1) {
      config.prefixes.splice(index, 1);
      this.saveConfig(groupId, config);
      return true;
    }
    return false;
  }

  shouldBlockNumber(number: string): boolean {
    const cleanNumber = number.replace(/[^\d]/g, '');
    const groups = Object.values(this.store.groups).filter(g => g.enabled);
    return groups.some(group => group.prefixes.some(prefix => cleanNumber.startsWith(prefix)));
  }

  getBlockedPrefixesForNumber(number: string): string[] {
    const cleanNumber = number.replace(/[^\d]/g, '');
    const groups = Object.values(this.store.groups).filter(g => g.enabled);
    const blocked: string[] = [];
    for (const group of groups) {
      for (const prefix of group.prefixes) {
        if (cleanNumber.startsWith(prefix) && !blocked.includes(prefix)) {
          blocked.push(prefix);
        }
      }
    }
    return blocked;
  }
}

export const antiArabService = new AntiArabService();
