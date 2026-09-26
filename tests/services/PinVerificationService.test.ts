/**
 * PinVerificationService.test.ts
 *
 * Unit tests for PinVerificationService: the create → verify round-trip,
 * the command whitelist gate (buildPendingCommandContext) and the pending
 * verification helpers. redisCache is mocked so no Redis is needed.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PinVerificationService } from '../../src/services/system/PinVerificationService.js';

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();

vi.mock('../../src/services/system/RedisCacheService.js', () => ({
  redisCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
    delete: (...args: unknown[]) => mockCacheDelete(...args),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PinVerificationService', () => {
  let service: PinVerificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = PinVerificationService.getInstance();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDelete.mockResolvedValue(undefined);
  });

  describe('buildPendingCommandContext (whitelist gate)', () => {
    it('accepts whitelisted commands and splits args', () => {
      const ctx = service.buildPendingCommandContext('exec', 'ls -la /tmp');

      expect(ctx).toEqual({ command: 'exec', args: ['ls', '-la', '/tmp'] });
    });

    it('normalizes the command to lowercase', () => {
      const ctx = service.buildPendingCommandContext('EXEC', 'whoami');

      expect(ctx?.command).toBe('exec');
    });

    it('drops empty args from the split', () => {
      const ctx = service.buildPendingCommandContext('eval', '  2  +   2 ');

      expect(ctx?.args).toEqual(['2', '+', '2']);
    });

    it('returns null for commands outside the whitelist', () => {
      expect(service.buildPendingCommandContext('ban', '@user')).toBeNull();
      expect(service.buildPendingCommandContext('help', '')).toBeNull();
      expect(service.buildPendingCommandContext('promote', '@user')).toBeNull();
    });

    it('returns null for a case variant of a non-whitelisted command', () => {
      expect(service.buildPendingCommandContext('EVALX', '')).toBeNull();
    });
  });

  describe('create → verify round-trip', () => {
    it('stores the pending verification and returns the pin', async () => {
      const pin = await service.createPendingVerification('owner@s.whatsapp.net', 'exec', 'ls');

      expect(pin).toMatch(/^\d{6}$/);
      expect(mockCacheSet).toHaveBeenCalledWith(
        'pin:owner@s.whatsapp.net',
        expect.objectContaining({ command: 'exec', args: 'ls', pin }),
        60,
      );
    });

    it('verifies a valid pin and returns the stored command', async () => {
      mockCacheGet.mockResolvedValue({
        command: 'grant',
        args: 'money @user 100',
        pin: '654321',
        createdAt: Date.now(),
      });

      const result = await service.verifyPin('owner@s.whatsapp.net', '654321');

      expect(result).toEqual({
        valid: true,
        command: 'grant',
        args: 'money @user 100',
      });
      // Consumed after a successful verification.
      expect(mockCacheDelete).toHaveBeenCalledWith('pin:owner@s.whatsapp.net');
    });

    it('rejects an invalid pin without consuming the pending verification', async () => {
      mockCacheGet.mockResolvedValue({
        command: 'exec',
        args: 'ls',
        pin: '111111',
        createdAt: Date.now(),
      });

      const result = await service.verifyPin('owner@s.whatsapp.net', '222222');

      expect(result.valid).toBe(false);
      expect(mockCacheDelete).not.toHaveBeenCalled();
    });

    it('reports invalid when there is no pending verification (expired)', async () => {
      mockCacheGet.mockResolvedValue(null);

      const result = await service.verifyPin('owner@s.whatsapp.net', '123456');

      expect(result.valid).toBe(false);
    });

    it('hasPendingVerification reflects the cache state', async () => {
      mockCacheGet.mockResolvedValue({ command: 'exec', args: '', pin: '1' });

      await expect(service.hasPendingVerification('owner@s.whatsapp.net')).resolves.toBe(true);

      mockCacheGet.mockResolvedValue(null);
      await expect(service.hasPendingVerification('owner@s.whatsapp.net')).resolves.toBe(false);
    });
  });
});
