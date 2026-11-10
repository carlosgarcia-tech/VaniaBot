/**
 * OrbitToggleService.test.ts
 *
 * Unit tests for the consolidated orbit-toggle guard. This is the single
 * source of truth previously duplicated across MainMessagePipeline,
 * OrbitToggleMiddleware and SubBotMessageHandler:
 *
 * - isAllowedForMain: bare toggle commands pass (main executes them),
 *   slot-addressed toggles are swallowed, non-toggle messages follow the
 *   persisted per-chat state, fail-open on DB errors.
 * - isAllowedForSubbot: toggle commands always pass, non-toggle messages
 *   follow the per-slot state, fail-open on DB errors.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrbitToggleService } from '../../src/services/system/OrbitToggleService.js';

function createMockDb() {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    flush: vi.fn(async () => {}),
    keys: vi.fn(async () => [] as string[]),
  };
}

describe('OrbitToggleService guard', () => {
  let service: OrbitToggleService;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    service = new OrbitToggleService();
    service.setDatabase(db as never);
  });

  describe('isAllowedForMain', () => {
    it('passes bare toggle commands through so the main bot executes them', async () => {
      for (const cmd of ['orbiton', 'orbitoff', 'orbitstatus']) {
        await expect(service.isAllowedForMain('123@g.us', cmd, [])).resolves.toBe(true);
      }
      expect(db.get).not.toHaveBeenCalled();
    });

    it('swallows slot-addressed toggle commands (the subbot handles them)', async () => {
      await expect(service.isAllowedForMain('123@g.us', 'orbiton', ['2'])).resolves.toBe(false);
      expect(db.get).not.toHaveBeenCalled();
    });

    it('passes toggle commands with invalid slot args through (executed by main)', async () => {
      // Only VALID slots (>0) are swallowed; invalid ones behave like a
      // bare toggle — OrbitOnCommand ignores invalid slot args anyway.
      await expect(service.isAllowedForMain('123@g.us', 'orbiton', ['0'])).resolves.toBe(true);
      await expect(service.isAllowedForMain('123@g.us', 'orbitoff', ['-3'])).resolves.toBe(true);
      await expect(service.isAllowedForMain('123@g.us', 'orbiton', ['abc'])).resolves.toBe(true);
    });

    it('passes non-toggle messages when the main bot is enabled', async () => {
      db.get.mockResolvedValue({ enabled: true });
      await expect(service.isAllowedForMain('123@g.us', 'ping', [])).resolves.toBe(true);
      expect(db.get).toHaveBeenCalledWith('orbit_toggle', '123@g.us|main');
    });

    it('blocks non-toggle messages when the main bot is disabled', async () => {
      db.get.mockResolvedValue({ enabled: false });
      await expect(service.isAllowedForMain('123@g.us', 'ping', [])).resolves.toBe(false);
    });

    it('blocks non-toggle messages when no record exists (default off)', async () => {
      await expect(service.isAllowedForMain('123@g.us', 'ping', [])).resolves.toBe(false);
    });

    it('fails open when the DB errors so groups are not silenced', async () => {
      db.get.mockRejectedValue(new Error('DB down'));
      await expect(service.isAllowedForMain('123@g.us', 'ping', [])).resolves.toBe(true);
    });
  });

  describe('isAllowedForSubbot', () => {
    it('always passes toggle commands, even bare ones (filtered upstream)', async () => {
      for (const cmd of ['orbiton', 'orbitoff', 'orbitstatus']) {
        await expect(service.isAllowedForSubbot('123@g.us', 'subbot1', cmd)).resolves.toBe(true);
      }
      expect(db.get).not.toHaveBeenCalled();
    });

    it('passes non-toggle messages when the subbot slot is enabled', async () => {
      db.get.mockResolvedValue({ enabled: true });
      await expect(service.isAllowedForSubbot('123@g.us', 'subbot1', 'ping')).resolves.toBe(true);
      expect(db.get).toHaveBeenCalledWith('orbit_toggle', '123@g.us|subbot1');
    });

    it('blocks non-toggle messages when the subbot slot is disabled', async () => {
      db.get.mockResolvedValue({ enabled: false });
      await expect(service.isAllowedForSubbot('123@g.us', 'subbot1', 'ping')).resolves.toBe(false);
    });

    it('fails open when the DB errors, matching the old middleware behavior', async () => {
      db.get.mockRejectedValue(new Error('DB down'));
      await expect(service.isAllowedForSubbot('123@g.us', 'subbot1', 'ping')).resolves.toBe(true);
    });
  });
});
