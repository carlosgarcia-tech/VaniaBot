/**
 * GroupGuards.e2e.test.ts
 *
 * Guards de grupo sobre el bot real, con FakeWASocket que responde
 * groupMetadata como el harness:
 *
 *   - Grupo habilitado (se activa vía VaniaToggleService real en el setup):
 *     los comandos se ejecutan y las respuestas van al grupo.
 *   - Los prefijos alternativos funcionan igual en grupo que en DM.
 *   - Grupo nunca habilitado: el guard de vania-toggle traga el mensaje en
 *     silencio (semántica de producción: el bot está apagado en el chat
 *     hasta que un owner ejecuta !vaniaon).
 *
 * Estos tests ejercitan el tramo de guards que los tests de DM no cubren:
 * handleMutedUser → handleVaniaToggle → handleAntilink sobre ctx.chat.isGroup.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { groupTextMessage, senderJid } from './harness/fixtures.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;
const GROUP = '120363025555555555@g.us';
const OTHER_GROUP = '120363026666666666@g.us'; // nunca se habilita

/** Espera a que el pipeline (queueMicrotask + setImmediate) termine. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: guards de grupo', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());

    // El bot arranca deshabilitado en cualquier grupo (sin registro toggle).
    // Habilitamos uno de los grupos de prueba con el servicio real, igual
    // que haría !vaniaon desde el chat.
    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.vaniaToggleService.enable(GROUP, 'e2e-setup');
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un comando normal funciona en un grupo habilitado',
    async () => {
      socket.receive(groupTextMessage('!ping', GROUP, senderJid(1)));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('🏓 Calculando...');
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      // La respuesta va al grupo, no al remitente
      expect(socket.sent.every(m => m.jid === GROUP)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'los prefijos alternativos también resuelven en grupo',
    async () => {
      socket.receive(groupTextMessage('.latency', GROUP, senderJid(2)));
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'en un grupo nunca habilitado el bot responde con silencio',
    async () => {
      socket.receive(groupTextMessage('!ping', OTHER_GROUP, senderJid(3)));
      await wait();

      // El guard de vania-toggle descarta el mensaje sin responder: no hay
      // Pong ni ningún otro envío al grupo.
      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
