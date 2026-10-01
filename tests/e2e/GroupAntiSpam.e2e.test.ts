/**
 * GroupAntiSpam.e2e.test.ts
 *
 * AntiSpamMiddleware sobre el bot real: el moderador por grupo de
 * GroupService (10 mensajes / 60 s por usuario, escalado en tres avisos).
 *
 *   - 1er exceso → "⚠️ *Advertencia:* No hagas spam".
 *   - 2º exceso  → "⚠️ *Última advertencia:* Deja de hacer spam o serás expulsado".
 *   - 3er exceso → con el bot admin: expulsión vía groupParticipantsUpdate;
 *                  sin admin: aviso de que no se puede expulsar.
 *
 * El contador del middleware es por usuario, así que los mensajes van
 * espaciados 1.2 s de reloj para no chocar antes con el límite por segundo
 * de AntiSpamService. El cooldown de !ping no interfiere: AntiSpamMiddleware
 * corre antes que CooldownMiddleware, así que cuenta el mensaje aunque luego
 * el comando no se ejecute.
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

/** Espera a que el pipeline (queueMicrotask + setImmediate) termine. */
const wait = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Envía `count` mensajes del mismo remitente con ~1.2 s de reloj entre ellos
 * (ventana de un minuto del moderador, por encima del límite por segundo) y
 * devuelve los textos enviados.
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
   * Grupo nuevo por test: el límite de carga del grupo (30/min, compartido
   * en todo el proceso) cortaría los mensajes antes de llegar al moderador si
   * se reutilizara el mismo grupo entre casos.
   */
  async function freshGroup(): Promise<string> {
    groupCounter++;
    const group = `1203630333333333${String(groupCounter).padStart(2, '0')}@g.us`;

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');

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
      // Los 10 primeros no generan ningún aviso.
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

      // El segundo usuario empieza con su contador limpio: 10 mensajes sin
      // avisos y el undécimo ya le avisa (a él, no una repetición del primero).
      const texts = await spamFrom(socket, group, second, 11);

      expect(texts.filter(t => t === WARNING_1)).toHaveLength(1);
      expect(texts).not.toContain(WARNING_2);
    },
    TIMEOUT,
  );
});
