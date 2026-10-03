/**
 * UserService.test.ts
 *
 * Unit tests for the UserService class.
 * Tests user management, economy, inventory, and achievements.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService, type User } from '../../src/services/database/UserService.js';
import type { IDatabase } from '../../src/services/database/Database.js';

vi.mock('@/config/index.js', () => ({
  config: {
    owners: ['owner@test.com'],
  },
}));

describe('UserService', () => {
  let userService: UserService;
  let mockDb: IDatabase;

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

    userService = new UserService(mockDb);
  });

  describe('getUser', () => {
    it('should create new user if not exists', async () => {
      vi.mocked(mockDb.get).mockResolvedValueOnce(null);
      vi.mocked(mockDb.set).mockResolvedValueOnce(undefined);

      const user = await userService.getUser('new@test.com');

      expect(user.jid).toBe('new@test.com');
      expect(user.name).toBe('User');
      expect(user.level).toBe(1);
      expect(user.xp).toBe(0);
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should return existing user', async () => {
      const existingUser = createMockUser({ name: 'Existing User' });
      vi.mocked(mockDb.get).mockResolvedValueOnce(existingUser);

      const user = await userService.getUser('test@test.com');

      expect(user.name).toBe('Existing User');
    });

    it('should handle owner from config', async () => {
      const user = await userService.getUser('owner@test.com');

      expect(user.isOwner).toBe(true);
      expect(user.level).toBe(999);
    });
  });

  describe('addXP', () => {
    it('should add XP and calculate level', async () => {
      const user = createMockUser({ xp: 0, level: 1 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      const result = await userService.addXP('test@test.com', 100);

      expect(result.xp).toBe(100);
      expect(result.level).toBeGreaterThanOrEqual(1);
    });

    it('should not add XP to owner', async () => {
      const ownerUser = createMockUser({ isOwner: true, xp: 999999, level: 999 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(ownerUser);

      const result = await userService.addXP('owner@test.com', 100);

      expect(result.xp).toBe(999999);
    });
  });

  describe('addMoney', () => {
    it('should add money to user', async () => {
      const user = createMockUser({ money: 100 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      await userService.addMoney('test@test.com', 50);

      expect(mockDb.update).toHaveBeenCalledWith(
        'users',
        'test@test.com',
        expect.objectContaining({ money: 150 }),
      );
    });
  });

  describe('removeMoney', () => {
    it('should remove money successfully', async () => {
      const user = createMockUser({ money: 100 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      const result = await userService.removeMoney('test@test.com', 50);

      expect(result).toBe(true);
    });

    it('should fail if insufficient funds', async () => {
      const user = createMockUser({ money: 30 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);

      const result = await userService.removeMoney('test@test.com', 50);

      expect(result).toBe(false);
    });
  });

  describe('banUser', () => {
    it('should ban user', async () => {
      const user = createMockUser();
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      await userService.banUser('test@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'users',
        'test@test.com',
        expect.objectContaining({ isBanned: true }),
      );
    });

    it('should not ban owner', async () => {
      const ownerUser = createMockUser({ isOwner: true });

      await expect(userService.banUser('owner@test.com')).rejects.toThrow();
    });
  });

  describe('unbanUser', () => {
    it('should unban user and reset warnings', async () => {
      const user = createMockUser({ isBanned: true, warnings: 2 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      await userService.unbanUser('test@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'users',
        'test@test.com',
        expect.objectContaining({ isBanned: false, warnings: 0 }),
      );
    });
  });

  describe('addWarning', () => {
    it('should add warning', async () => {
      const user = createMockUser({ warnings: 0 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      const warnings = await userService.addWarning('test@test.com');

      expect(warnings).toBe(1);
    });

    it('should ban after 3 warnings', async () => {
      const user = createMockUser({ warnings: 2 });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      const warnings = await userService.addWarning('test@test.com');

      expect(warnings).toBe(3);
    });
  });

  describe('inventory', () => {
    it('should add item to inventory', async () => {
      const user = createMockUser({ inventory: [] });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      await userService.addItem('test@test.com', 'sword');

      expect(mockDb.update).toHaveBeenCalledWith(
        'users',
        'test@test.com',
        expect.objectContaining({
          inventory: expect.arrayContaining([expect.objectContaining({ itemId: 'sword' })]),
        }),
      );
    });

    it('should not add duplicate items', async () => {
      const user = createMockUser({
        inventory: [{ itemId: 'sword', name: 'sword', type: 'weapon', rarity: 'common', quantity: 1, stats: {}, purchasedAt: Date.now() }],
      });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);

      await userService.addItem('test@test.com', 'sword');

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should check if user has item', async () => {
      const user = createMockUser({
        inventory: [{ itemId: 'sword', name: 'sword', type: 'weapon', rarity: 'common', quantity: 1, stats: {}, purchasedAt: Date.now() }],
      });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);

      const hasItem = await userService.hasItem('test@test.com', 'sword');

      expect(hasItem).toBe(true);
    });
  });

  describe('achievements', () => {
    it('should add achievement', async () => {
      const user = createMockUser({ achievements: [] });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);
      vi.mocked(mockDb.update).mockResolvedValueOnce(undefined);

      const result = await userService.addAchievement('test@test.com', 'first_win');

      expect(result).toBe(true);
    });

    it('should not add duplicate achievement', async () => {
      const user = createMockUser({ achievements: ['first_win'] });
      vi.mocked(mockDb.get).mockResolvedValueOnce(user);

      const result = await userService.addAchievement('test@test.com', 'first_win');

      expect(result).toBe(false);
    });
  });

  describe('top users', () => {
    it('should get top by XP', async () => {
      const users = [
        createMockUser({ xp: 1000 }),
        createMockUser({ xp: 500 }),
        createMockUser({ xp: 800, isOwner: true }),
      ];
      vi.mocked(mockDb.getPaginated).mockResolvedValueOnce({
        items: users,
        total: 3,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const top = await userService.getTopByXP(10);

      expect(top).toHaveLength(2);
      expect(top[0].xp).toBe(1000);
    });

    it('should get top by money', async () => {
      const users = [
        createMockUser({ money: 1000 }),
        createMockUser({ money: 500 }),
        createMockUser({ money: 800, isOwner: true }),
      ];
      vi.mocked(mockDb.getPaginated).mockResolvedValueOnce({
        items: users,
        total: 3,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const top = await userService.getTopByMoney(10);

      expect(top).toHaveLength(2);
      expect(top[0].money).toBe(1000);
    });

    it('should get top by level', async () => {
      const users = [
        createMockUser({ level: 10 }),
        createMockUser({ level: 5 }),
        createMockUser({ level: 8, isOwner: true }),
      ];
      vi.mocked(mockDb.getPaginated).mockResolvedValueOnce({
        items: users,
        total: 3,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const top = await userService.getTopByLevel(10);

      expect(top).toHaveLength(2);
      expect(top[0].level).toBe(10);
    });
  });

  describe('daily/weekly/monthly claims', () => {
    it('should allow daily claim', () => {
      const user = createMockUser({ lastDaily: undefined });

      expect(userService.canClaimDaily(user)).toBe(true);
    });

    it('should not allow daily claim if recent', () => {
      const user = createMockUser({ lastDaily: Date.now() });

      expect(userService.canClaimDaily(user)).toBe(false);
    });

    it('should allow owners to claim anytime', () => {
      const user = createMockUser({ lastDaily: Date.now(), isOwner: true });

      expect(userService.canClaimDaily(user)).toBe(true);
    });

    it('should calculate daily time remaining', () => {
      const user = createMockUser({ lastDaily: Date.now() - 12 * 60 * 60 * 1000 });

      const remaining = userService.getDailyTimeRemaining(user);

      expect(remaining).toBeGreaterThan(0);
    });
  });
});
