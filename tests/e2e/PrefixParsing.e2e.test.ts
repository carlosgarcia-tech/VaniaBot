/**
 * PrefixParsing.e2e.test.ts
 *
 * Recorrido completo del parsing de prefijos con el bot real:
 *
 *   messages.upsert (FakeWASocket) → matchCommandPrefix (config.prefix, '.',
 *   '!') → MessageContext.parseCommand (lowercase del nombre) → registro de
 *   comandos (nombre o alias) → middlewares → PingCommand → respuesta.
 *
 * Casos cubiertos: prefijo punto, prefijo exclamación, alias del comando,
 * normalización a minúsculas y comando desconocido (silencio, sin 404s).
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { dmTextMessage, senderJid } from './harness/fixtures.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;

/** Espera a que el pipeline (queueMicrotask + setImmediate) termine. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: parsing de prefijos y resolución de comandos', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'prefijo punto: .ping responde con la latencia',
    async () => {
      socket.receive(dmTextMessage('.ping', senderJid(1)));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('🏓 Calculando...');
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'prefijo exclamación: !ping responde con la latencia',
    async () => {
      socket.receive(dmTextMessage('!ping', senderJid(2)));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('🏓 Calculando...');
      expect(texts.some(t => /⏱️ Latencia: \d+ms/.test(t))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'alias: !latency responde como ping',
    async () => {
      socket.receive(dmTextMessage('!latency', senderJid(3)));
      await wait();

      const texts = socket.texts();
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      // Todo va dirigido al chat del remitente (DM)
      expect(socket.sent.every(m => m.jid === senderJid(3))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'el nombre del comando se normaliza a minúsculas (!PING)',
    async () => {
      socket.receive(dmTextMessage('!PING', senderJid(4)));
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'comando desconocido no produce ninguna respuesta',
    async () => {
      socket.receive(dmTextMessage('!comandoque_noexiste123', senderJid(5)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
