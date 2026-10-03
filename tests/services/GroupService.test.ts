/**
 * GroupService.test.ts
 *
 * Unit tests for the GroupService class.
 * Tests group settings, anti-spam, anti-link, and other configurations.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupService } from '../../src/services/database/GroupService.js';
import type { IDatabase } from '../../src/services/database/Database.js';
import { createMockGroup } from '../mocks/mocks.js';

describe('GroupService', () => {
  let groupService: GroupService;
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

    groupService = new GroupService(mockDb);
  });

  describe('getGroup', () => {
    it('should create default group if not exists', async () => {
      vi.mocked(mockDb.get).mockResolvedValueOnce(null);

      const group = await groupService.getGroup('newgroup@test.com');

      expect(group.jid).toBe('newgroup@test.com');
      expect(group.isActive).toBe(true);
      expect(group.antiSpam.enabled).toBe(true);
      expect(mockDb.set).toHaveBeenCalled();
    });

    it('should return existing group', async () => {
      const existingGroup = createMockGroup({ name: 'Existing Group' });
      vi.mocked(mockDb.get).mockResolvedValueOnce(existingGroup);

      const group = await groupService.getGroup('group@test.com');

      expect(group.name).toBe('Existing Group');
    });
  });

  describe('updateGroup', () => {
    it('should update group settings', async () => {
      const group = createMockGroup();
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.updateGroup('group@test.com', { name: 'Updated Name' });

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          name: 'Updated Name',
          updatedAt: expect.any(Number),
        }),
      );
    });
  });

  describe('welcome & goodbye', () => {
    it('should set welcome message', async () => {
      const group = createMockGroup();
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.setWelcome('group@test.com', true, 'Welcome!');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          welcome: { enabled: true, message: 'Welcome!' },
        }),
      );
    });

    it('should set goodbye message', async () => {
      const group = createMockGroup();
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.setGoodbye('group@test.com', true, 'Goodbye!');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          goodbye: { enabled: true, message: 'Goodbye!' },
        }),
      );
    });
  });

  describe('anti-spam', () => {
    it('should toggle anti-spam', async () => {
      const group = createMockGroup({
        antiSpam: { enabled: true, maxMessages: 10, timeWindow: 60 },
      });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.toggleAntiSpam('group@test.com', false);

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiSpam: { enabled: false, maxMessages: 10, timeWindow: 60 },
        }),
      );
    });
  });

  describe('anti-link', () => {
    it('should toggle anti-link', async () => {
      const group = createMockGroup({ antiLink: { enabled: false, allowedDomains: [] } });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.toggleAntiLink('group@test.com', true);

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiLink: { enabled: true, allowedDomains: [] },
        }),
      );
    });

    it('should add allowed domain', async () => {
      const group = createMockGroup({
        antiLink: { enabled: true, allowedDomains: ['example.com'] },
      });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.addAllowedDomain('group@test.com', 'test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiLink: { enabled: true, allowedDomains: ['example.com', 'test.com'] },
        }),
      );
    });

    it('should remove allowed domain', async () => {
      const group = createMockGroup({
        antiLink: { enabled: true, allowedDomains: ['example.com', 'test.com'] },
      });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.removeAllowedDomain('group@test.com', 'test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiLink: { enabled: true, allowedDomains: ['example.com'] },
        }),
      );
    });
  });

  describe('anti-words', () => {
    it('should add bad word', async () => {
      const group = createMockGroup({ antiWords: { enabled: true, words: ['bad'] } });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.addBadWord('group@test.com', 'WORD');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiWords: { enabled: true, words: ['bad', 'word'] },
        }),
      );
    });

    it('should remove bad word', async () => {
      const group = createMockGroup({ antiWords: { enabled: true, words: ['bad', 'ugly'] } });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.removeBadWord('group@test.com', 'bad');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          antiWords: { enabled: true, words: ['ugly'] },
        }),
      );
    });
  });

  describe('stats', () => {
    it('should increment message count', async () => {
      const group = createMockGroup({ stats: { totalMessages: 5, totalCommands: 2 } });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.incrementMessageCount('group@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          stats: { totalMessages: 6, totalCommands: 2 },
        }),
      );
    });

    it('should increment command count', async () => {
      const group = createMockGroup({ stats: { totalMessages: 5, totalCommands: 2 } });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.incrementCommandCount('group@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({
          stats: { totalMessages: 5, totalCommands: 3 },
        }),
      );
    });
  });

  describe('admin only mode', () => {
    it('should set only admin mode', async () => {
      const group = createMockGroup({ onlyAdmin: false });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.setOnlyAdmin('group@test.com', true);

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({ onlyAdmin: true }),
      );
    });

    it('should get only admin status', async () => {
      const group = createMockGroup({ onlyAdmin: true });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      const result = await groupService.getOnlyAdmin('group@test.com');

      expect(result).toBe(true);
    });
  });

  describe('group activation', () => {
    it('should deactivate group', async () => {
      const group = createMockGroup({ isActive: true });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.deactivateGroup('group@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should activate group', async () => {
      const group = createMockGroup({ isActive: false });
      vi.mocked(mockDb.get).mockResolvedValueOnce(group);

      await groupService.activateGroup('group@test.com');

      expect(mockDb.update).toHaveBeenCalledWith(
        'groups',
        'group@test.com',
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  describe('getAllGroups & getActiveGroups', () => {
    it('should get all groups', async () => {
      const groups = [createMockGroup(), createMockGroup()];
      vi.mocked(mockDb.getAll).mockResolvedValueOnce(groups);

      const result = await groupService.getAllGroups();

      expect(result).toHaveLength(2);
    });

    it('should get active groups', async () => {
      const groups = [createMockGroup({ isActive: true }), createMockGroup({ isActive: false })];
      vi.mocked(mockDb.find).mockResolvedValueOnce([groups[0]]);

      const result = await groupService.getActiveGroups();

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });
});
