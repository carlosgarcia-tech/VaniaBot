/**
 * AntilinkService.test.ts
 *
 * Unit tests for the antilink moderation service: per-group enable/disable,
 * link extraction and classification (WhatsApp groups / channels / other),
 * whitelist matching with subdomains, kick vs delete mode and the
 * getBlockedLinkInfo contract used by the pipeline.
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

import { AntilinkService } from '../../../src/services/moderation/AntilinkService.js';

const GROUP = '1203630@g.us';

// --- Tests -----------------------------------------------------------------

describe('AntilinkService', () => {
  let service: AntilinkService;

  beforeEach(() => {
    backing.clear();
    service = new AntilinkService();
  });

  it('configuración por defecto: desactivado, modo kick, todos los bloques activos', () => {
    const config = service.getConfig(GROUP);

    expect(config).toEqual({
      enabled: false,
      mode: 'kick',
      blockWhatsappGroups: true,
      blockWhatsappChannels: true,
      blockOtherLinks: true,
      whitelist: [],
    });
  });

  it('enable/disable cambia el estado persistido por grupo', () => {
    expect(service.isEnabled(GROUP)).toBe(false);

    service.enable(GROUP);
    expect(service.isEnabled(GROUP)).toBe(true);

    service.disable(GROUP);
    expect(service.isEnabled(GROUP)).toBe(false);
  });

  it('checkMessage ignora mensajes cuando está desactivado', () => {
    const result = service.checkMessage(GROUP, 'entra https://chat.whatsapp.com/AbCdEf');
    expect(result).toBeNull();
  });

  it('checkMessage detecta enlaces de grupo de WhatsApp', () => {
    service.enable(GROUP);

    const link = service.checkMessage(GROUP, 'únete https://chat.whatsapp.com/AbC123 ya');
    expect(link).not.toBeNull();
    expect(link?.type).toBe('wa_group');
    expect(link?.domain).toContain('chat.whatsapp.com');
  });

  it('checkMessage detecta enlaces de canal y otros dominios', () => {
    service.enable(GROUP);

    const channel = service.checkMessage(GROUP, 'mira https://whatsapp.com/channel/001234');
    expect(channel?.type).toBe('wa_channel');

    const other = service.checkMessage(GROUP, 'visita www.ejemplo.com/oferta');
    expect(other?.type).toBe('other');
    expect(other?.domain).toBe('ejemplo.com');
  });

  it('checkMessage devuelve null para texto sin enlaces', () => {
    service.enable(GROUP);
    expect(service.checkMessage(GROUP, 'hola a todos, ¿cómo están?')).toBeNull();
  });

  it('la whitelist permite dominios y subdominios permitidos', () => {
    service.enable(GROUP);
    expect(service.addToWhitelist(GROUP, 'https://www.Ejemplo.com/docs')).toBe(true);

    // Deduplicado (normalizado)
    expect(service.addToWhitelist(GROUP, 'ejemplo.com')).toBe(false);
    expect(service.getWhitelist(GROUP)).toEqual(['ejemplo.com']);

    expect(service.checkMessage(GROUP, 'va https://ejemplo.com/pagina')).toBeNull();
    // Subdominio permitido vía endsWith('.ejemplo.com')
    expect(service.checkMessage(GROUP, 'va https://docs.ejemplo.com/pagina')).toBeNull();
    // Otro dominio sigue bloqueado
    expect(service.checkMessage(GROUP, 'va https://otro.com')).not.toBeNull();
  });

  it('removeFromWhitelist devuelve true/false según exista el dominio', () => {
    service.addToWhitelist(GROUP, 'ejemplo.com');

    expect(service.removeFromWhitelist(GROUP, 'noexiste.com')).toBe(false);
    expect(service.removeFromWhitelist(GROUP, 'EJEMPLO.com')).toBe(true);
    expect(service.getWhitelist(GROUP)).toEqual([]);
  });

  it('setMode cambia la acción entre kick y delete', () => {
    service.setMode(GROUP, 'delete');
    expect(service.getConfig(GROUP).mode).toBe('delete');

    service.setMode(GROUP, 'kick');
    expect(service.getConfig(GROUP).mode).toBe('kick');
  });

  it('setBlockType permite desactivar el bloqueo por tipo de enlace', () => {
    service.enable(GROUP);
    service.setBlockType(GROUP, 'others', false);

    expect(service.checkMessage(GROUP, 'va https://ejemplo.com')).toBeNull();
    // Los grupos de WhatsApp siguen bloqueados
    expect(service.checkMessage(GROUP, 'va https://chat.whatsapp.com/XyZ')).not.toBeNull();
  });

  it('getBlockedLinkInfo devuelve el contrato completo del pipeline', () => {
    service.enable(GROUP);
    service.setMode(GROUP, 'delete');

    const blocked = service.getBlockedLinkInfo(GROUP, 'link https://chat.whatsapp.com/abc');
    expect(blocked.blocked).toBe(true);
    expect(blocked.action).toBe('delete');
    expect(blocked.link?.type).toBe('wa_group');

    const clean = service.getBlockedLinkInfo(GROUP, 'sin enlaces');
    expect(clean).toEqual({ blocked: false, link: null, action: 'delete' });
  });

  it('mantiene configuraciones independientes por grupo', () => {
    const groupA = '111@g.us';
    const groupB = '222@g.us';

    service.enable(groupA);

    expect(service.isEnabled(groupA)).toBe(true);
    expect(service.isEnabled(groupB)).toBe(false);
    expect(service.checkMessage(groupA, 'https://chat.whatsapp.com/x')).not.toBeNull();
    expect(service.checkMessage(groupB, 'https://chat.whatsapp.com/x')).toBeNull();
  });
});
