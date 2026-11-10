/**
 * Antilink.e2e.test.ts
 *
 * Per-group antilink guard (MainMessagePipeline.handleAntilink) with the real
 * bot and real AntilinkService. The guard runs BEFORE commands are resolved,
 * so it also covers prefixless messages:
 *
 *   - delete (bot without admin): deletes the message and replies with the
 *     domain.
 *   - kick (bot as admin): removes the sender via groupParticipantsUpdate.
 *   - whitelist: an allowed domain passes untouched.
 *   - exemption: owners and group admins are not moderated.
 *
 * Antilink config is written to the harness's temp cwd
 * (database/antilink.json), never to the repository.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
const GROUP = '120363031111111111@g.us';

/** Waits for the pipeline (queueMicrotask + setImmediate) to drain. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

describe('e2e: guard de antilink por grupo', () => {
  let socket: BootState['socket'];

  beforeAll(async () => {
    ({ socket } = await bootBot());

    // Group enabled and antilink active with the real service, exactly as
    // !antilink on would do it from the chat.
    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    const { antilinkService } = await import('@/services/moderation/AntilinkService.js');

    await serviceManager.orbitToggleService.enable(GROUP, 'e2e-setup');
    antilinkService.enable(GROUP);
    antilinkService.setMode(GROUP, 'delete');
  }, TIMEOUT);

  beforeEach(async () => {
    socket?.reset();
    const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
    antilinkService.setMode(GROUP, 'delete');
    antilinkService.enable(GROUP);
    for (const domain of antilinkService.getWhitelist(GROUP)) {
      antilinkService.removeFromWhitelist(GROUP, domain);
    }
  });

  it(
    'con el bot sin admin borra el mensaje con enlace y avisa del dominio',
    async () => {
      await clearParticipants(socket, GROUP);
      const sender = senderJid(1);

      socket.receive(
        groupMessageFrom(GROUP, sender, 'mira esto https://ejemplo.com/pagina', 'Tester'),
      );
      await wait();

      const texts = socket.texts();
      expect(texts.some(t => t.includes('Enlace bloqueado') && t.includes('ejemplo.com'))).toBe(true);
      expect(socket.deletions()).toHaveLength(1);
      // Without admin permissions no one is ever removed
      expect(socket.participantUpdates).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'con el bot admin y modo kick expulsa al remitente en vez de borrar',
    async () => {
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.setMode(GROUP, 'kick');

      const sender = senderJid(2);
      await setParticipants(socket, GROUP, [botAdmin(), member(sender)]);

      socket.receive(
        groupMessageFrom(GROUP, sender, 'entra https://ejemplo.com/otro', 'Tester'),
      );
      await wait();

      expect(socket.participantUpdates).toEqual([
        { jid: GROUP, participants: [sender], action: 'remove' },
      ]);
      expect(socket.texts().some(t => t.includes('Expulsado automáticamente'))).toBe(true);
      // The kick path doesn't delete the message: it removes the sender
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un dominio en la whitelist no se bloquea',
    async () => {
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.addToWhitelist(GROUP, 'ejemplo.com');
      await clearParticipants(socket, GROUP);

      socket.receive(
        groupMessageFrom(GROUP, senderJid(3), 'mira https://ejemplo.com/ok', 'Tester'),
      );
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un comando cuyo texto lleva un dominio permitido llega a ejecutarse',
    async () => {
      // The guard also inspects commands: if the domain is allowed the
      // command runs and replies (otherwise the Pong wouldn't exist).
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.addToWhitelist(GROUP, 'ejemplo.com');
      await clearParticipants(socket, GROUP);

      socket.receive(groupMessageFrom(GROUP, senderJid(30), '!ping https://ejemplo.com/ok', 'Tester'));
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(true);
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un comando con un dominio bloqueado no llega a ejecutarse',
    async () => {
      await clearParticipants(socket, GROUP);

      socket.receive(
        groupMessageFrom(GROUP, senderJid(31), '!ping https://bloqueado.net/x', 'Tester'),
      );
      await wait();

      expect(socket.texts().some(t => t.startsWith('🏓 Pong!'))).toBe(false);
      expect(socket.deletions()).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'un subdominio del dominio permitido también pasa',
    async () => {
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.addToWhitelist(GROUP, 'ejemplo.com');
      await clearParticipants(socket, GROUP);

      socket.receive(
        groupMessageFrom(GROUP, senderJid(4), 'mira https://docs.ejemplo.com/ok', 'Tester'),
      );
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'otro dominio sigue bloqueado aunque uno esté en la whitelist',
    async () => {
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.addToWhitelist(GROUP, 'ejemplo.com');
      await clearParticipants(socket, GROUP);

      socket.receive(
        groupMessageFrom(GROUP, senderJid(5), 'mira https://otro-sitio.net/x', 'Tester'),
      );
      await wait();

      expect(socket.texts().some(t => t.includes('Enlace bloqueado'))).toBe(true);
      expect(socket.deletions()).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    'un admin del grupo está exento del guard',
    async () => {
      const sender = senderJid(6);
      await setParticipants(socket, GROUP, [{ id: sender, admin: 'admin' }]);

      socket.receive(
        groupMessageFrom(GROUP, sender, 'https://ejemplo.com/admin', 'Admin'),
      );
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'los owners no son moderados aunque el bot sea admin',
    async () => {
      const { antilinkService } = await import('@/services/moderation/AntilinkService.js');
      antilinkService.setMode(GROUP, 'kick');

      // First default owner of config.owners (phone, not LID).
      const { config } = await import('@/config/index.js');
      const ownerPhone = config.owners.find(owner => !owner.includes('@lid'));
      expect(ownerPhone).toBeDefined();

      const ownerJid = `${ownerPhone}@s.whatsapp.net`;
      await setParticipants(socket, GROUP, [botAdmin(), member(ownerJid)]);

      socket.receive(
        groupMessageFrom(GROUP, ownerJid, 'https://ejemplo.com/owner', 'Owner'),
      );
      await wait();

      expect(socket.participantUpdates).toHaveLength(0);
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un mensaje sin enlaces pasa intacto',
    async () => {
      await clearParticipants(socket, GROUP);

      socket.receive(groupMessageFrom(GROUP, senderJid(7), 'hola grupo', 'Tester'));
      await wait();

      expect(socket.sent).toHaveLength(0);
      expect(socket.deletions()).toHaveLength(0);
    },
    TIMEOUT,
  );
});
