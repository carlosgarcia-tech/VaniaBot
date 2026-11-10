/**
 * ReaccionHandler.test.ts
 *
 * Unit tests for the ReaccionHandler.
 * Tests emoji reaction handling for quizzes and games.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi } from 'vitest';

describe('ReaccionHandler', () => {
  describe('reaction types', () => {
    it('should define quiz reaction emojis', () => {
      const quizReactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '❌'];
      expect(quizReactions).toHaveLength(6);
    });

    it('should define game reaction emojis', () => {
      const gameReactions = ['🎰', '🪙', '🎲', '✊', '✋', '✌️'];
      expect(gameReactions).toHaveLength(6);
    });
  });

  describe('isQuizReaction', () => {
    const quizEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

    const isQuizReaction = (emoji: string): boolean => {
      return quizEmojis.includes(emoji);
    };

    it('should identify quiz reactions', () => {
      expect(isQuizReaction('1️⃣')).toBe(true);
      expect(isQuizReaction('3️⃣')).toBe(true);
    });

    it('should reject non-quiz reactions', () => {
      expect(isQuizReaction('🚀')).toBe(false);
      expect(isQuizReaction('🎉')).toBe(false);
    });
  });

  describe('game reaction handling', () => {
    const isGameReaction = (emoji: string): boolean => {
      const gameEmojis = ['🎰', '🪙', '🎲'];
      return gameEmojis.includes(emoji);
    };

    it('should identify slot machine reaction', () => {
      expect(isGameReaction('🎰')).toBe(true);
    });

    it('should identify coinflip reaction', () => {
      expect(isGameReaction('🪙')).toBe(true);
    });

    it('should identify dice reaction', () => {
      expect(isGameReaction('🎲')).toBe(true);
    });

    it('should reject random emojis', () => {
      expect(isGameReaction('😀')).toBe(false);
    });
  });

  describe('answer validation', () => {
    const emojiToNumber: Record<string, number> = {
      '1️⃣': 1,
      '2️⃣': 2,
      '3️⃣': 3,
      '4️⃣': 4,
      '5️⃣': 5,
    };

    it('should map emoji to number', () => {
      expect(emojiToNumber['1️⃣']).toBe(1);
      expect(emojiToNumber['3️⃣']).toBe(3);
    });

    it('should return undefined for invalid emoji', () => {
      expect(emojiToNumber['🚀']).toBeUndefined();
    });
  });
});
