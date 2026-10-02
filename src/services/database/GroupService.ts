/**
 * GroupService.ts
 *
 * Service for managing group settings and configurations.
 * Handles welcome messages, goodbye messages, anti-spam, anti-link,
 * moderation settings, and admin-only mode.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { IDatabase } from './Database.js';

/**
 * Group settings configuration interface.
 * Contains all configurable options for a group.
 */
export interface GroupSettings {
  /** Unique JID of the group */
  jid: string;
  /** Group name */
  name: string;
  /** Whether the group is active */
  isActive: boolean;

  /** Admin-only mode: only admins and owners can use commands */
  onlyAdmin: boolean;

  welcome: {
    enabled: boolean;
    message?: string;
  };

  goodbye: {
    enabled: boolean;
    message?: string;
  };

  antiSpam: {
    enabled: boolean;
    maxMessages: number;
    timeWindow: number;
  };

  antiLink: {
    enabled: boolean;
    allowedDomains: string[];
  };

  antiWords: {
    enabled: boolean;
    words: string[];
  };

  levels: {
    enabled: boolean;
    announceOnLevelUp: boolean;
  };

  economy: {
    enabled: boolean;
  };

  audios: boolean;

  nsfw: boolean;

  prime: {
    enabled: boolean;
  };

  license: {
    planType: 'permanent' | 'monthly';
    paymentType: 'single' | 'subscription';
    activatedAt: number;
    expiresAt: number | null;
    renewAt: number | null;
    lastRenewAt: number | null;
    autoRenew: boolean;
    pricePaid: string;
  };

  autoMod: {
    enabled: boolean;
    deleteLinks: boolean;
    deleteBadWords: boolean;
    warnOnViolation: boolean;
  };

  stats: {
    totalMessages: number;
    totalCommands: number;
  };

  createdAt: number;
  updatedAt: number;
}

/**
 * Service for managing group settings.
 * Provides methods to get, update, and configure group options.
 *
 * @example
 * ```typescript
 * const groupService = new GroupService(database);
 * const settings = await groupService.getGroup(groupJid);
 * await groupService.setOnlyAdmin(groupJid, true);
 * ```
 */
export class GroupService {
  private readonly COLLECTION = 'groups';

  /**
   * Creates a new GroupService instance.
   *
   * @param db - The database instance for persistence
   */
  constructor(private db: IDatabase) {}

