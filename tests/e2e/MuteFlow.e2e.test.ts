/**
 * MuteFlow.e2e.test.ts
 *
 * End-to-end mute of a group user with the real bot:
 *
 *   group admin → !mute @user 10m (MuteCommand + ModerationService +
 *   middlewareCache) → the muted user sends !ping and the handleMutedUser
 *   guard deletes the message without replying.
 *
 * Also covers the two gates the command must pass through:
 * PermissionMiddleware (group admin) and the bot's own admin permission,
 * plus the undo path with !unmute.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import {
  groupMentionMessage,
  groupTextMessage,
  senderJid,
} from './harness/fixtures.js';
import { botAdmin, clearParticipants, member, setParticipants } from './harness/groups.js';
import type { FakeParticipant } from './harness/FakeWASocket.js';

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

/** First configured owner as a WhatsApp JID. */
async function ownerJid(): Promise<string> {
  const { config } = await import('@/config/index.js');
  const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
  return `${ownerPhone}@s.whatsapp.net`;
}

describe('e2e: silenciar y desmutear usuarios en grupo', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  /**
   * Fresh group, moderator and target per case: mutes are stored in the
   * harness database and the anti-spam/cooldown counters live for the whole
   * boot, so reusing senders across tests would cross-contaminate them.
   *
   * `botIsAdmin` decides whether the bot is listed as an admin participant.
   * `moderatorIsOwner` uses an owner as the moderator: necessary to test the
   * bot's permission with no admins in the group, because
   * BotPermissionChecker treats the bot as admin whenever the group has any
   * admin, even if the bot itself is missing from the participant list.
   */
  async function freshCase(options: {
    botIsAdmin?: boolean;
    moderatorIsOwner?: boolean;
  } = {}): Promise<{ group: string; moderator: string; target: string }> {
    const { botIsAdmin = true, moderatorIsOwner = false } = options;

    caseCounter++;
    const suffix = String(caseCounter).padStart(2, '0');
    const group = `1203630344444444${suffix}@g.us`;
    const moderator = moderatorIsOwner ? await ownerJid() : senderJid(800 + caseCounter);
    const target = senderJid(900 + caseCounter);

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.orbitToggleService.enable(group, 'e2e-setup');

    const moderatorParticipant: FakeParticipant = moderatorIsOwner
      ? member(moderator)
      : { id: moderator, admin: 'admin' };
    const participants = botIsAdmin
      ? [botAdmin(), moderatorParticipant, member(target)]
      : [moderatorParticipant, member(target)];
    await setParticipants(socket, group, participants);

    return { group, moderator, target };
  }

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un admin silencia a un usuario y sus mensajes dejan de responder',
    async () => {
      const { group, moderator, target } = await freshCase();

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Moderador'));
      await wait(500);

      const texts = socket.texts();
      expect(texts.some(t => t.includes('en silencio'))).toBe(true);
      expect(socket.reactions()).toContain('✅');

      // The muted user speaks: the guard deletes the message and does not reply.
      socket.reset();
      socket.receive(groupTextMessage('!ping', group, target));
      await wait();

      expect(socket.deletions()).toHaveLength(1);
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(false);
    },
    TIMEOUT,
  );

  it(
    'un miembro sin permisos no puede silenciar a nadie',
    async () => {
      const { group, moderator, target } = await freshCase();

      socket.receive(groupMentionMessage('!mute 10m', group, target, moderator, 'Tranquilo'));
      await wait();

      expect(socket.texts()).toContain('❌ No tienes permiso para usar este comando');

      // The moderator is not muted: their command still answers.
      socket.reset();
      socket.receive(groupTextMessage('!ping', group, moderator));
      await wait();
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'sin admin el bot no puede ejecutar el silencio',
    async () => {
      // Owner running things, group with no admins at all: the user's
      // permission passes but the bot's does not.
      const { group, moderator, target } = await freshCase({
        botIsAdmin: false,
        moderatorIsOwner: true,
      });

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Propietario'));
      await wait();

      expect(socket.texts()).toContain('❌ El bot necesita ser admin para ejecutar este comando');

      // And the target did not end up muted.
      socket.reset();
      socket.receive(groupTextMessage('!ping', group, target));
      await wait();
      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'el bot cuenta como admin si el grupo tiene algún admin aunque no esté en la lista',
    async () => {
      // BotPermissionChecker doesn't find the bot among the participants and
      // falls back to "if any participant is admin, so is the bot".
      // Regular admin moderator, bot absent from the participants.
      const { group, moderator, target } = await freshCase({ botIsAdmin: false });
      await setParticipants(socket, group, [{ id: moderator, admin: 'admin' }, member(target)]);

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Moderador'));
      await wait(500);

      expect(socket.texts().some(t => t.includes('en silencio'))).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'sin mención el comando pide un usuario objetivo',
    async () => {
      const { group, moderator } = await freshCase();

      socket.receive(groupTextMessage('!mute 10m', group, moderator));
      await wait();

      expect(
        socket.texts().some(t => t.includes('mencionar un usuario o responder a su mensaje')),
      ).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'un admin no puede silenciarse a sí mismo',
    async () => {
      const { group, moderator } = await freshCase();

      socket.receive(
        groupMentionMessage('!mute 10m', group, moderator, moderator, 'Moderador'),
      );
      await wait();

      expect(socket.texts()).toContain('❌ You cannot mute yourself');
    },
    TIMEOUT,
  );

  it(
    'un admin no puede silenciar a un owner',
    async () => {
      const { group, moderator } = await freshCase();

      socket.receive(
        groupMentionMessage('!mute 10m', group, moderator, await ownerJid(), 'Moderador'),
      );
      await wait();

      expect(socket.texts()).toContain('❌ You cannot mute an owner');
    },
    TIMEOUT,
  );

  it(
    'tras !unmute el usuario vuelve a poder usar comandos',
    async () => {
      const { group, moderator, target } = await freshCase();

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Moderador'));
      await wait(500);
      expect(socket.texts().some(t => t.includes('en silencio'))).toBe(true);

      socket.reset();
      socket.receive(groupMentionMessage('!unmute', group, moderator, target, 'Moderador'));
      await wait(500);

      expect(socket.texts().some(t => t.includes('Silence quitado'))).toBe(true);
      expect(socket.reactions()).toContain('🔊');

      socket.reset();
      socket.receive(groupTextMessage('!ping', group, target));
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'sin admin en el grupo el mensaje silenciado no se borra, pero tampoco responde',
    async () => {
      // handleMutedUser only deletes when the bot is admin; the mute is
      // still live in the pipeline and the command never gets to run.
      const { group, moderator, target } = await freshCase();

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Moderador'));
      await wait(500);

      await clearParticipants(socket, group);
      socket.reset();

      socket.receive(groupTextMessage('!ping', group, target));
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(false);
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );
});
