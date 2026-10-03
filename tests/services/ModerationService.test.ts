/**
 * ModerationService.test.ts
 *
 * Unit tests for the ModerationService class.
 * Tests ban, mute, and moderation logging functionality.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModerationService,
  type BanRecord,
  type MuteRecord,
} from '../../src/services/moderation/ModerationService.js';
import type { IDatabase } from '../../src/services/database/Database.js';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockDb: IDatabase;

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

    service = new ModerationService(mockDb);
  });

  describe('Ban operations', () => {
    const groupId = 'group@test.com';
    const userId = 'user@test.com';
    const userName = 'Test User';
    const moderator = 'admin@test.com';
    const reason = 'Test ban reason';

    it('should ban a user', async () => {
      await service.banUser(groupId, userId, userName, moderator, reason);

      expect(mockDb.set).toHaveBeenCalledWith(
        'bans',
        `${groupId}:${userId}`,
        expect.objectContaining({
          userId,
          userName,
          bannedBy: moderator,
          reason,
          groupId,
        }),
      );
    });

    it('should check if user is banned', async () => {
      const banRecord: BanRecord = {
        userId,
        userName,
        bannedBy: moderator,
        reason,
        timestamp: Date.now(),
        groupId,
      };

      vi.mocked(mockDb.get).mockResolvedValueOnce(banRecord);

      const result = await service.isBanned(groupId, userId);

      expect(result).toBe(true);
    });

    it('should return false for non-banned user', async () => {
      vi.mocked(mockDb.get).mockResolvedValueOnce(null);

      const result = await service.isBanned(groupId, userId);

      expect(result).toBe(false);
    });

    it('should unban a user', async () => {
      const banRecord: BanRecord = {
        userId,
        userName,
        bannedBy: moderator,
        reason,
        timestamp: Date.now(),
        groupId,
      };

      vi.mocked(mockDb.get).mockResolvedValueOnce(banRecord);
      vi.mocked(mockDb.delete).mockResolvedValueOnce(true);

      const result = await service.unbanUser(groupId, userId);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith('bans', `${groupId}:${userId}`);
    });
  });

  describe('Mute operations', () => {
    const groupId = 'group@test.com';
    const userId = 'user@test.com';
    const userName = 'Test User';
    const moderator = 'admin@test.com';
    const reason = 'Test mute reason';
    const duration = 60 * 60 * 1000; 

    it('should mute a user', async () => {
      await service.muteUser(groupId, userId, userName, moderator, reason, duration);

      expect(mockDb.set).toHaveBeenCalledWith(
        'mutes',
        `${groupId}:${userId}`,
        expect.objectContaining({
          userId,
          userName,
          mutedBy: moderator,
          reason,
          duration,
          groupId,
        }),
      );
    });

    it('should check if user is muted', async () => {
      const futureExpiry = Date.now() + duration;
      const muteRecord: MuteRecord = {
        userId,
        userName,
        mutedBy: moderator,
        reason,
        timestamp: Date.now(),
        duration,
        expiresAt: futureExpiry,
        groupId,
      };

      vi.mocked(mockDb.get).mockResolvedValueOnce(muteRecord);

      const result = await service.isMuted(groupId, userId);

      expect(result).toBe(true);
    });

    it('should return false for expired mute', async () => {
      const pastExpiry = Date.now() - 1000;
      const muteRecord: MuteRecord = {
        userId,
        userName,
        mutedBy: moderator,
        reason,
        timestamp: Date.now() - duration,
        duration,
        expiresAt: pastExpiry,
        groupId,
      };

      vi.mocked(mockDb.get).mockResolvedValueOnce(muteRecord);
      vi.mocked(mockDb.delete).mockResolvedValueOnce(true);

      const result = await service.isMuted(groupId, userId);

      expect(result).toBe(false);
    });

    it('should calculate remaining mute time', async () => {
      const remainingTime = 30 * 60 * 1000;
      const futureExpiry = Date.now() + remainingTime;
      const muteRecord: MuteRecord = {
        userId,
        userName,
        mutedBy: moderator,
        reason,
        timestamp: Date.now(),
        duration,
        expiresAt: futureExpiry,
        groupId,
      };

      vi.mocked(mockDb.get).mockResolvedValueOnce(muteRecord);

      const remaining = await service.getMuteTimeRemaining(groupId, userId);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(remainingTime);
    });
  });

  describe('Moderation logs', () => {
    it('should log moderation actions', async () => {
      const action = {
        userId: 'user@test.com',
        userName: 'Test User',
        action: 'ban' as const,
        reason: 'Test reason',
        moderator: 'admin@test.com',
        timestamp: Date.now(),
      };

      await service.logAction(action);

      expect(mockDb.set).toHaveBeenCalledWith('moderation_logs', expect.any(String), action);
    });

    it('should get user history', async () => {
      const logs = [
        {
          userId: 'user@test.com',
          userName: 'Test User',
          action: 'ban' as const,
          reason: 'Reason 1',
          moderator: 'admin@test.com',
          timestamp: Date.now(),
        },
        {
          userId: 'user@test.com',
          userName: 'Test User',
          action: 'mute' as const,
          reason: 'Reason 2',
          moderator: 'admin@test.com',
          timestamp: Date.now() - 1000,
        },
      ];

      vi.mocked(mockDb.getPaginated).mockResolvedValueOnce({
        items: logs,
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const history = await service.getUserHistory('user@test.com');

      expect(history).toHaveLength(2);
    });
  });
});
