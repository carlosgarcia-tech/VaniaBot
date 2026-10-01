/**
 * MessageForms.e2e.test.ts
 *
 * La matriz de formas de mensaje que MessageContext.extractText y los guards
 * del pipeline tienen que cubrir:
 *
 *   conversation            → texto plano
 *   extendedTextMessage     → texto con título (el texto sigue siendo válido)
 *   imageMessage.caption    → comando dentro del pie de foto
 *   stickerMessage          → sin texto: no debe extraer nada
 *   key.fromMe              → el bot no se responde a sí mismo
 *
 * Los comandos usados son locales y sin efectos externos (!ping).
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { bootBot, type BootState } from './harness/boot.js';
import {
  dmExtendedTextMessage,
  dmFromMeMessage,
  dmImageCaptionMessage,
  dmStickerMessage,
  dmTextMessage,
  groupExtendedTextMessage,
  senderJid,
} from './harness/fixtures.js';
import { botAdmin, member, setParticipants } from './harness/groups.js';

vi.mock('@/services/external/AIService.js', () => ({
  aiService: {
    initialize: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    isEnabled: vi.fn(() => false),
    handleMention: vi.fn(async () => {}),
  },
}));

const TIMEOUT = 30_000;
const wait = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

const PONG = (text: string) => text.startsWith('🏓 Pong!');

describe('e2e: formas de mensaje', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  async function freshGroup(): Promise<string> {
    caseCounter++;
    const group = `1203630333333333${String(caseCounter).padStart(2, '0')}@g.us`;

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.vaniaToggleService.enable(group, 'e2e-setup');
    await setParticipants(socket, group, [botAdmin(), member(senderJid(500 + caseCounter))]);

    return group;
  }

  beforeAll(async () => {
    ({ socket } = await bootBot());
  }, TIMEOUT);

  beforeEach(() => {
    socket?.reset();
  });

  it(
    'un extendedTextMessage ejecuta el comando igual que un texto plano',
    async () => {
      socket.receive(dmExtendedTextMessage('!ping', senderJid(520)));
      await wait();

      expect(socket.texts().some(PONG)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'un extendedTextMessage de grupo también ejecuta el comando',
    async () => {
      const group = await freshGroup();

      socket.receive(groupExtendedTextMessage('!ping', group, senderJid(521)));
      await wait();

      expect(socket.texts().some(PONG)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'un comando escrito en el pie de una imagen se ejecuta',
    async () => {
      socket.receive(dmImageCaptionMessage('!ping', senderJid(522)));
      await wait();

      expect(socket.texts().some(PONG)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'un sticker no produce ninguna respuesta',
    async () => {
      socket.receive(dmStickerMessage(senderJid(523)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un mensaje enviado por el propio bot se ignora',
    async () => {
      socket.receive(dmFromMeMessage('!ping', senderJid(524)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'un pie de foto sin comando no dispara nada',
    async () => {
      socket.receive(dmImageCaptionMessage('solo un texto', senderJid(525)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
