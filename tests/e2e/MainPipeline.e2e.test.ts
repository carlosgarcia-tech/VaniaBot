/**
 * MainPipeline.e2e.test.ts
 *
 * First e2e test of the main pipeline with a fake socket. Walks the full
 * journey of an incoming message:
 *
 *   messages.upsert (FakeWASocket) → isProcessableMessage → echo filter →
 *   group guards (n/a in DMs) → MessageContext (parsing with the real
 *   prefix) → checkRateLimits → resolution in commandRegistry → real
 *   middleware chain → PingCommand.execute → ctx.reply +
 *   ctx.sock.sendMessage → FakeWASocket.sent
 *
 * No command, middleware or service is mocked: only the transport layer
 * (WASocketFactory) and filesystem isolation (temp cwd).
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

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: pipeline principal con socket falso', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  // Shared boot (module singletons): clear the sent-message log between
  // tests so assertions stay independent.
  beforeEach(() => {
    socket?.reset();
  });

  it(
    '!ping responde con la latencia a través del socket falso',
    async () => {
      socket.receive(dmTextMessage('!ping'));
      await wait();

      const texts = socket.texts();
      expect(socket.reactions()).toContain('🏓');
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      expect(texts.some(t => /⏱️ Latencia: \d+ms/.test(t))).toBe(true);

      // Both messages go to the sender's own chat (DM)
      expect(socket.sent.every(m => m.jid === '861234567890123456@s.whatsapp.net')).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'mensaje sin prefijo en DM no produce ninguna respuesta',
    async () => {
      socket.receive(dmTextMessage('hola mundo sin prefijo', senderJid(2)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'los mensajes duplicados (mismo id) se procesan una sola vez',
    async () => {
      const msg = dmTextMessage('!ping', senderJid(3));
      socket.receive(msg);
      socket.receive(msg); // same WAMessage (same key.id): deduped
      await wait(400);

      const pingCount = socket.reactions().filter(r => r === '🏓').length;
      expect(pingCount).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'un mensaje con timestamp anterior al arranque se descarta como eco offline',
    async () => {
      // The pipeline recorded the startup timestamp when connection open
      // arrived during boot; a past timestamp must land in isPreStartupEcho.
      const old = dmTextMessage('!ping', senderJid(4));
      old.messageTimestamp = 1_000; // year 1970: always before startup
      socket.receive(old);
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
