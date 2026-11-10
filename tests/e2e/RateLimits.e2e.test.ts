/**
 * RateLimits.e2e.test.ts
 *
 * Pipeline rate limits (MainMessagePipeline.checkRateLimits) with the real bot
 * and the real anti-spam services:
 *
 *   - AntiSpamService: 3 messages/second and 20 per minute (with a 5-minute
 *     ban) in both DMs and groups.
 *   - RateLimitService.checkFlood: 3/second per user (groups only).
 *   - RateLimitService.checkGroupRateLimit: 30 per minute with escalation
 *     from warnings to blocking the whole group.
 *
 * Two execution-order details that these tests respect:
 *
 *   1. checkRateLimits runs AFTER runGuards. In groups, commandless chatter
 *      is swallowed by handleGroupConversation, so the rate limits only ever
 *      apply to commands.
 *   2. AntiSpamService is consulted before RateLimitService.checkFlood and
 *      both share the 3/second threshold: the per-second cut is always
 *      reported by AntiSpamService, and checkFlood is covered by its own
 *      unit test (tests/services/RateLimitService.test.ts).
 *
 * Each test uses a distinct group because the load counter is per group and
 * lives for the entire process boot. For per-minute counters the clock is
 * advanced with vi.setSystemTime (toFake: ['Date']): without it, the
 * per-second limit would cut first, before the per-minute one.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { dmTextMessage, groupMessageFrom, senderJid } from './harness/fixtures.js';
import { clearParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;

const FAST_WRITE = '⚠️ Estás escribiendo muy rápido';
const BAN_WARNING = '⚠️ Demasiados mensajes. Bloqueado temporalmente.';
const BAN_BLOCK = '⛔ Bloqueado temporalmente por spam';
const GROUP_BUSY = '⚠️ El grupo está enviando muchos mensajes. Reduce la velocidad.';
const GROUP_SLOWER = '⚠️ Demasiados mensajes del grupo';
const GROUP_BLOCKED = '⛔ Grupo bloqueado temporalmente por spam';

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends a command every ~1.2 s of wall clock (under the per-second limit,
 * inside the one-minute window) and returns the texts sent.
 */
async function sendSpaced(
  socket: BootState['socket'],
  send: (i: number) => void,
  count: number,
): Promise<string[]> {
  vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
  for (let i = 0; i < count; i++) {
    vi.setSystemTime(Date.now() + 1_200);
    send(i);
    await wait(120);
  }
  return socket.texts();
}

describe('e2e: límites de tasa del pipeline', () => {
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
    'en DM el cuarto mensaje del mismo segundo se bloquea por escritura rápida',
    async () => {
      const sender = senderJid(1);

      for (let i = 0; i < 4; i++) socket.receive(dmTextMessage('!ping', sender));
      await wait(500);

      const texts = socket.texts();
      // The limit is 3 per second: only the fourth message gets cut.
      expect(texts.filter(t => t === FAST_WRITE)).toHaveLength(1);
      // The cut happens before the middleware chain: a single Pong.
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'tras un segundo de silencio el remitente puede volver a escribir',
    async () => {
      const sender = senderJid(2);

      for (let i = 0; i < 4; i++) socket.receive(dmTextMessage('!ping', sender));
      await wait(500);
      expect(socket.texts().filter(t => t === FAST_WRITE)).toHaveLength(1);

      // 4 s ahead: past both the per-second window and the cooldown.
      vi.useFakeTimers({ now: Date.now() + 4_000, toFake: ['Date'] });
      socket.reset();

      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts()).not.toContain(FAST_WRITE);
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'superar los 20 mensajes por minuto banea al remitente y el siguiente mensaje confirma el bloqueo',
    async () => {
      const sender = senderJid(3);

      // 25 attempts: the ban must happen within the minute window.
      const texts = await sendSpaced(socket, () => socket.receive(dmTextMessage('!ping', sender)), 25);

      expect(texts).toContain(BAN_WARNING);
      // The ban stops execution: after the warning the command stops replying.
      expect(texts.filter(t => t.startsWith('🏓 Pong!')).length).toBeGreaterThan(0);

      socket.reset();
      socket.receive(dmTextMessage('!ping', sender));
      await wait();

      expect(socket.texts()).toEqual([BAN_BLOCK]);
    },
    TIMEOUT,
  );

  it(
    'en grupo el cuarto comando seguido del mismo usuario se corta antes de ejecutar',
    async () => {
      const group = '120363032222222201@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      const sender = senderJid(4);
      for (let i = 0; i < 4; i++) {
        socket.receive(groupMessageFrom(group, sender, '!ping', 'Tester'));
      }
      await wait(600);

      const texts = socket.texts();
      expect(texts.filter(t => t === FAST_WRITE)).toHaveLength(1);
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'la carga del grupo se avisa, luego se recuerda y acaba bloqueando el chat',
    async () => {
      const group = '120363032222222202@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      // One sender per message: no per-user limit is crossed first.
      const texts = await sendSpaced(
        socket,
        i => socket.receive(groupMessageFrom(group, senderJid(100 + i), '!ping', `Tester${i}`)),
        34,
      );

      const notPong = texts.filter(t => !t.startsWith('🏓'));
      expect(notPong).toEqual([GROUP_BUSY, GROUP_SLOWER, GROUP_BLOCKED, GROUP_BLOCKED]);
      // 30 commands made it through execution before the block.
      expect(texts.filter(t => t.startsWith('🏓 Pong!'))).toHaveLength(30);
    },
    TIMEOUT,
  );

  it(
    'un usuario sin actividad no hereda el bloqueo de flood de otro',
    async () => {
      const group = '120363032222222203@g.us';
      const { serviceManager } = await import('@/services/system/Servicemanager.js');
      await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
      await clearParticipants(socket, group);

      const flooder = senderJid(5);
      const calm = senderJid(6);

      for (let i = 0; i < 4; i++) {
        socket.receive(groupMessageFrom(group, flooder, '!ping', 'Flooder'));
      }
      await wait(600);
      expect(socket.texts()).toContain(FAST_WRITE);

      socket.reset();
      socket.receive(groupMessageFrom(group, calm, '!ping', 'Tranquilo'));
      await wait();

      expect(socket.texts()).not.toContain(FAST_WRITE);
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );
});
