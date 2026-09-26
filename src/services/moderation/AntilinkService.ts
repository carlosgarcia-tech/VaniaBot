import path from 'path';
import { JsonFileStore } from '@/utils/JsonFileStore.js';
import { normalizeJid } from '../PermissionService.js';

const FILE = path.join(process.cwd(), 'database', 'antilink.json');

const store = new JsonFileStore<AntilinkStore>({
  filePath: FILE,
  defaults: () => ({ groups: {} }),
});

export interface AntilinkConfig {
  enabled: boolean;
  mode: 'kick' | 'delete';
  blockWhatsappGroups: boolean;
  blockWhatsappChannels: boolean;
  blockOtherLinks: boolean;
  whitelist: string[];
}

export interface AntilinkStore {
  groups: Record<string, AntilinkConfig>;
}

function normalizeDomain(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function createDefaultConfig(): AntilinkConfig {
  return {
    enabled: false,
    mode: 'kick',
    blockWhatsappGroups: true,
    blockWhatsappChannels: true,
    blockOtherLinks: true,
    whitelist: [],
  };
}

export interface ExtractedLink {
  raw: string;
  domain: string;
  type: 'wa_group' | 'wa_channel' | 'other';
}

function extractLinks(text: string): ExtractedLink[] {
  const matches = String(text || '').match(
    /((?:https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|wa\.me\/[^\s]+)/gi,
  );

  if (!matches) return [];

  return matches.map(raw => {
    const normalized = normalizeDomain(raw);
    const lowerRaw = raw.toLowerCase();
    const isWhatsappGroup =
      lowerRaw.includes('chat.whatsapp.com/') || normalized.includes('chat.whatsapp.com');
    const isWhatsappChannel = lowerRaw.includes('whatsapp.com/channel/');
    const type = isWhatsappGroup ? 'wa_group' : isWhatsappChannel ? 'wa_channel' : 'other';

    return { raw, domain: normalized, type };
  });
}

function isTypeBlocked(link: ExtractedLink, config: AntilinkConfig): boolean {
  if (link.type === 'wa_group') return config.blockWhatsappGroups;
  if (link.type === 'wa_channel') return config.blockWhatsappChannels;
  return config.blockOtherLinks;
}

function isAllowedLink(link: ExtractedLink, config: AntilinkConfig): boolean {
  if (!link.domain) return true;
  if (!isTypeBlocked(link, config)) return true;
  return config.whitelist.some(
    domain => link.domain === domain || link.domain.endsWith(`.${domain}`),
  );
}

export class AntilinkService {
  private store: AntilinkStore;

  constructor() {
    this.store = store.load();
  }

  private getOrCreateConfig(groupId: string): AntilinkConfig {
    const key = normalizeJid(groupId);
    if (!this.store.groups[key]) {
      this.store.groups[key] = createDefaultConfig();
    }
    return this.store.groups[key];
  }

  private saveConfig(groupId: string, config: AntilinkConfig): void {
    const key = normalizeJid(groupId);
    this.store.groups[key] = config;
    store.save(this.store);
  }

  enable(groupId: string): void {
    const config = this.getOrCreateConfig(groupId);
    config.enabled = true;
    this.saveConfig(groupId, config);
  }

  disable(groupId: string): void {
    const config = this.getOrCreateConfig(groupId);
    config.enabled = false;
    this.saveConfig(groupId, config);
  }

  isEnabled(groupId: string): boolean {
    const config = this.getOrCreateConfig(groupId);
    return config.enabled;
  }

  getConfig(groupId: string): AntilinkConfig {
    const config = this.getOrCreateConfig(groupId);
    return { ...config, whitelist: [...config.whitelist] };
  }

  setMode(groupId: string, mode: 'kick' | 'delete'): void {
    const config = this.getOrCreateConfig(groupId);
    config.mode = mode;
    this.saveConfig(groupId, config);
  }

  setBlockType(groupId: string, type: 'groups' | 'channels' | 'others', enabled: boolean): void {
    const config = this.getOrCreateConfig(groupId);
    if (type === 'groups') config.blockWhatsappGroups = enabled;
    if (type === 'channels') config.blockWhatsappChannels = enabled;
    if (type === 'others') config.blockOtherLinks = enabled;
    this.saveConfig(groupId, config);
  }

  addToWhitelist(groupId: string, domain: string): boolean {
    const config = this.getOrCreateConfig(groupId);
    const cleanDomain = normalizeDomain(domain);
    if (!cleanDomain || config.whitelist.includes(cleanDomain)) return false;
    config.whitelist.push(cleanDomain);
    config.whitelist.sort();
    this.saveConfig(groupId, config);
    return true;
  }

  removeFromWhitelist(groupId: string, domain: string): boolean {
    const config = this.getOrCreateConfig(groupId);
    const cleanDomain = normalizeDomain(domain);
    const index = config.whitelist.indexOf(cleanDomain);
    if (index === -1) return false;
    config.whitelist.splice(index, 1);
    this.saveConfig(groupId, config);
    return true;
  }

  getWhitelist(groupId: string): string[] {
    const config = this.getOrCreateConfig(groupId);
    return [...config.whitelist];
  }

  checkMessage(groupId: string, text: string): ExtractedLink | null {
    if (!this.isEnabled(groupId)) return null;

    const config = this.getOrCreateConfig(groupId);
    const links = extractLinks(text);

    for (const link of links) {
      if (!isAllowedLink(link, config)) {
        return link;
      }
    }

    return null;
  }

  getBlockedLinkInfo(
    groupId: string,
    text: string,
  ): { blocked: boolean; link: ExtractedLink | null; action: 'kick' | 'delete' } {
    const config = this.getOrCreateConfig(groupId);
    const blockedLink = this.checkMessage(groupId, text);

    return {
      blocked: blockedLink !== null,
      link: blockedLink,
      action: config.mode,
    };
  }
}

export const antilinkService = new AntilinkService();
