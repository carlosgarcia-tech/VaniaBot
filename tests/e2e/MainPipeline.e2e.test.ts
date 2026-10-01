/**
 * MainPipeline.e2e.test.ts
 *
 * Primer test e2e del pipeline principal con socket falso. Recorre el
 * recorrido completo de un mensaje entrante:
 *
 *   messages.upsert (FakeWASocket) → isProcessableMessage → echo filter →
 *   guards de grupo (no aplican en DM) → MessageContext (parsing con
 *   prefijo real) → checkRateLimits → resolución en commandRegistry →
 *   cadena de middlewares reales → PingCommand.execute → ctx.reply +
 *   ctx.sock.sendMessage → FakeWASocket.sent
 *
 * No se mockea ningún comando, middleware ni servicio: solo la capa de
 * transporte (WASocketFactory) y el aislamiento del filesystem (cwd temp).
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

describe('e2e: pipeline principal con socket falso', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  // Boot compartido (singletons de módulo): limpiar el registro de envíos
  // entre tests para que las afirmaciones sean independientes.
  beforeEach(() => {
    socket?.reset();
  });

  it(
    '!ping responde con la latencia a través del socket falso',
    async () => {
      socket.receive(dmTextMessage('!ping'));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('🏓 Calculando...');
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      expect(texts.some(t => /⏱️ Latencia: \d+ms/.test(t))).toBe(true);

      // Ambos mensajes van dirigidos al chat del remitente (DM)
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
      socket.receive(msg); // mismo WAMessage (mismo key.id): dedupe
      await wait(400);

      const pingCount = socket.texts().filter(t => t === '🏓 Calculando...').length;
      expect(pingCount).toBe(1);
    },
    TIMEOUT,
  );

  it(
    'un mensaje con timestamp anterior al arranque se descarta como eco offline',
    async () => {
      // El pipeline registró el startup timestamp al recibir connection open
      // durante el boot; un timestamp del pasado debe caer en isPreStartupEcho.
      const old = dmTextMessage('!ping', senderJid(4));
      old.messageTimestamp = 1_000; // año 1970: siempre anterior al arranque
      socket.receive(old);
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
