/**
 * Cooldown.e2e.test.ts
 *
 * Real command cooldown (CooldownMiddleware) on the full bot:
 *
 *   First use → normal response. Second use within the 3000 ms default
 *   cooldown of Command → "⏱️ Wait Ns..." without running the command. Third
 *   use after forcing the clock 4 seconds forward → normal response again.
 *
 * The third case uses vi.setSystemTime to skip the window without truly
 * waiting; the rest of the pipeline keeps using Date.now(), so the
 * middleware sees the already-advanced time.
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

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
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
      // Only one Pong: the second one didn't run the command
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

      // Moving the clock 4s ahead: past the command's 3000 ms cooldown.
      // Only Date is faked: if setTimeout were faked too, the pipeline's
      // wait() would freeze and the test would hang.
      vi.useFakeTimers({ now: Date.now() + 4_000, toFake: ['Date'] });

      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts().filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(2);
    },
    TIMEOUT,
  );
});
