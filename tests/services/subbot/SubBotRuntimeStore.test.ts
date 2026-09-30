/**
 * SubBotRuntimeStore.test.ts
 *
 * Unit tests for the subbot runtime state persistence: load/save round
 * trip with Maps, TTL enforcement on load, id mismatch rejection,
 * corrupt/truncated files, non-object JSON, malformed Map entries
 * (dropped, not fatal), expired-entry pruning on load and on save,
 * atomic write (no .tmp leftovers), invalid bot ids, explicit dir
 * override and delete().
 *
 * Real fs against a temp dir — no data/ files are touched.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SubBotRuntimeStore } from '../../../src/services/subbot/SubBotRuntimeStore.js';
import { SUBBOT_CONFIG } from '../../../src/config/subbot.js';
import type { BotRuntimeState } from '../../../src/types/subbot.js';

const NOW = Date.parse('2026-09-27T12:00:00Z');

function freshState(botId: string): BotRuntimeState {
  return {
    id: botId,
    recentMessageIds: new Map(),
    contactNameCache: new Map(),
    lastProfileAppliedAt: 0,
    lastProfileSignature: '',
  };
}

describe('SubBotRuntimeStore', () => {
  let dir: string;
  let store: SubBotRuntimeStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    dir = join(tmpdir(), `vania-runtime-store-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    store = new SubBotRuntimeStore(dir);
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it('load devuelve null cuando el archivo no existe', () => {
    expect(store.load('bot1')).toBeNull();
  });

  it('save/load hace round-trip de los Maps y campos escalares', () => {
    const state = freshState('bot1');
    state.recentMessageIds.set('g@g.us|u@s.whatsapp.net|m1', NOW - 1000);
    state.contactNameCache.set('u@s.whatsapp.net', { name: 'Ulises', cachedAt: NOW - 2000 });
    state.lastProfileAppliedAt = NOW - 3000;
    state.lastProfileSignature = 'sig-1';
    state.pairingPendingAt = NOW - 4000;

    store.save(state);
    const loaded = store.load('bot1');

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('bot1');
    expect(loaded!.recentMessageIds.get('g@g.us|u@s.whatsapp.net|m1')).toBe(NOW - 1000);
    expect(loaded!.contactNameCache.get('u@s.whatsapp.net')).toEqual({
      name: 'Ulises',
      cachedAt: NOW - 2000,
    });
    expect(loaded!.lastProfileAppliedAt).toBe(NOW - 3000);
    expect(loaded!.lastProfileSignature).toBe('sig-1');
    expect(loaded!.pairingPendingAt).toBe(NOW - 4000);
  });

  it('save es atomico: no deja archivos .tmp', () => {
    store.save(freshState('bot1'));

    const leftovers = readdirSync(dir).filter(f => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    expect(existsSync(join(dir, 'bot1.json'))).toBe(true);
  });

  it('load rechaza estados con TTL vencido', () => {
    const state = freshState('bot1');
    store.save(state);

    // TTL de runtime: 2 minutos. Avanza 3.
    vi.advanceTimersByTime(SUBBOT_CONFIG.BOT_RUNTIME_STATE_TTL_MS + 60_000);

    expect(store.load('bot1')).toBeNull();
  });

  it('load acepta estados justo dentro del TTL', () => {
    store.save(freshState('bot1'));
    vi.advanceTimersByTime(SUBBOT_CONFIG.BOT_RUNTIME_STATE_TTL_MS - 1000);

    expect(store.load('bot1')).not.toBeNull();
  });

  it('load rechaza archivos cuyo id no coincide con el bot pedido', () => {
    store.save(freshState('bot1'));

    // El archivo bot1.json contiene el id de otro bot (copiado/renombrado)
    const raw = JSON.parse(readFileSync(join(dir, 'bot1.json'), 'utf-8')) as Record<string, unknown>;
    raw.id = 'otro-bot';
    writeFileSync(join(dir, 'bot1.json'), JSON.stringify(raw), 'utf-8');

    expect(store.load('bot1')).toBeNull();
  });

  it('load devuelve null ante JSON corrupto o no-objeto', () => {
    writeFileSync(join(dir, 'bot1.json'), '{no soy json', 'utf-8');
    expect(store.load('bot1')).toBeNull();

    writeFileSync(join(dir, 'bot2.json'), JSON.stringify([1, 2, 3]), 'utf-8');
    expect(store.load('bot2')).toBeNull();

    writeFileSync(join(dir, 'bot3.json'), JSON.stringify('hola'), 'utf-8');
    expect(store.load('bot3')).toBeNull();
  });

  it('entradas malformadas de recentMessageIds se descartan sin romper la carga', () => {
    writeFileSync(
      join(dir, 'bot1.json'),
      JSON.stringify({
        id: 'bot1',
        updatedAt: NOW,
        recentMessageIds: [
          ['k1', NOW - 1000], // válido
          ['k2', 'no-soy-numero'], // timestamp inválido
          ['k3', Number.NaN], // NaN se serializa a null → inválido
          [null, NOW - 1000], // key inválida
          ['k4'], // par incompleto
          'no-soy-array',
        ],
      }),
      'utf-8',
    );

    const loaded = store.load('bot1');
    expect(loaded).not.toBeNull();
    expect([...loaded!.recentMessageIds.keys()]).toEqual(['k1']);
  });

  it('entradas malformadas de contactNameCache se descartan sin romper la carga', () => {
    writeFileSync(
      join(dir, 'bot1.json'),
      JSON.stringify({
        id: 'bot1',
        updatedAt: NOW,
        contactNameCache: [
          ['a@x', { name: 'A', cachedAt: NOW - 1000 }], // válido
          ['b@x', { cachedAt: NOW - 1000 }], // sin nombre
          ['c@x', { name: 42, cachedAt: NOW - 1000 }], // nombre no-string
          ['d@x', 'no-soy-objeto'],
          ['e@x'], // incompleto
        ],
      }),
      'utf-8',
    );

    const loaded = store.load('bot1');
    expect(loaded).not.toBeNull();
    expect([...loaded!.contactNameCache.keys()]).toEqual(['a@x']);
  });

  it('las entradas vencidas se podan en carga (dedup y contactos)', () => {
    writeFileSync(
      join(dir, 'bot1.json'),
      JSON.stringify({
        id: 'bot1',
        updatedAt: NOW,
        recentMessageIds: [
          ['fresco', NOW - 1000],
          ['vencido', NOW - (SUBBOT_CONFIG.MESSAGE_DEDUP_TTL_MS + 1000)],
        ],
        contactNameCache: [
          ['vivo@x', { name: 'V', cachedAt: NOW - 1000 }],
          ['muerto@x', { name: 'M', cachedAt: NOW - (SUBBOT_CONFIG.CONTACT_CACHE_TTL_MS + 1000) }],
        ],
      }),
      'utf-8',
    );

    const loaded = store.load('bot1');
    expect([...loaded!.recentMessageIds.keys()]).toEqual(['fresco']);
    expect([...loaded!.contactNameCache.keys()]).toEqual(['vivo@x']);
  });

  it('save poda las entradas vencidas del estado en memoria antes de escribir', () => {
    const state = freshState('bot1');
    state.recentMessageIds.set('fresco', NOW - 1000);
    state.recentMessageIds.set('vencido', NOW - (SUBBOT_CONFIG.MESSAGE_DEDUP_TTL_MS + 1000));
    state.contactNameCache.set('vivo@x', { name: 'V', cachedAt: NOW - 1000 });
    state.contactNameCache.set('muerto@x', {
      name: 'M',
      cachedAt: NOW - (SUBBOT_CONFIG.CONTACT_CACHE_TTL_MS + 1000),
    });

    store.save(state);

    const raw = JSON.parse(readFileSync(join(dir, 'bot1.json'), 'utf-8')) as {
      recentMessageIds: [string, number][];
      contactNameCache: unknown[];
    };
    expect(raw.recentMessageIds.map(([k]) => k)).toEqual(['fresco']);
    expect(raw.contactNameCache.map(e => (e as [string])[0])).toEqual(['vivo@x']);
  });

  it('campos escalares inválidos caen a defaults sanos', () => {
    writeFileSync(
      join(dir, 'bot1.json'),
      JSON.stringify({
        id: 'bot1',
        updatedAt: NOW,
        lastProfileAppliedAt: 'no-soy-numero',
        lastProfileSignature: 123,
        pairingPendingAt: -5,
      }),
      'utf-8',
    );

    const loaded = store.load('bot1');
    expect(loaded!.lastProfileAppliedAt).toBe(0);
    expect(loaded!.lastProfileSignature).toBe('');
    expect(loaded!.pairingPendingAt).toBeUndefined();
  });

  it('botId con caracteres de path lanza/ignora en vez de salirse del dir', () => {
    expect(store.load('../escape')).toBeNull();

    const state = freshState('otro-bot');
    state.id = '../escape';
    store.save(state); // no debe crear archivos fuera del dir

    expect(readdirSync(dir)).toEqual([]);
  });

  it('delete borra el archivo y es tolerante a archivos inexistentes', () => {
    store.save(freshState('bot1'));
    expect(existsSync(join(dir, 'bot1.json'))).toBe(true);

    store.delete('bot1');
    expect(existsSync(join(dir, 'bot1.json'))).toBe(false);

    expect(() => store.delete('nunca-existio')).not.toThrow();
  });

  it('ensureDir crea el directorio si no existe', () => {
    const nested = join(dir, 'a', 'b');
    const nestedStore = new SubBotRuntimeStore(nested);
    nestedStore.ensureDir();

    expect(existsSync(nested)).toBe(true);
  });

  it('save falla en silencio (best-effort) si el dir no se puede crear', () => {
    // Un "archivo" donde debería estar el dir padre: mkdir falla
    const blockingFile = join(dir, 'bloqueo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(blockingFile, 'x', 'utf-8');

    const brokenStore = new SubBotRuntimeStore(join(blockingFile, 'imposible'));
    expect(() => brokenStore.save(freshState('bot1'))).not.toThrow();
  });

  it('sin override usa SUBBOT_CONFIG.RUNTIME_STATE_DIR dinámicamente', () => {
    const dynStore = new SubBotRuntimeStore();

    const original = SUBBOT_CONFIG.RUNTIME_STATE_DIR;
    (SUBBOT_CONFIG as { RUNTIME_STATE_DIR: string }).RUNTIME_STATE_DIR = dir;
    try {
      dynStore.save(freshState('dinamico'));
      expect(existsSync(join(dir, 'dinamico.json'))).toBe(true);
      expect(dynStore.load('dinamico')).not.toBeNull();
    } finally {
      (SUBBOT_CONFIG as { RUNTIME_STATE_DIR: string }).RUNTIME_STATE_DIR = original;
    }
  });
});
