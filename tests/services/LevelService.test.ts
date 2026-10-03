/**
 * LevelService.test.ts
 *
 * Unit tests for the LevelService class.
 * Tests XP, levels, and leaderboard functionality.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LevelService, type LevelUpResult } from '../../src/services/database/LevelService.js';
import type { IDatabase } from '../../src/services/database/Database.js';
import type { UserService, User } from '../../src/services/database/UserService.js';

describe('LevelService', () => {
  let levelService: LevelService;
  let mockDb: IDatabase;
  let mockUserService: UserService & {
    getUser: ReturnType<typeof vi.fn>;
    addXP: ReturnType<typeof vi.fn>;
    getRequiredXPForNextLevel: ReturnType<typeof vi.fn>;
    getTopByLevel: ReturnType<typeof vi.fn>;
  };

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    jid: 'test@test.com',
    name: 'Test User',
    isOwner: false,
    isBanned: false,
    level: 1,
    xp: 0,
    money: 0,
    bank: 0,
    lastDaily: undefined,
    lastWeekly: undefined,
    lastMonthly: undefined,
    weeklyStreak: 0,
    totalCommands: 0,
    warnings: 0,
    inventory: [],
    achievements: [],
    stats: {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 10,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    },
    pets: [],
    activeQuests: [],
    completedQuests: [],
    activeBuffs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    mockDb = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
      has: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      keys: vi.fn().mockResolvedValue([]),
      getPaginated: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      }),
      count: vi.fn().mockResolvedValue(0),
      clear: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn().mockResolvedValue(undefined),
    };

    mockUserService = {
      ...{
        getUser: vi.fn(),
        addXP: vi.fn(),
        getRequiredXPForNextLevel: vi.fn().mockImplementation((level: number) => level ** 2 * 100),
        getTopByLevel: vi.fn().mockResolvedValue([]),
      },
    } as any;

    levelService = new LevelService(mockDb, mockUserService as UserService);
  });

  describe('getRequiredXP', () => {
    it('should return required XP for next level', () => {
      vi.mocked(mockUserService.getRequiredXPForNextLevel).mockReturnValue(400);

      const result = levelService.getRequiredXP(2);

      expect(result).toBe(400);
      expect(mockUserService.getRequiredXPForNextLevel).toHaveBeenCalledWith(2);
    });
  });

  describe('addXP', () => {
    it('should add XP and return level up result', async () => {
      const user = createMockUser({ xp: 50, level: 1 });
      vi.mocked(mockUserService.getUser).mockResolvedValue(user);
      vi.mocked(mockUserService.addXP).mockResolvedValue({ ...user, xp: 150, level: 2 });

      const result = await levelService.addXP('test@test.com', 100);

      expect(result.leveledUp).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(result.xpGained).toBe(100);
      expect(result.totalXP).toBe(150);
    });

    it('should not level up if XP is insufficient', async () => {
      const user = createMockUser({ xp: 0, level: 1 });
      vi.mocked(mockUserService.getUser).mockResolvedValue(user);
      vi.mocked(mockUserService.addXP).mockResolvedValue({ ...user, xp: 50, level: 1 });

      const result = await levelService.addXP('test@test.com', 50);

      expect(result.leveledUp).toBe(false);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(1);
    });
  });

  describe('giveRandomXP', () => {
    it('should give random XP within range', async () => {
      const user = createMockUser({ xp: 0, level: 1 });
      vi.mocked(mockUserService.getUser).mockResolvedValue(user);
      vi.mocked(mockUserService.addXP).mockResolvedValue({ ...user, xp: 20, level: 1 });

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await levelService.giveRandomXP('test@test.com', 10, 25);

      expect(result.xpGained).toBeGreaterThanOrEqual(10);
      expect(result.xpGained).toBeLessThanOrEqual(25);
    });
  });

  describe('getLevelProgress', () => {
    it('should calculate level progress correctly', async () => {
      const user = createMockUser({ xp: 150, level: 2 });
      vi.mocked(mockUserService.getRequiredXPForNextLevel).mockImplementation((level: number) => {
        return level ** 2 * 100;
      });
      vi.mocked(mockUserService.getUser).mockResolvedValue(user);

      const result = await levelService.getLevelProgress('test@test.com');

      expect(result.level).toBe(2);
      expect(result.currentXP).toBe(50);
      expect(result.requiredXP).toBe(300);
      expect(result.percentage).toBeGreaterThan(0);
    });
  });

  describe('getLeaderboard', () => {
    it('should return ranked leaderboard', async () => {
      const users = [
        createMockUser({ jid: 'user1@test.com', name: 'User 1', level: 10, xp: 1000 }),
        createMockUser({ jid: 'user2@test.com', name: 'User 2', level: 5, xp: 500 }),
        createMockUser({ jid: 'user3@test.com', name: 'User 3', level: 8, xp: 800 }),
      ];
      vi.mocked(mockUserService.getTopByLevel).mockResolvedValue(users);

      const result = await levelService.getLeaderboard(10);

      expect(result).toHaveLength(3);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });
  });

  describe('formatLevelUpMessage', () => {
    it('should format level up message', () => {
      const result: LevelUpResult = {
        leveledUp: true,
        oldLevel: 5,
        newLevel: 6,
        xpGained: 100,
        totalXP: 600,
        nextLevelXP: 3600,
      };

      const message = levelService.formatLevelUpMessage(result, 'TestUser');

      expect(message).toContain('TestUser');
      expect(message).toContain('5');
      expect(message).toContain('6');
      expect(message).toContain('100');
      expect(message).toContain('600');
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar', () => {
      const bar = levelService.createProgressBar(50, 100, 10);

      expect(bar).toBe('█████░░░░░');
    });

    it('should handle 0 progress', () => {
      const bar = levelService.createProgressBar(0, 100, 10);

      expect(bar).toBe('░░░░░░░░░░');
    });

    it('should handle full progress', () => {
      const bar = levelService.createProgressBar(100, 100, 10);

      expect(bar).toBe('██████████');
    });

    it('should cap at full progress', () => {
      const bar = levelService.createProgressBar(150, 100, 10);

      expect(bar).toBe('██████████');
    });
  });
});
