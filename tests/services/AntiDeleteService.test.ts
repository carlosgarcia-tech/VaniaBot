/**
 * AntiDeleteService.test.ts
 *
 * Unit tests for the AntiDeleteService config layer after the migration
 * to JsonFileStore: atomic persistence, corrupt-file recovery, and
 * validation of hand-edited config files.
 *
 * Media storage (storeMessage/getMessage) is intentionally not covered
 * here — it depends on Baileys' downloadContentFromMessage streams.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AntiDeleteService } from '../../src/services/system/AntiDeleteService.js';

const CONFIG_PATH = join(process.cwd(), 'data', 'antidelete.json');
const DATA_DIR = join(process.cwd(), 'data');

describe('AntiDeleteService config', () => {
  let service: AntiDeleteService;
  let backup: string | null = null;

  /** Creates an instance without leaking its hourly cleanup interval. */
  const freshService = (): AntiDeleteService => {
    const intervalSpy = vi
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(undefined as unknown as NodeJS.Timeout);
    const instance = new AntiDeleteService();
    intervalSpy.mockRestore();
    return instance;
  };

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
    expect(service.getConfig()).toEqual({ enabled: false, groups: {} });
  });

  it('loads an existing valid config file', () => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ enabled: true, groups: { '123@g.us': true } }),
      'utf-8',
    );
    const loaded = freshService();

    expect(loaded.isEnabled()).toBe(true);
    expect(loaded.isEnabled('123@g.us')).toBe(true);
    // Groups without an explicit entry inherit the global switch.
    expect(loaded.isEnabled('999@g.us')).toBe(true);
  });

  it('persists enable() to disk in the documented shape', () => {
    service.enable('123@g.us');

    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as unknown;
    expect(raw).toEqual({ enabled: false, groups: { '123@g.us': true } });
  });

  it('round-trips enable/disable through a fresh instance', () => {
    service.enable();
    expect(freshService().isEnabled()).toBe(true);

    service.disable('123@g.us');
    const reloaded = freshService();
    expect(reloaded.isEnabled('123@g.us')).toBe(false);
    expect(reloaded.isEnabled('other@g.us')).toBe(true);
  });

  it('recovers with defaults when the file contains corrupt JSON', () => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, '{not valid json', 'utf-8');

    expect(() => freshService()).not.toThrow();
    expect(freshService().isEnabled()).toBe(false);
  });

  describe('validation of hand-edited configs', () => {
    it('coerces a non-boolean enabled flag to false', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(
        CONFIG_PATH,
        JSON.stringify({ enabled: 'yes', groups: { '123@g.us': true } }),
        'utf-8',
      );
      const loaded = freshService();

      expect(loaded.isEnabled()).toBe(false);
      expect(loaded.getConfig().groups['123@g.us']).toBe(true);
    });

    it('drops group entries whose value is not a boolean', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(
        CONFIG_PATH,
        JSON.stringify({
          enabled: true,
          groups: { 'a@g.us': true, 'b@g.us': 'false', 'c@g.us': 1 },
        }),
        'utf-8',
      );
      const loaded = freshService();

      expect(loaded.getConfig().groups).toEqual({ 'a@g.us': true });
      expect(loaded.isEnabled('a@g.us')).toBe(true);
      expect(loaded.isEnabled('b@g.us')).toBe(true); // treated as unlisted
    });

    it('replaces a malformed groups object with an empty map', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: true, groups: ['a@g.us'] }), 'utf-8');
      const loaded = freshService();

      expect(loaded.getConfig()).toEqual({ enabled: true, groups: {} });
    });

    it('rejects arrays and primitives as the whole config', () => {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(CONFIG_PATH, JSON.stringify(['enabled']), 'utf-8');
      expect(freshService().getConfig()).toEqual({ enabled: false, groups: {} });

      writeFileSync(CONFIG_PATH, JSON.stringify('on'), 'utf-8');
      expect(freshService().getConfig()).toEqual({ enabled: false, groups: {} });
    });
  });

  it('leaves no temp files behind after saving', () => {
    service.enable();
    service.disable('123@g.us');
    service.enable('123@g.us');

    const tmpFiles = existsSync(DATA_DIR)
      ? readdirSync(DATA_DIR).filter(f => f.startsWith('.antidelete.json.tmp'))
      : [];
    expect(tmpFiles).toEqual([]);
  });
});
