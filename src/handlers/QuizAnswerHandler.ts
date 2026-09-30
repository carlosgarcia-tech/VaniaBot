/**
 * QuizAnswerHandler.ts
 *
 * Handles quiz game answer processing in groups.
 * Manages answer validation, scoring, streaks, and rewards.
 * Part of the interactive quiz system with adaptive difficulty.
 *
 * @author **Carlos G** ⭐
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { quizService } from '@/services/study/QuizService.js';
import { difficultyEngine } from '@/services/study/DifficultyEngine.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError, logger } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import type { UserQuizStats } from '@/services/study/QuizTypes.js';
import { QuizDifficulty } from '@/services/study/QuizTypes.js';

interface UserWithQuizStats {
  quizStats?: UserQuizStats;
}

/**
 * Default quiz statistics for new players
 */
const DEFAULT_STATS: UserQuizStats = {
  totalCorrect: 0,
  totalAnswered: 0,
  totalScore: 0,
  bestStreak: 0,
  currentStreak: 0,
  byCategory: {},
  lastPlayed: 0,
  sessionsPlayed: 0,
};

/**
 * Handler for processing quiz answers in group chats.
 * Validates answers, updates scores, and manages game state.
 */
class QuizAnswerHandler {
  /**
   * Handles quiz answer messages.
   * Checks if there's an active quiz session and processes the answer.
   *
   * @param ctx - The message context
   * @returns true if answer was processed, false otherwise
   */
  async handle(ctx: MessageContext): Promise<boolean> {
    if (!ctx.chat.isGroup) {
      return false;
    }

    const hasSession = quizService.hasActiveSession(ctx.chat.jid);

    if (!hasSession) return false;

    const text = ctx.text?.trim();
    if (!text) return false;

    if (text.startsWith('!') || text.startsWith('/')) {
      if (text.toLowerCase() === '!hint' || text.toLowerCase() === '/hint') {
        await this._handleHint(ctx);
        return true;
      }
      return false;
    }

    const getUserStats = async (jid: string): Promise<UserQuizStats | null> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        return user?.quizStats ?? null;
      } catch (error) {
        // El caller trata null como "sin stats previas": una lectura fallida
        // degrada silenciosamente la respuesta. Debug, no ruido.
        logger.debug(`[QuizAnswerHandler] getUserStats(${jid}) failed:`, error);
        return null;
      }
    };

    const updateStats = async (jid: string, patch: Partial<UserQuizStats>): Promise<void> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        if (!user) return;
        const prev: UserQuizStats = user.quizStats ?? { ...DEFAULT_STATS };
        const updated: UserQuizStats = {
          ...prev,
          totalCorrect: prev.totalCorrect + (patch.totalCorrect ?? 0),
          totalAnswered: prev.totalAnswered + (patch.totalAnswered ?? 0),
          currentStreak:
            patch.currentStreak !== undefined ? patch.currentStreak : prev.currentStreak,
          bestStreak: Math.max(prev.bestStreak, patch.currentStreak ?? 0),
          lastPlayed: patch.lastPlayed ?? prev.lastPlayed,
        };
        await serviceManager.userService.updateUser(jid, {
          quizStats: updated,
        } as Parameters<typeof serviceManager.userService.updateUser>[1]);
      } catch (error) {
        logError(`[QuizAnswerHandler] updateStats failed for ${jid}`, error);
      }
    };

    const awardCoins = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addMoney(jid, amount);
      } catch (error) {
        logError(`[QuizAnswerHandler] awardCoins(${amount}) failed for ${jid}`, error);
      }
    };

    const awardXP = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addXP(jid, amount);
      } catch (error) {
        logError(`[QuizAnswerHandler] awardXP(${amount}) failed for ${jid}`, error);
      }
    };

    const result = await quizService.processAnswer(
      ctx.chat.jid,
      ctx.sender.jid,
      ctx.sender.pushName ?? ctx.sender.jid,
      text,
      {
        sendFn: (_, msg) => ctx.reply(msg),
        getUserStats,
        updateStats,
        awardCoins,
        awardXP,
      },
    );

    if (!result) return false;

    const { player, coinsAwarded, xpAwarded, newStreak, sessionEnded } = result;

    const streakMsg =
      newStreak >= 3
        ? `\n🔥 *Streak of ${newStreak}!* +${difficultyEngine.calculateCoins(QuizDifficulty.MEDIUM, newStreak) - 35} bonus`
        : '';

    const hintPenalty = player.usedHint ? '\n_(reduced reward for using hint)_' : '';

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *muy bien, ${player.pushName}!* ˚₊· ͟͟͞͞➳\n\n` +
        `✿ +${coinsAwarded} moneditas\n` +
        `✩ +${xpAwarded} XP ✩` +
        streakMsg +
        hintPenalty +
        (sessionEnded ? '' : '\n\n_la siguiente viene en 4 segunditos..._'),
    );
    return true;
  }

  /**
   * Handles hint requests during a quiz.
   * Provides a hint to the current question with a penalty.
   *
   * @param ctx - The message context
   * @returns Promise<void>
   */
  private async _handleHint(ctx: MessageContext): Promise<void> {
    const hint = quizService.getHint(ctx.chat.jid, ctx.sender.jid);
    if (!hint) return;

    await ctx.reply(
      `💡 *Hint:* ${hint}\n\n` + `_(If answered correctly, you will earn 50% less coins)_`,
    );
  }
}

export const quizAnswerHandler = new QuizAnswerHandler();
