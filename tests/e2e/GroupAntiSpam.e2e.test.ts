/**
 * GroupAntiSpam.e2e.test.ts
 *
 * AntiSpamMiddleware against the real bot: the per-group moderator of
 * GroupService (10 messages / 60 s per user, escalating across three
 * warnings).
 *
 *   - 1st excess → "⚠️ *Advertencia:* No hagas spam".
 *   - 2nd excess → "⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado".
 *   - 3rd excess → with the bot as admin: removal via groupParticipantsUpdate;
 *                  without admin: warning that it can't remove.
 *
 * The middleware's counter is per user, so messages are spaced 1.2 s of wall
 * clock apart to avoid tripping the per-second limit of AntiSpamService
 * first. The !ping cooldown doesn't interfere: AntiSpamMiddleware runs
 * before CooldownMiddleware, so it counts the message even if the command
 * then doesn't execute.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import { groupMessageFrom, senderJid } from './harness/fixtures.js';
import { botAdmin, clearParticipants, member, setParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;

const WARNING_1 = '⚠️ *Advertencia:* No hagas spam';
const WARNING_2 = '⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado';
const WARNING_3_NO_ADMIN = '❌ Spam detectado. Serías expulsado si el bot fuera administrador.';

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends `count` messages from the same sender with ~1.2 s of wall clock
 * between them (inside the moderator's one-minute window, above the
 * per-second limit) and returns the texts sent.
 */
async function spamFrom(
  socket: BootState['socket'],
  group: string,
  sender: string,
  count: number,
  pushName = 'Tester',
): Promise<string[]> {
  vi.useFakeTimers({ now: Date.now(), toFake: ['Date'] });
  for (let i = 0; i < count; i++) {
    vi.setSystemTime(Date.now() + 1_200);
    socket.receive(groupMessageFrom(group, sender, '!ping', pushName));
    await wait(120);
  }
  return socket.texts();
}

describe('e2e: anti-spam de grupo (moderador por usuario)', () => {
  let socket: BootState['socket'];
  let groupCounter = 0;

  /**
   * Fresh group per test: the group load limit (30/min, shared across the
   * whole process) would cut the messages before reaching the moderator if
   * the same group were reused across cases.
   */
  async function freshGroup(): Promise<string> {
    groupCounter++;
    const group = `1203630333333333${String(groupCounter).padStart(2, '0')}@g.us`;

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.orbitToggleService.enable(group, 'e2e-setup');

    return group;
  }

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
    'el undécimo mensaje del usuario dispara el primer aviso',
    async () => {
      const group = await freshGroup();
      await clearParticipants(socket, group);

      const texts = await spamFrom(socket, group, senderJid(1), 11);

      expect(texts).toContain(WARNING_1);
      // The first 10 produce no warning.
      expect(texts.filter(t => t.startsWith('⚠️'))).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'el siguiente exceso avisa que es la última advertencia',
    async () => {
      const group = await freshGroup();
      await clearParticipants(socket, group);

      const texts = await spamFrom(socket, group, senderJid(2), 12);

      expect(texts).toContain(WARNING_1);
      expect(texts).toContain(WARNING_2);
    },
    TIMEOUT,
  );

  it(
    'sin permisos de admin el tercer exceso avisa pero no expulsa a nadie',
    async () => {
      const group = await freshGroup();
      await clearParticipants(socket, group);

      const texts = await spamFrom(socket, group, senderJid(3), 13);

      expect(texts).toContain(WARNING_3_NO_ADMIN);
      expect(socket.participantUpdates).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'con el bot admin el tercer exceso expulsa al usuario que hace spam',
    async () => {
      const group = await freshGroup();
      const sender = senderJid(4);
      await setParticipants(socket, group, [botAdmin(), member(sender)]);

      const texts = await spamFrom(socket, group, sender, 13, 'Spammer');

      expect(socket.participantUpdates).toEqual([
        { jid: group, participants: [sender], action: 'remove' },
      ]);
      expect(texts).toContain('❌ Spammer fue expulsado por spam');
    },
    TIMEOUT,
  );

  it(
    'el contador es por usuario: otro spammer no hereda los avisos',
    async () => {
      const group = await freshGroup();
      await clearParticipants(socket, group);
      const first = senderJid(5);
      const second = senderJid(6);

      await spamFrom(socket, group, first, 12);
      socket.reset();

      // The second user starts with a clean counter: 10 messages with no
      // warnings, and the eleventh warns him (him, not a repeat of the first).
      const texts = await spamFrom(socket, group, second, 11);

      expect(texts.filter(t => t === WARNING_1)).toHaveLength(1);
      expect(texts).not.toContain(WARNING_2);
    },
    TIMEOUT,
  );
});