  /**
   * Gets group settings, creating default if not exists.
   *
   * @param jid - The group JID
   * @returns GroupSettings object
   */
  async getGroup(jid: string): Promise<GroupSettings> {
    const existing = await this.db.get<GroupSettings>(this.COLLECTION, jid);

    if (existing) {
      if (!existing.license) {
        existing.license = {
          planType: 'permanent',
          paymentType: 'single',
          activatedAt: Date.now(),
          expiresAt: null,
          renewAt: null,
          lastRenewAt: null,
          autoRenew: false,
          pricePaid: '0',
        };
      }
      return existing;
    }

    const newGroup: GroupSettings = {
      jid,
      name: 'Group',
      isActive: true,
      onlyAdmin: false,
      welcome: {
        enabled: false,
        message: '¡Bienvenido @user a @group! 🎉',
      },
      goodbye: {
        enabled: false,
        message: '¡Adiós @user! 😢',
      },
      antiSpam: {
        enabled: true,
        maxMessages: 10,
        timeWindow: 60,
      },
      antiLink: {
        enabled: false,
        allowedDomains: [],
      },
      antiWords: {
        enabled: false,
        words: [],
      },
      levels: {
        enabled: true,
        announceOnLevelUp: true,
      },
      economy: {
        enabled: true,
      },
      audios: false,
      nsfw: false,
      prime: {
        enabled: false,
      },
      license: {
        planType: 'permanent',
        paymentType: 'single',
        activatedAt: Date.now(),
        expiresAt: null,
        renewAt: null,
        lastRenewAt: null,
        autoRenew: false,
        pricePaid: '0',
      },
      autoMod: {
        enabled: false,
        deleteLinks: false,
        deleteBadWords: false,
        warnOnViolation: true,
      },
      stats: {
        totalMessages: 0,
        totalCommands: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, jid, newGroup);
    return newGroup;
  }

  /**
   * Updates group settings with partial configuration.
   *
   * @param jid - The group JID
   * @param updates - Partial settings to update
   * @returns Promise<void>
   */
  async updateGroup(jid: string, updates: Partial<GroupSettings>): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  /**
   * Configures welcome message for a group.
   *
   * @param jid - The group JID
   * @param enabled - Whether welcome messages are enabled
   * @param message - Optional custom message
   * @returns Promise<void>
   */
  async setWelcome(jid: string, enabled: boolean, message?: string): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      welcome: { enabled, message },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Configures goodbye message for a group.
   *
   * @param jid - The group JID
   * @param enabled - Whether goodbye messages are enabled
   * @param message - Optional custom message
   * @returns Promise<void>
   */
  async setGoodbye(jid: string, enabled: boolean, message?: string): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      goodbye: { enabled, message },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Toggles anti-spam for a group.
   *
   * @param jid - The group JID
   * @param enabled - Whether anti-spam is enabled
   * @returns Promise<void>
   */
  async toggleAntiSpam(jid: string, enabled: boolean): Promise<void> {
    const group = await this.getGroup(jid);
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiSpam: { ...group.antiSpam, enabled },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Toggles anti-link for a group.
   *
   * @param jid - The group JID
   * @param enabled - Whether anti-link is enabled
   * @returns Promise<void>
   */
  async toggleAntiLink(jid: string, enabled: boolean): Promise<void> {
    const group = await this.getGroup(jid);
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiLink: { ...group.antiLink, enabled },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Adds an allowed domain to the whitelist.
   *
   * @param jid - The group JID
   * @param domain - Domain to allow
   * @returns Promise<void>
   */
  async addAllowedDomain(jid: string, domain: string): Promise<void> {
    const group = await this.getGroup(jid);
    const domains = [...group.antiLink.allowedDomains, domain];

    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiLink: { ...group.antiLink, allowedDomains: domains },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Removes an allowed domain from the whitelist.
   *
   * @param jid - The group JID
   * @param domain - Domain to remove
   * @returns Promise<void>
   */
  async removeAllowedDomain(jid: string, domain: string): Promise<void> {
    const group = await this.getGroup(jid);
    const domains = group.antiLink.allowedDomains.filter(d => d !== domain);

    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiLink: { ...group.antiLink, allowedDomains: domains },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async addBadWord(jid: string, word: string): Promise<void> {
    const group = await this.getGroup(jid);
    const words = [...group.antiWords.words, word.toLowerCase()];

    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiWords: { ...group.antiWords, words },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async removeBadWord(jid: string, word: string): Promise<void> {
    const group = await this.getGroup(jid);
    const words = group.antiWords.words.filter(w => w !== word.toLowerCase());

    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      antiWords: { ...group.antiWords, words },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async incrementMessageCount(jid: string): Promise<void> {
    const group = await this.getGroup(jid);
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      stats: {
        ...group.stats,
        totalMessages: group.stats.totalMessages + 1,
      },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async incrementCommandCount(jid: string): Promise<void> {
    const group = await this.getGroup(jid);
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      stats: {
        ...group.stats,
        totalCommands: group.stats.totalCommands + 1,
      },
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async getAllGroups(): Promise<GroupSettings[]> {
    return await this.db.getAll<GroupSettings>(this.COLLECTION);
  }

  async getActiveGroups(): Promise<GroupSettings[]> {
    return await this.db.find<GroupSettings>(this.COLLECTION, {
      isActive: true,
    });
  }

  async deactivateGroup(jid: string): Promise<void> {
    await this.updateGroup(jid, { isActive: false });
  }

  async activateGroup(jid: string): Promise<void> {
    await this.updateGroup(jid, { isActive: true });
  }

  /**
   * Enables or disables admin-only mode for a group.
   * When enabled, only group admins and bot owners can use commands.
   *
   * @param jid - The group JID
   * @param enabled - Whether admin-only mode should be enabled
   * @returns Promise<void>
   */
  async setOnlyAdmin(jid: string, enabled: boolean): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      onlyAdmin: enabled,
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  /**
   * Gets the admin-only mode status for a group.
   *
   * @param jid - The group JID
   * @returns true if admin-only mode is enabled, false otherwise
   */
  async getOnlyAdmin(jid: string): Promise<boolean> {
    const group = await this.getGroup(jid);
    return group.onlyAdmin;
  }

  async toggleAudios(jid: string, enabled: boolean): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      audios: enabled,
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }

  async toggleNSFW(jid: string, enabled: boolean): Promise<void> {
    await this.db.update<GroupSettings>(this.COLLECTION, jid, {
      nsfw: enabled,
      updatedAt: Date.now(),
    });
    await this.db.flush();
  }
}
