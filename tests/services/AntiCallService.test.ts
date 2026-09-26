/**
 * AntiCallService.test.ts
 *
 * Unit tests for the AntiCallService config layer after its migration
 * to JsonFileStore: atomic persistence round-trips, corrupt-file
 * recovery, and validation of hand-edited config files.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AntiCallService } from '../../src/services/system/AntiCallService.js';

const CONFIG_PATH = join(process.cwd(), 'data', 'anticall.json');
const DATA_DIR = join(process.cwd(), 'data');

describe('AntiCallService config', () => {
  let service: AntiCallService;
  let backup: string | null = null;

  /**
   * The runtime uses the `antiCallService` singleton, whose in-memory
   * config survives file edits — tests must build fresh instances so
   * each one actually reads the config file from disk.
   */
  const freshService = (): AntiCallService => new AntiCallService();

  beforeAll(() => {
    // The config path is process.cwd()-relative and points at the real
    // runtime file, so back it up and restore it around the suite.
    if (existsSync(CONFIG_PATH)) {
      backup = readFileSync(CONFIG_PATH, 'utf-8');
    }
  });

  afterAll(() => {
    if (backup !== null) {
      writeFileSync(CONFIG_PATH, backup, 'utf-8');
    } else {
      rmSync(CONFIG_PATH, { force: true });
    }
  });

  beforeEach(() => {
    rmSync(CONFIG_PATH, { force: true });
    service = freshService();
  });

  it('falls back to defaults when the config file does not exist', () => {
    expect(service.isEnabled()).toBe(false);
    expect(service.getConfig()).toEqual({ enabled: false, blockedUsers: [] });
  });

  it('loads an existing valid config file', () => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ enabled: true, blockedUsers: ['123@s.whatsapp.net'] }),
      'utf-8',
    );
    const loaded = freshService();

    expect(loaded.isEnabled()).toBe(true);
    expect(loaded.getBlockedUsers()).toEqual(['123@s.whatsapp.net']);
    expect(loaded.shouldBlock('123@s.whatsapp.net')).toBe(true);
  });

  it('persists blockUser() to disk in the documented shape', () => {
    service.blockUser('123@s.whatsapp.net');

    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as unknown;
    expect(raw).toEqual({ enabled: false, blockedUsers: ['123@s.whatsapp.net'] });
  });

  it('round-trips enable/disable and block/unblock through a fresh instance', () => {
    service.enable();
    service.blockUser('a@s.whatsapp.net');
    expect(freshService().isEnabled()).toBe(true);
    expect(freshService().shouldBlock('a@s.whatsapp.net')).toBe(true);

    service.disable();
    service.unblockUser('a@s.whatsapp.net');
    const reloaded = freshService();
    expect(reloaded.isEnabled()).toBe(false);
    expect(reloaded.shouldBlock('a@s.whatsapp.net')).toBe(false);
  });

  it('ignores duplicate blockUser calls without rewriting the file', () => {
    service.blockUser('123@s.whatsapp.net');
    const afterFirst = readFileSync(CONFIG_PATH, 'utf-8');

    service.blockUser('123@s.whatsapp.net');
    const afterSecond = readFileSync(CONFIG_PATH, 'utf-8');

    expect(afterSecond).toBe(afterFirst);
  });

  it('unblockUser is a no-op for unknown users', () => {
    expect(() => service.unblockUser('ghost@s.whatsapp.net')).not.toThrow();
    expect(service.getBlockedUsers()).toEqual([]);
  });

  it('recovers with defaults when the file contains corrupt JSON', () => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, '{not valid json', 'utf-8');

    expect(() => freshService()).not.toThrow();
    expect(freshService().isEnabled()).toBe(false);
    expect(freshService().getBlockedUsers()).toEqual([]);
  });

  describe('validation of hand-edited configs', () => {
    it('coerces a non-boolean enabled flag to false', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(
        CONFIG_PATH,
        JSON.stringify({ enabled: 'on', blockedUsers: ['123@s.whatsapp.net'] }),
        'utf-8',
      );

      const loaded = freshService();
      expect(loaded.isEnabled()).toBe(false);
      expect(loaded.getBlockedUsers()).toEqual(['123@s.whatsapp.net']);
    });

    it('filters non-string entries out of blockedUsers', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(
        CONFIG_PATH,
        JSON.stringify({ enabled: true, blockedUsers: ['ok@s.whatsapp.net', 42, null, {}] }),
        'utf-8',
      );

      const loaded = freshService();
      expect(loaded.getBlockedUsers()).toEqual(['ok@s.whatsapp.net']);
    });

    it('replaces a malformed blockedUsers array with an empty list', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: true, blockedUsers: '123' }), 'utf-8');

      const loaded = freshService();
      // enabled: true is a valid boolean and survives; only the
      // non-array blockedUsers is replaced.
      expect(loaded.getConfig()).toEqual({ enabled: true, blockedUsers: [] });
    });

    it('rejects arrays and primitives as the whole config', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify(['blocked']), 'utf-8');
      expect(freshService().getConfig()).toEqual({
        enabled: false,
        blockedUsers: [],
      });

      writeFileSync(CONFIG_PATH, JSON.stringify(7), 'utf-8');
      expect(freshService().getConfig()).toEqual({
        enabled: false,
        blockedUsers: [],
      });
    });
  });

  it('leaves no temp files behind after saving', () => {
    service.enable();
    service.blockUser('123@s.whatsapp.net');
    service.unblockUser('123@s.whatsapp.net');

    const tmpFiles = existsSync(DATA_DIR)
      ? readdirSync(DATA_DIR).filter(f => f.startsWith('.anticall.json.tmp'))
      : [];
    expect(tmpFiles).toEqual([]);
  });
});
