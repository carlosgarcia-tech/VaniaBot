import type { IDatabase } from '../database/Database';
import { normalizeJid } from '../PermissionService.js';
import { VANIA_TOGGLE_COMMANDS } from '@/config/index.js';
import { logError } from '@/utils/logger.js';

export interface ToggleRecord {
  key: string;
  chatJid: string;
  botId: string;
  enabled: boolean;
  enabledBy: string;
  enabledAt: number;
  disabledBy: string;
  disabledAt: number;
}

export class VaniaToggleService {
  private db!: IDatabase;
  private readonly COLLECTION = 'vania_toggle';

  setDatabase(db: IDatabase): void {
    this.db = db;
  }

  private makeKey(chatJid: string, botId: string): string {
    return `${normalizeJid(chatJid)}|${botId}`;
  }

  isEnabledSync(_chatJid: string): boolean {
    return false;
  }

  async isEnabled(chatJid: string, botId: string = 'main'): Promise<boolean> {
    const key = this.makeKey(chatJid, botId);
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, key);
    if (!record) {
      return false;
    }
    return record.enabled;
  }

  /**
   * Unified toggle guard for the MAIN bot pipeline.
   *
   * This is the ONLY gate for the main path — MainMessagePipeline.runGuards
   * runs it for every group message (command or not) before the middleware
   * chain, which no longer repeats the check.
   *
   * Toggle commands (`vaniaon/off/status`) are routed here:
   * - Bare (or non-numeric/<=0 slot) toggles pass through so the main bot
   *   executes them against itself.
   * - Slot-addressed toggles (`!vaniaon 2`) are swallowed: the subbot
   *   instance receives the same group message through its own socket and
   *   handles its own toggle.
   *
   * Non-toggle messages pass only when the main bot is enabled in the
   * chat. Fail-open on DB errors (a broken toggle store must not silence
   * every group; commands will surface their own DB errors anyway).
   */
  async isAllowedForMain(chatJid: string, command: string, args: string[] = []): Promise<boolean> {
    if (VANIA_TOGGLE_COMMANDS.includes(command)) {
      return !this.hasValidSlotArg(args);
    }
    return this.checkEnabled(chatJid, 'main');
  }

  /**
   * Unified toggle guard for a subbot slot.
   *
   * Toggle commands always pass: SubBotMessageHandler skips bare toggles
   * upstream (they belong to the main bot) and slot-addressed toggles
   * bypass the enabled check entirely. Non-toggle messages pass only
   * when this subbot is enabled in the chat. Fail-open on DB errors so a
   * broken toggle store does not silence the whole subbot.
   *
   * This is the ONLY gate for the subbot path — SubBotMessageHandler runs
   * it for every group message (command or not) before the middleware
   * chain, which no longer repeats the check.
   */
  async isAllowedForSubbot(chatJid: string, botId: string, command: string): Promise<boolean> {
    if (VANIA_TOGGLE_COMMANDS.includes(command)) {
      return true;
    }
    return this.checkEnabled(chatJid, botId);
  }

  /** True when args[0] parses as a subbot slot number (> 0). */
  private hasValidSlotArg(args: string[]): boolean {
    if (args.length === 0) return false;
    const slotNum = parseInt(args[0], 10);
    return !isNaN(slotNum) && slotNum > 0;
  }

  /** Enabled check shared by both guards. Fail-open with an error log. */
  private async checkEnabled(chatJid: string, botId: string): Promise<boolean> {
    try {
      return await this.isEnabled(chatJid, botId);
    } catch (error) {
      logError('[VaniaToggleService] guard', error);
      return true;
    }
  }

  async enable(chatJid: string, enabledBy: string, botId: string = 'main'): Promise<void> {
    const key = this.makeKey(chatJid, botId);
    const normalizedJid = normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      key,
      chatJid: normalizedJid,
      botId,
      enabled: true,
      enabledBy,
      enabledAt: Date.now(),
      disabledBy: existing?.disabledBy || '',
      disabledAt: existing?.disabledAt || 0,
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async disable(chatJid: string, disabledBy: string, botId: string = 'main'): Promise<void> {
    const key = this.makeKey(chatJid, botId);
    const normalizedJid = normalizeJid(chatJid);
    const existing = await this.db.get<ToggleRecord>(this.COLLECTION, key);

    const record: ToggleRecord = {
      key,
      chatJid: normalizedJid,
      botId,
      enabled: false,
      enabledBy: existing?.enabledBy || '',
      enabledAt: existing?.enabledAt || 0,
      disabledBy,
      disabledAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }

  async toggle(chatJid: string, toggledBy: string, botId: string = 'main'): Promise<boolean> {
    const isCurrentlyEnabled = await this.isEnabled(chatJid, botId);

    if (isCurrentlyEnabled) {
      await this.disable(chatJid, toggledBy, botId);
    } else {
      await this.enable(chatJid, toggledBy, botId);
    }
    return !isCurrentlyEnabled;
  }

  async getStatus(
    chatJid: string,
    botId: string = 'main',
  ): Promise<{ enabled: boolean; record: ToggleRecord | null }> {
    const key = this.makeKey(chatJid, botId);
    const record = await this.db.get<ToggleRecord>(this.COLLECTION, key);
    return {
      enabled: record?.enabled ?? false,
      record,
    };
  }

  async getBotsStatus(
    chatJid: string,
  ): Promise<{ main: boolean; subbots: Record<string, boolean> }> {
    const normalizedJid = normalizeJid(chatJid);

    const mainKey = this.makeKey(normalizedJid, 'main');
    const mainRecord = await this.db.get<ToggleRecord>(this.COLLECTION, mainKey);

    const allKeys = await this.db.keys(this.COLLECTION);
    const subbots: Record<string, boolean> = {};

    const matchingKeys = allKeys.filter(
      key => key.startsWith(normalizedJid + '|') && key !== mainKey,
    );
    const records = await Promise.all(
      matchingKeys.map(key => this.db.get<ToggleRecord>(this.COLLECTION, key)),
    );
    for (let i = 0; i < matchingKeys.length; i++) {
      const record = records[i];
      if (record) {
        const botId = matchingKeys[i].split('|')[1];
        subbots[botId] = record.enabled;
      }
    }

    return {
      main: mainRecord?.enabled ?? false,
      subbots,
    };
  }
}
