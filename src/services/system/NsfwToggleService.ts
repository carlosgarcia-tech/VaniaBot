import type { IDatabase } from '../database/Database';
import { normalizeJid } from '../PermissionService.js';

export interface NsfwToggleRecord {
  key: string;
  /** 'global' or a group JID. */
  scope: string;
  enabled: boolean;
  changedBy: string;
  changedAt: number;
}

/**
 * Persistent NSFW gate state.
 *
 * Replaces the previous module-level `let nsfwEnabled = false` in
 * NsfwToggleCommand, which reset on every bot restart. State is stored in
 * the shared database under the `nsfw_toggle` collection:
 *
 * - key `global`  → master switch for DMs and as default for groups.
 * - key `<groupJid>` → per-group override.
 */
export class NsfwToggleService {
  private db!: IDatabase;
  private readonly COLLECTION = 'nsfw_toggle';
  private readonly GLOBAL_KEY = 'global';

  setDatabase(db: IDatabase): void {
    this.db = db;
  }

  private makeKey(groupJid: string | null): string {
    return groupJid ? normalizeJid(groupJid) : this.GLOBAL_KEY;
  }

  private async getRecord(groupJid: string | null): Promise<NsfwToggleRecord | null> {
    if (!this.db) return null;
    return this.db.get<NsfwToggleRecord>(this.COLLECTION, this.makeKey(groupJid));
  }

  /**
   * True when NSFW content is allowed. In a group, the per-group record
   * wins; otherwise the global record decides. Defaults to disabled.
   */
  async isEnabled(groupJid: string | null): Promise<boolean> {
    if (groupJid) {
      const groupRecord = await this.getRecord(groupJid);
      if (groupRecord) return groupRecord.enabled;
    }
    const globalRecord = await this.getRecord(null);
    return globalRecord?.enabled ?? false;
  }

  async setEnabled(
    enabled: boolean,
    changedBy: string,
    groupJid: string | null = null,
  ): Promise<void> {
    const key = this.makeKey(groupJid);
    const record: NsfwToggleRecord = {
      key,
      scope: groupJid ? normalizeJid(groupJid) : this.GLOBAL_KEY,
      enabled,
      changedBy,
      changedAt: Date.now(),
    };
    await this.db.set(this.COLLECTION, key, record);
    await this.db.flush();
  }
}
