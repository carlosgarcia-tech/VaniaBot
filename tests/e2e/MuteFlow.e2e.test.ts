/**
 * MuteFlow.e2e.test.ts
 *
 * Silencio de un usuario de grupo de punta a punta con el bot real:
 *
 *   admin del grupo → !mute @usuario 10m (MuteCommand + ModerationService +
 *   middlewareCache) → el usuario silenciado escribe !ping y el guard
 *   handleMutedUser borra el mensaje sin responder.
 *
 * También cubre las dos puertas que el comando tiene que atravesar:
 * PermissionMiddleware (admin del grupo) y el permiso de admin del bot, y
 * la vuelta atrás con !unmute.
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

/** Espera a que el pipeline (queueMicrotask + setImmediate) termine. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/** Primer owner de configuración como JID de WhatsApp. */
async function ownerJid(): Promise<string> {
  const { config } = await import('@/config/index.js');
  const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
  return `${ownerPhone}@s.whatsapp.net`;
}

describe('e2e: silenciar y desmutear usuarios en grupo', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  /**
   * Grupo, moderador y objetivo nuevos por caso: el silencio se registra en
   * la base del harness y los contadores de anti-spam/cooldown viven durante
   * todo el boot, así que reutilizar remitentes entre tests los contaminaría.
   *
   * `botIsAdmin` decide si el bot figura como admin entre los participantes.
   * `moderatorIsOwner` usa un owner como moderador: necesario para probar el
   * permiso del bot sin admins en el grupo, porque BotPermissionChecker
   * considera admin al bot si el grupo tiene algún admin aunque no aparezca
   * en la lista de participantes.
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
    await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');

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

      // El usuario silenciado escribe: el guard borra el mensaje y no responde.
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

      // El moderador sigue sin estar silenciado: su comando sí responde.
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
      // Owner al frente, grupo sin ningún admin: el permiso del usuario pasa
      // pero el del bot no.
      const { group, moderator, target } = await freshCase({
        botIsAdmin: false,
        moderatorIsOwner: true,
      });

      socket.receive(groupMentionMessage('!mute 10m', group, moderator, target, 'Propietario'));
      await wait();

      expect(socket.texts()).toContain('❌ El bot necesita ser admin para ejecutar este comando');

      // Y el objetivo no quedó silenciado.
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
      // BotPermissionChecker no encuentra al bot entre los participantes y
      // cae al respaldo "si algún participante es admin, el bot también".
      // Moderador admin normal, el bot ausente de los participantes.
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
      // El guard handleMutedUser solo borra si el bot es admin; el silencio
      // sigue vigentes en el pipeline y el comando no llega a ejecutarse.
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
