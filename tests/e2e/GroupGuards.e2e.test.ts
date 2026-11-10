/**
 * GroupGuards.e2e.test.ts
 *
 * Group guards against the real bot, with a FakeWASocket that answers
 * groupMetadata like the harness does:
 *
 *   - Enabled group (activated via the real OrbitToggleService in setup):
 *     commands execute and replies go to the group.
 *   - Alternative prefixes work the same in groups as in DMs.
 *   - Never-enabled group: the orbit-toggle guard swallows the message
 *     silently (production semantics: the bot is off in that chat until an
 *     owner runs !orbiton).
 *
 * These tests exercise the guard stretch the DM tests don't cover:
 * handleMutedUser → handleOrbitToggle → handleAntilink on ctx.chat.isGroup.
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
const OTHER_GROUP = '120363026666666666@g.us'; // never enabled

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: guards de grupo', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());

    // The bot starts disabled in every group (no toggle record).
    // We enable one of the test groups with the real service, exactly as
    // !orbiton would from the chat.
    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.orbitToggleService.enable(GROUP, 'e2e-setup');
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
      expect(socket.reactions()).toContain('🏓');
      expect(texts.some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      // The reply goes to the group, not the sender
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

      // The orbit-toggle guard drops the message without replying: no
      // Pong or any other send to the group.
      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
