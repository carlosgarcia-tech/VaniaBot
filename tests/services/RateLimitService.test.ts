/**
 * RateLimitService.test.ts
 *
 * Unit tests for the RateLimitService class.
 * Tests rate limiting, flood protection, and whitelist management.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/config/index', () => ({
  config: {
    rateLimit: {
      maxMessagesPerGroup: 30,
      windowMs: 60000,
      whitelistGroups: [],
      whitelistUsers: [],
      floodMaxPerSecond: 3,
      floodWindowMs: 1000,
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { RateLimitService } from '../../src/services/system/RateLimitService';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    vi.resetModules();
    service = new RateLimitService();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const stats = service.getStats();
      expect(stats.trackedGroups).toBe(0);
      expect(stats.trackedUsers).toBe(0);
      expect(stats.whitelistGroups).toBe(0);
      expect(stats.whitelistUsers).toBe(0);
    });
  });

  describe('checkGroupRateLimit', () => {
    it('should allow messages within limit', () => {
      const result = service.checkGroupRateLimit('group@test.g.us');
      expect(result.allowed).toBe(true);
    });

    it('should block when exceeding limit', () => {
      const groupJid = 'group@test.g.us';

      for (let i = 0; i < 35; i++) {
        service.checkGroupRateLimit(groupJid);
      }

      const result = service.checkGroupRateLimit(groupJid);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should allow whitelisted groups', () => {
      service.addGroupToWhitelist('premium@test.g.us');
      const result = service.checkGroupRateLimit('premium@test.g.us');
      expect(result.allowed).toBe(true);
    });

    it('should show wait time when blocked', () => {
      const groupJid = 'group@test.g.us';

      for (let i = 0; i < 35; i++) {
        service.checkGroupRateLimit(groupJid);
      }

      const result = service.checkGroupRateLimit(groupJid);
      expect(result.waitTime).toBeGreaterThan(0);
    });
  });

  describe('checkFlood', () => {
    it('should allow messages within flood limit', () => {
      const result = service.checkFlood('user@test.com');
      expect(result.allowed).toBe(true);
    });

    it('should block when flooding', () => {
      const userJid = 'user@test.com';

      for (let i = 0; i < 12; i++) {
        service.checkFlood(userJid);
      }

      const result = service.checkFlood(userJid);
      expect(result.allowed).toBe(false);
    });

    it('should allow whitelisted users', () => {
      service.addUserToWhitelist('vip@test.com');
      const result = service.checkFlood('vip@test.com');
      expect(result.allowed).toBe(true);
    });
  });

  describe('whitelist management', () => {
    it('should add group to whitelist', () => {
      service.addGroupToWhitelist('premium@g.us');
      expect(service.isGroupWhitelisted('premium@g.us')).toBe(true);
    });

    it('should remove group from whitelist', () => {
      service.addGroupToWhitelist('premium@g.us');
      service.removeGroupFromWhitelist('premium@g.us');
      expect(service.isGroupWhitelisted('premium@g.us')).toBe(false);
    });

    it('should add user to whitelist', () => {
      service.addUserToWhitelist('vip@s.whatsapp.net');
      expect(service.isUserWhitelisted('vip@s.whatsapp.net')).toBe(true);
    });

    it('should remove user from whitelist', () => {
      service.addUserToWhitelist('vip@s.whatsapp.net');
      service.removeUserFromWhitelist('vip@s.whatsapp.net');
      expect(service.isUserWhitelisted('vip@s.whatsapp.net')).toBe(false);
    });

    it('should check group whitelist correctly', () => {
      service.addGroupToWhitelist('premium@g.us');
      expect(service.isGroupWhitelisted('other@g.us')).toBe(false);
      expect(service.isGroupWhitelisted('premium@g.us')).toBe(true);
    });

    it('should match whitelist entries exactly, not by substring', () => {
      service.addGroupToWhitelist('1203630@g.us');
      // A different JID that merely CONTAINS the whitelisted entry must not
      // be whitelisted (regression: the old implementation used includes()).
      expect(service.isGroupWhitelisted('1203630999999@g.us')).toBe(false);
      expect(service.isUserWhitelisted('1203630@g.us')).toBe(false);
    });
  });

  describe('flood warning throttling', () => {
    it('warns at most once per 5s window while a flood persists', () => {
      const userJid = 'flooder@test.com';

      const results = [];
      for (let i = 0; i < 12; i++) {
        results.push(service.checkFlood(userJid));
      }

      const warnings = results.filter(r => !r.allowed && r.reason !== undefined);
      const blocked = results.filter(r => !r.allowed);

      expect(blocked.length).toBeGreaterThan(0);
      expect(warnings).toHaveLength(1);
    });
  });

  describe('group stats', () => {
    it('should return zero for unknown group', () => {
      const stats = service.getGroupStats('unknown@g.us');
      expect(stats.messageCount).toBe(0);
      expect(stats.warnings).toBe(0);
    });

    it('should track message count', () => {
      const groupJid = 'test@g.us';
      service.checkGroupRateLimit(groupJid);
      service.checkGroupRateLimit(groupJid);
      service.checkGroupRateLimit(groupJid);

      const stats = service.getGroupStats(groupJid);
      expect(stats.messageCount).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset group stats', () => {
      const groupJid = 'test@g.us';
      service.checkGroupRateLimit(groupJid);
      service.resetGroup(groupJid);

      const stats = service.getGroupStats(groupJid);
      expect(stats.messageCount).toBe(0);
    });

    it('should reset user stats', () => {
      const userJid = 'user@test.com';
      service.checkFlood(userJid);
      service.resetUser(userJid);

      const result = service.checkFlood(userJid);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return stats with whitelist counts', () => {
      const stats = service.getStats();
      expect(typeof stats.trackedGroups).toBe('number');
      expect(typeof stats.trackedUsers).toBe('number');
      expect(typeof stats.whitelistGroups).toBe('number');
      expect(typeof stats.whitelistUsers).toBe('number');
    });
  });
});
