/**
 * AntiDeleteService.test.ts
 *
 * Unit tests for the AntiDeleteService config layer after the migration
 * to JsonFileStore: atomic persistence, corrupt-file recovery, and
 * validation of hand-edited config files.
 *
 * The config path and tmp dir are injected per-instance, so every test
 * runs against its own temp directory — the real data/ files and the
 * runtime tmp/antidelete dir are never touched.
 *
 * Media storage (storeMessage/getMessage) is intentionally not covered
 * here — it depends on Baileys' downloadContentFromMessage streams.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AntiDeleteService } from '../../src/services/system/AntiDeleteService.js';

describe('AntiDeleteService config', () => {
  let service: AntiDeleteService;
  let dataDir: string;
  let configPath: string;
  let tmpDir: string;

  beforeEach(() => {
    // Rutas inyectadas: aisladas del data/ y tmp/ reales del bot.
    dataDir = join(tmpdir(), `vania-antidelete-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    configPath = join(dataDir, 'antidelete.json');
    tmpDir = join(dataDir, 'media-tmp');
    service = new AntiDeleteService(configPath, tmpDir);
  });

  afterEach(() => {
    service.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  /** Creates an instance against the same injected paths. */
  const freshService = (): AntiDeleteService => new AntiDeleteService(configPath, tmpDir);

  it('falls back to defaults when the config file does not exist', () => {
    expect(service.isEnabled()).toBe(false);
    expect(service.getConfig()).toEqual({ enabled: false, groups: {} });
  });

  it('loads an existing valid config file', () => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      configPath,
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

    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as unknown;
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
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(configPath, '{not valid json', 'utf-8');

    expect(() => freshService()).not.toThrow();
    expect(freshService().isEnabled()).toBe(false);
  });

  describe('validation of hand-edited configs', () => {
    it('coerces a non-boolean enabled flag to false', () => {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({ enabled: 'yes', groups: { '123@g.us': true } }),
        'utf-8',
      );
      const loaded = freshService();

      expect(loaded.isEnabled()).toBe(false);
      expect(loaded.getConfig().groups['123@g.us']).toBe(true);
    });

    it('drops group entries whose value is not a boolean', () => {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(
        configPath,
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
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify({ enabled: true, groups: ['a@g.us'] }), 'utf-8');
      const loaded = freshService();

      expect(loaded.getConfig()).toEqual({ enabled: true, groups: {} });
    });

    it('rejects arrays and primitives as the whole config', () => {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(['enabled']), 'utf-8');
      expect(freshService().getConfig()).toEqual({ enabled: false, groups: {} });

      writeFileSync(configPath, JSON.stringify('on'), 'utf-8');
      expect(freshService().getConfig()).toEqual({ enabled: false, groups: {} });
    });
  });

  it('leaves no temp files behind after saving', () => {
    service.enable();
    service.disable('123@g.us');
    service.enable('123@g.us');

    const tmpFiles = existsSync(dataDir)
      ? readdirSync(dataDir).filter(f => f.startsWith('.antidelete.json.tmp'))
      : [];
    expect(tmpFiles).toEqual([]);
    expect(existsSync(configPath)).toBe(true);
  });

  it('creates the injected media tmp dir on construction', () => {
    expect(existsSync(tmpDir)).toBe(true);
  });

  it('stop() clears the message store and can be called twice', () => {
    expect(() => {
      service.stop();
      service.stop();
    }).not.toThrow();
  });

  it('el cleanup timer elimina mensajes con mas de 24h', async () => {
    vi.useFakeTimers();
    try {
      // La instancia debe construirse YA con fake timers para que el
      // interval del cleanup sea controlable.
      service = freshService();
      service.enable(); // el default es disabled: sin esto no almacena

      const sock = {} as never;
      const message = {
        key: { id: 'msg-1', remoteJid: 'g@g.us', participant: 'u@s.whatsapp.net' },
        pushName: 'U',
        message: { conversation: 'hola' },
      } as never;
      await service.storeMessage(sock, message);
      expect(service.getMessage('msg-1')).toBeDefined();

      // El interval corre cada hora; 25h después el mensaje expiró.
      await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000);
      expect(service.getMessage('msg-1')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
