/**
 * VaniaToggleService.ts
 *
 * Per-chat, per-bot enable/disable gate for the "Vania" (bot active) state.
 *
 * Each bot — the main one plus every sub-bot slot — is toggled independently
 * within a chat, keyed by `${chatJid}|${botId}`. A chat that has never been
 * configured defaults to disabled.
 *
 * The two guards below (`isAllowedForMain` / `isAllowedForSubbot`) are the only
 * entry points used by the pipelines; both fail open on database errors so a
 * broken toggle store never silences every group.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { IDatabase } from '../database/Database';
import { normalizeJid } from '../PermissionService.js';
import { VANIA_TOGGLE_COMMANDS } from '@/config/index.js';
import { logError } from '@/utils/logger.js';

/** Stored toggle state, including who enabled/disabled it and when. */
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

  /** Injected by ServiceManager during startup. */
  setDatabase(db: IDatabase): void {
    this.db = db;
  }

  /** Composite key so one chat can hold a separate state per bot. */
  private makeKey(chatJid: string, botId: string): string {
    return `${normalizeJid(chatJid)}|${botId}`;
  }

  /**
   * Synchronous variant retained for call sites without async context.
   * Always reports false: there is no synchronous store, so a sync caller must
   * be treated as not-enabled and use the async path for the real answer.
   */
  isEnabledSync(_chatJid: string): boolean {
    return false;
  }

  /** True when this bot is currently enabled in the chat. Defaults to false. */
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

  /**
   * Enables the bot in a chat, preserving the previous disable audit fields.
   * A fresh record carries an empty disable history until it is first disabled.
   */
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

  /** Disables the bot in a chat, preserving the previous enable audit fields. */
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

  /**
   * Flips the toggle.
   * @returns The state after the flip.
   */
  async toggle(chatJid: string, toggledBy: string, botId: string = 'main'): Promise<boolean> {
    const isCurrentlyEnabled = await this.isEnabled(chatJid, botId);

    if (isCurrentlyEnabled) {
      await this.disable(chatJid, toggledBy, botId);
    } else {
      await this.enable(chatJid, toggledBy, botId);
    }
    return !isCurrentlyEnabled;
  }

  /** Current state plus the full audit record for the dashboard/panel. */
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

  /**
   * Enabled state for every bot active in a chat.
   * Scans collection keys for the chat prefix, so sub-bots created after the main
   * record are included automatically.
   */
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
