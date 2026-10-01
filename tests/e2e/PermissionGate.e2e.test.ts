/**
 * PermissionGate.e2e.test.ts
 *
 * Puerta de permisos a través del bot real: un comando OWNER-only
 * (MetricsCommand) ejecutado por un usuario cualquiera debe recibir la
 * denegación del PermissionMiddleware, sin ejecutar nunca el comando.
 *
 * La denegación ocurre en la cadena de middlewares (después de la
 * resolución en el registro), así que este test demuestra que el e2e
 * llega hasta PermissionMiddleware — no solo hasta la ejecución feliz.
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

describe('e2e: puerta de permisos', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un usuario normal recibe la denegación al usar un comando OWNER-only',
    async () => {
      socket.receive(dmTextMessage('!metrics', senderJid(1)));
      await wait();

      const texts = socket.texts();
      expect(texts).toContain('❌ No tienes permiso para usar este comando');
      // El comando nunca llegó a ejecutarse: sin reacción de métricas
      expect(socket.sent.some(m => (m.content as { text?: string }).text?.includes('Métricas de VaniaBot'))).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'el alias de un comando OWNER-only pasa por la misma puerta',
    async () => {
      socket.receive(dmTextMessage('!botstats', senderJid(2)));
      await wait();

      expect(socket.texts()).toContain('❌ No tienes permiso para usar este comando');
    },
    TIMEOUT,
  );
});
