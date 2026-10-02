/**
 * database/LevelService.ts
 *
 * XP and levelling on top of UserService, which owns the actual progression
 * maths and persistence.
 *
 * This layer adds the pieces commands need: a result object describing the
 * outcome (including whether a level-up happened), random XP grants, progress
 * towards the next level and the leaderboard.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { IDatabase } from './Database.js';
import type { UserService } from './UserService.js';

/**
 * Outcome of an XP grant.
 * `nextLevelXP` is the threshold for the *next* level, not the current one.
 */
export interface LevelUpResult {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  xpGained: number;
  totalXP: number;
  nextLevelXP: number;
}

export class LevelService {
  constructor(
    private db: IDatabase,
    private userService: UserService,
  ) {}

  /** XP required to advance from `level` to the next. */
  getRequiredXP(level: number): number {
    return this.userService.getRequiredXPForNextLevel(level);
  }

  /**
   * Grants XP and reports what changed.
   * Reads the user first so the previous level can be compared afterwards.
   */
  async addXP(jid: string, amount: number): Promise<LevelUpResult> {
    const user = await this.userService.getUser(jid);
    const oldLevel = user.level;

    const updatedUser = await this.userService.addXP(jid, amount);
    const newLevel = updatedUser.level;

    return {
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      xpGained: amount,
      totalXP: updatedUser.xp,
      nextLevelXP: this.userService.getRequiredXPForNextLevel(newLevel),
    };
  }

  /** Grants a random amount in the inclusive range [min, max]. */
  async giveRandomXP(jid: string, min: number = 10, max: number = 25): Promise<LevelUpResult> {
    const amount = Math.floor(Math.random() * (max - min + 1)) + min;
    return await this.addXP(jid, amount);
  }

  /**
   * Progress within the current level.
   *
   * XP is cumulative, so progress is the difference between the thresholds of the
   * current and next level. `percentage` is therefore the progress through the
   * current level only, not since level 1.
   */
  async getLevelProgress(jid: string): Promise<{
    level: number;
    currentXP: number;
    requiredXP: number;
    percentage: number;
  }> {
    const user = await this.userService.getUser(jid);
    const currentLevelXP = this.userService.getRequiredXPForNextLevel(user.level - 1);
    const nextLevelXP = this.userService.getRequiredXPForNextLevel(user.level);
    const xpInLevel = user.xp - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;

    return {
      level: user.level,
      currentXP: xpInLevel,
      requiredXP: xpNeeded,
      percentage: Math.floor((xpInLevel / xpNeeded) * 100),
    };
  }

  /** Top users by level, with an explicit 1-based rank. */
  async getLeaderboard(
    limit: number = 10,
  ): Promise<Array<{ jid: string; name: string; level: number; xp: number; rank: number }>> {
    const topUsers = await this.userService.getTopByLevel(limit);
    return topUsers.map((user, index) => ({
      jid: user.jid,
      name: user.name,
      level: user.level,
      xp: user.xp,
      rank: index + 1,
    }));
  }

  /** Renders the level-up announcement shown to the chat. */
  formatLevelUpMessage(result: LevelUpResult, userName: string): string {
    return `
🎉 *¡NIVEL SUPERIOR!* 🎉

👤 ${userName}
📊 Nivel ${result.oldLevel} → ${result.newLevel}
✨ +${result.xpGained} XP
💫 XP Total: ${result.totalXP}

Sigue así! 🚀
`.trim();
  }

  /** Text progress bar for levelling output. Progress is clamped to 100%. */
  createProgressBar(current: number, required: number, length: number = 10): string {
    const percentage = Math.min(current / required, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
