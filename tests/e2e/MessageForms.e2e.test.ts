/**
 * MessageForms.e2e.test.ts
 *
 * The matrix of message shapes MessageContext.extractText and the pipeline
 * guards must cover:
 *
 *   conversation            → plain text
 *   extendedTextMessage     → text with a title (text still valid)
 *   imageMessage.caption    → command inside the caption
 *   stickerMessage          → no text: nothing must be extracted
 *   key.fromMe              → the bot doesn't reply to itself
 *
 * The commands used are local with no external effects (!ping).
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

describe('e2e: message shapes', () => {
  let socket: BootState['socket'];
  let caseCounter = 0;

  async function freshGroup(): Promise<string> {
    caseCounter++;
    const group = `1203630333333333${String(caseCounter).padStart(2, '0')}@g.us`;

    const { serviceManager } = await import('@/services/system/Servicemanager.js');
    await serviceManager.orbitToggleService.enable(group, 'e2e-setup');
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
    'an extendedTextMessage runs the command like plain text',
    async () => {
      socket.receive(dmExtendedTextMessage('!ping', senderJid(520)));
      await wait();

      expect(socket.texts().some(PONG)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'a group extendedTextMessage runs the command too',
    async () => {
      const group = await freshGroup();

      socket.receive(groupExtendedTextMessage('!ping', group, senderJid(521)));
      await wait();

      expect(socket.texts().some(PONG)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    'a command written in an image caption runs',
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
    'a message sent by the bot itself is ignored',
    async () => {
      socket.receive(dmFromMeMessage('!ping', senderJid(524)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );

  it(
    'a photo caption without a command triggers nothing',
    async () => {
      socket.receive(dmImageCaptionMessage('solo un texto', senderJid(525)));
      await wait();

      expect(socket.sent).toHaveLength(0);
    },
    TIMEOUT,
  );
});
