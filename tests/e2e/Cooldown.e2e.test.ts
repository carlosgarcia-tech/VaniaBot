/**
 * Cooldown.e2e.test.ts
 *
 * Cooldown real de comandos (CooldownMiddleware) sobre el bot completo:
 *
 *   Primer uso → respuesta normal. Segundo uso dentro de los 3000 ms del
 *   cooldown por defecto de Command → "⏱️ Espera Ns..." sin ejecutar el
 *   comando. Tercer uso tras forzar el reloj 4 segundos hacia adelante →
 *   respuesta normal de nuevo.
 *
 * El tercer caso usa vi.setSystemTime para saltar la ventana sin esperar
 * de verdad; el resto del pipeline sigue usando Date.now(), así que el
 * middleware ve el tiempo ya avanzado.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
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

describe('e2e: cooldown de comandos', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'segundo uso dentro del cooldown responde con la espera restante',
    async () => {
      const sender = senderJid(1);

      socket.receive(dmTextMessage('!ping', sender));
      await wait();
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);

      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      const texts = socket.texts();
      expect(texts.some(t => /^⏱️ Espera \d+s antes de usar este comando nuevamente$/.test(t))).toBe(true);
      // Solo un Pong: el segundo no ejecutó el comando
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'tras vencer el cooldown el comando vuelve a ejecutarse',
    async () => {
      const sender = senderJid(2);

      socket.receive(dmTextMessage('!ping', sender));
      await wait();
      expect(socket.texts().filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);

      socket.receive(dmTextMessage('!ping', sender));
      await wait();
      expect(socket.texts().some(t => t.startsWith('⏱️ Espera'))).toBe(true);

      // Adelantar el reloj 4s: supera el cooldown de 3000 ms del comando.
      // Solo se falsifica Date: si también se falsificara setTimeout, el
      // wait() del pipeline se congelaría y el test colgaría.
      vi.useFakeTimers({ now: Date.now() + 4_000, toFake: ['Date'] });

      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts().filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(2);
    },
    TIMEOUT,
  );
});
