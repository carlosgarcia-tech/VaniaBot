/**
 * AntiArabService.test.ts
 *
 * Unit tests for the anti-arab moderation service: per-group enable/disable,
 * default prefix list, prefix add/remove, number blocking by prefix match
 * across enabled groups and prefix aggregation.
 *
 * JsonFileStore is mocked in-memory to avoid touching real database files.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mock state -----------------------------------------------------

const { backing } = vi.hoisted(() => ({
  backing: new Map<string, unknown>(),
}));

// --- Module mocks -----------------------------------------------------------

vi.mock('../../../src/utils/JsonFileStore.js', () => ({
  JsonFileStore: class {
    key: string;
    defaults: () => unknown;
    constructor(options: { filePath: string; defaults: () => unknown }) {
      this.key = options.filePath;
      this.defaults = options.defaults;
      if (!backing.has(this.key)) backing.set(this.key, this.defaults());
    }
    load(): unknown {
      if (!backing.has(this.key)) backing.set(this.key, this.defaults());
      return JSON.parse(JSON.stringify(backing.get(this.key)));
    }
    save(store: unknown): void {
      backing.set(this.key, JSON.parse(JSON.stringify(store)));
    }
  },
}));

vi.mock('../../../src/services/PermissionService.js', () => ({
  normalizeJid: (jid: string) => jid.split('@')[0]?.replace(/:\d+$/, '') ?? jid,
}));

// --- Imports under test (after mocks) ---------------------------------------

import { AntiArabService } from '../../../src/services/moderation/AntiArabService.js';

const GROUP = '1203630@g.us';

// --- Tests -----------------------------------------------------------------

describe('AntiArabService', () => {
  let service: AntiArabService;

  beforeEach(() => {
    backing.clear();
    service = new AntiArabService();
  });

  it('configuración por defecto: desactivado y con la lista de prefijos estándar', () => {
    const config = service.getGroupConfig(GROUP);

    expect(config.enabled).toBe(false);
    // Prefijos del Magreb y Medio Oriente según la política por defecto
    expect(config.prefixes).toContain('212');
    expect(config.prefixes).toContain('213');
    expect(config.prefixes).toContain('20');
    expect(config.prefixes).toContain('971');
    expect(config.prefixes.length).toBeGreaterThanOrEqual(16);
  });

  it('enable/disable cambia el estado por grupo', () => {
    expect(service.isEnabled(GROUP)).toBe(false);

    service.enableGroup(GROUP);
    expect(service.isEnabled(GROUP)).toBe(true);

    service.disableGroup(GROUP);
    expect(service.isEnabled(GROUP)).toBe(false);
  });

  it('shouldBlockNumber ignora grupos desactivados', () => {
    service.enableGroup(GROUP);
    service.disableGroup(GROUP);

    expect(service.shouldBlockNumber('212555123456')).toBe(false);
  });

  it('shouldBlockNumber bloquea números que empiezan con un prefijo configurado', () => {
    service.enableGroup(GROUP);

    expect(service.shouldBlockNumber('212555123456')).toBe(true);
    expect(service.shouldBlockNumber('+212 555 123 456')).toBe(true);
    expect(service.shouldBlockNumber('9647812345678')).toBe(true);

    // Prefijos no configurados
    expect(service.shouldBlockNumber('5215512345678')).toBe(false);
    expect(service.shouldBlockNumber('15551234567')).toBe(false);
  });

  it('addPrefix añade prefijos nuevos normalizados a solo dígitos', () => {
    // El '+' se elimina: shouldBlockNumber compara contra números sin '+'
    service.addPrefix(GROUP, '+91');

    expect(service.getGroupConfig(GROUP).prefixes).toContain('91');
    expect(service.getGroupConfig(GROUP).prefixes).not.toContain('+91');

    service.enableGroup(GROUP);
    expect(service.shouldBlockNumber('919876543210')).toBe(true);
  });

  it('addPrefix no duplica prefijos existentes', () => {
    const before = service.getGroupConfig(GROUP).prefixes.length;
    service.addPrefix(GROUP, '212');
    expect(service.getGroupConfig(GROUP).prefixes.length).toBe(before);
  });

  it('removePrefix elimina solo si existe y devuelve el resultado', () => {
    expect(service.removePrefix(GROUP, '212')).toBe(true);
    expect(service.getGroupConfig(GROUP).prefixes).not.toContain('212');
    expect(service.removePrefix(GROUP, '212')).toBe(false);
  });

  it('getBlockedPrefixesForNumber agrega prefijos coincidentes sin duplicar entre grupos', () => {
    service.enableGroup(GROUP);
    service.addPrefix(GROUP, '34');

    const second = 'otro@g.us';
    service.enableGroup(second);
    service.addPrefix(second, '212'); // también coincide con el default
    service.addPrefix(second, '34');

    const blocked = service.getBlockedPrefixesForNumber('212555123456');

    expect(blocked).toContain('212');
    expect(blocked.filter(p => p === '212')).toHaveLength(1);
  });

  it('getBlockedPrefixesForNumber devuelve vacío si nada coincide o no hay grupos activos', () => {
    expect(service.getBlockedPrefixesForNumber('212555')).toEqual([]);

    service.enableGroup(GROUP);
    expect(service.getBlockedPrefixesForNumber('521555')).toEqual([]);
  });

  it('mantiene configuraciones independientes por grupo', () => {
    const groupA = '111@g.us';
    const groupB = '222@g.us';

    service.enableGroup(groupA);
    service.removePrefix(groupA, '212');

    expect(service.isEnabled(groupA)).toBe(true);
    expect(service.isEnabled(groupB)).toBe(false);
    expect(service.getGroupConfig(groupA).prefixes).not.toContain('212');
    expect(service.getGroupConfig(groupB).prefixes).toContain('212');
  });
});
