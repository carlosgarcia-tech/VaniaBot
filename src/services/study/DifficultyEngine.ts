/**
 * DifficultyEngine.ts
 *
 * OrbitBot services module exposing `DifficultyEngine`, `COIN_REWARDS`, `XP_REWARDS`, `STREAK_BONUS_COINS`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview Adaptive difficulty engine for the Quiz system.
 *
 * Calculates the appropriate difficulty for the next question
 * based on the user's historical stats and current session streak.
 *
 * Algorithm:
 *   - Accuracy > 80% or streak ≥ 5  → HARD
 *   - Accuracy > 55% or streak ≥ 2  → MEDIUM
 *   - Otherwise                      → EASY
 *
 * @module DifficultyEngine
 */

import { QuizDifficulty, type UserQuizStats } from './QuizTypes.js';

export const COIN_REWARDS: Record<QuizDifficulty, number> = {
  [QuizDifficulty.EASY]: 15,
  [QuizDifficulty.MEDIUM]: 35,
  [QuizDifficulty.HARD]: 75,
};

export const XP_REWARDS: Record<QuizDifficulty, number> = {
  [QuizDifficulty.EASY]: 5,
  [QuizDifficulty.MEDIUM]: 12,
  [QuizDifficulty.HARD]: 25,
};

export const STREAK_BONUS_COINS = 20;

export const QUESTION_TIMEOUT_SECS = 30;

export const HINT_OFFER_SECS = 15;

export class DifficultyEngine {
  /**
   * Calculates the appropriate difficulty for the user.
   *
   * @param stats     - The user's historical quiz statistics
   * @param category  - Current category (uses per-category stats when they exist)
   * @param sessionStreak - Streak of correct answers in the active session
   */
  calculate(stats: UserQuizStats | null, category: string, sessionStreak: number): QuizDifficulty {
    if (!stats || stats.totalAnswered === 0) return QuizDifficulty.EASY;

    if (sessionStreak >= 5) return QuizDifficulty.HARD;
    if (sessionStreak >= 2) return QuizDifficulty.MEDIUM;

    const catStats = stats.byCategory?.[category];
    if (catStats && catStats.answered >= 5) {
      const catAccuracy = catStats.correct / catStats.answered;
      if (catAccuracy > 0.8) return QuizDifficulty.HARD;
      if (catAccuracy > 0.55) return QuizDifficulty.MEDIUM;
      return QuizDifficulty.EASY;
    }

    const globalAccuracy = stats.totalCorrect / stats.totalAnswered;
    if (globalAccuracy > 0.8) return QuizDifficulty.HARD;
    if (globalAccuracy > 0.55) return QuizDifficulty.MEDIUM;
    return QuizDifficulty.EASY;
  }

  /**
   * Calculates the coins to award for a correct answer.
   * Includes a streak bonus every 3 correct answers in a row.
   */
  calculateCoins(difficulty: QuizDifficulty, streak: number): number {
    const base = COIN_REWARDS[difficulty];
    const streakBonus = Math.floor(streak / 3) * STREAK_BONUS_COINS;
    return base + streakBonus;
  }

  calculateXP(difficulty: QuizDifficulty): number {
    return XP_REWARDS[difficulty];
  }

  emoji(difficulty: QuizDifficulty): string {
    return { easy: '🟢', medium: '🟡', hard: '🔴' }[difficulty];
  }

  label(difficulty: QuizDifficulty): string {
    return { easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }[difficulty];
  }
}

export const difficultyEngine = new DifficultyEngine();
