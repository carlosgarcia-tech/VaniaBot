/**
 * CacheManager.test.ts
 *
 * Unit tests for the UnifiedCacheManager class.
 * Tests caching functionality for permissions, users, groups, and messages.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedCacheManager, type CachedUser } from '../../src/core/CacheManager.js';
import type { BotPermissions, UserPermissions } from '../../src/services/PermissionService.js';

describe('UnifiedCacheManager', () => {
  let cache: UnifiedCacheManager;

  beforeEach(() => {
    cache = new UnifiedCacheManager();
  });

  describe('Permissions cache', () => {
    const groupJid = 'group@test.com';
    const userJid = 'user@test.com';

    it('should store and retrieve bot permissions', () => {
      const permissions: BotPermissions = { isAdmin: false, isSuperAdmin: false };

      cache.setPermissions(groupJid, userJid, permissions);
      const result = cache.getPermissions(groupJid, userJid);

      expect(result).toEqual(permissions);
    });

    it('should store and retrieve user permissions', () => {
      const permissions: UserPermissions = { isOwner: false, isAdmin: false, isSuperAdmin: false };

      cache.setPermissions(groupJid, userJid, permissions);
      const result = cache.getPermissions(groupJid, userJid);

      expect(result).toEqual(permissions);
    });

    it('should return null for non-existent permissions', () => {
      const result = cache.getPermissions('nonexistent@group.com', 'nonexistent@user.com');

      expect(result).toBeNull();
    });

    it('should invalidate permissions for specific group', () => {
      const permissions: BotPermissions = { isAdmin: false, isSuperAdmin: false };
      cache.setPermissions(groupJid, userJid, permissions);

      cache.invalidatePermissions(groupJid);

      const result = cache.getPermissions(groupJid, userJid);
      expect(result).toBeNull();
    });
  });

  describe('User cache', () => {
    const userJid = 'user@test.com';

    it('should store and retrieve users', () => {
      const user: CachedUser = {
        jid: userJid,
        name: 'Test User',
        level: 1,
        xp: 100,
        money: 500,
      };

      cache.setUser(userJid, user);
      const result = cache.getUser(userJid);

      expect(result).toEqual(user);
    });

    it('should return null for non-existent user', () => {
      const result = cache.getUser('nonexistent@user.com');

      expect(result).toBeNull();
    });

    it('should invalidate user cache', () => {
      const user: CachedUser = {
        jid: userJid,
        name: 'Test User',
        level: 1,
        xp: 100,
        money: 500,
      };

      cache.setUser(userJid, user);
      cache.invalidateUser(userJid);

      const result = cache.getUser(userJid);
      expect(result).toBeNull();
    });
  });

  describe('Group metadata cache', () => {
    const groupJid = 'group@test.com';

    it('should store and retrieve group metadata', () => {
      const metadata = {
        id: groupJid,
        subject: 'Test Group',
        participants: [],
      } as any;

      cache.setGroupMetadata(groupJid, metadata);
      const result = cache.getGroupMetadata(groupJid);

      expect(result).toEqual(metadata);
    });

    it('should return null for non-existent group', () => {
      const result = cache.getGroupMetadata('nonexistent@group.com');

      expect(result).toBeNull();
    });

    it('should invalidate group metadata', () => {
      const metadata = {
        id: groupJid,
        subject: 'Test Group',
        participants: [] as any[],
      } as any;

      cache.setGroupMetadata(groupJid, metadata);
      cache.invalidateGroupMetadata(groupJid);

      const result = cache.getGroupMetadata(groupJid);
      expect(result).toBeNull();
    });
  });

  describe('Message deduplication', () => {
    it('should mark message as processed', () => {
      const messageId = 'msg_123';

      cache.markMessageProcessed(messageId);

      expect(cache.hasProcessedMessage(messageId)).toBe(true);
    });

    it('should return false for non-processed message', () => {
      const result = cache.hasProcessedMessage('nonexistent_msg');

      expect(result).toBe(false);
    });
  });

  describe('Stats', () => {
    it('should track cache statistics', () => {
      const permissions: BotPermissions = { isAdmin: false, isSuperAdmin: false };
      cache.setPermissions('group@test.com', 'user@test.com', permissions);
      cache.getPermissions('group@test.com', 'user@test.com');
      cache.getPermissions('nonexistent@group.com', 'nonexistent@user.com');

      const stats = cache.getStats();

      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeDefined();
    });
  });

  describe('Clear all', () => {
    it('should clear all caches', () => {
      const permissions: BotPermissions = { isAdmin: false, isSuperAdmin: false };
      cache.setPermissions('group@test.com', 'user@test.com', permissions);
      cache.setUser('user@test.com', {
        jid: 'user@test.com',
        name: 'Test',
        level: 1,
        xp: 0,
        money: 0,
      });
      cache.markMessageProcessed('msg_123');

      cache.clear();

      expect(cache.getPermissions('group@test.com', 'user@test.com')).toBeNull();
      expect(cache.getUser('user@test.com')).toBeNull();
      expect(cache.hasProcessedMessage('msg_123')).toBe(false);
    });
  });
});
