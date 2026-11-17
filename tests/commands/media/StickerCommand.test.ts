/**
 * StickerCommand.test.ts
 *
 * The generic catch used to hide WHY a sticker failed — the user only saw
 * "No pude convertir el sticker". These tests pin the error classification:
 * timeouts, ffmpeg failures and download failures must each say what happened.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StickerCommand } from '@/commands/media/StickerCommand.js';
import { StickerHelper } from '@/utils/StickerHelper.js';
import { downloadMediaMessage } from 'baileys';
import type { MessageContext } from '@/types/index.js';

vi.mock('baileys', () => ({
  downloadMediaMessage: vi.fn(),
}));

vi.mock('@/services/media/StickerService.js', () => ({
  StickerService: class {
    async addExif(buffer: Buffer) {
      return buffer;
    }
  },
}));

vi.mock('@/utils/StickerHelper.js', () => ({
  StickerHelper: {
    createSticker: vi.fn(),
  },
}));

const mockedDownload = downloadMediaMessage as ReturnType<typeof vi.fn>;
const mockedCreate = StickerHelper.createSticker as ReturnType<typeof vi.fn>;

const VIDEO_MSG = {
  videoMessage: { mimetype: 'video/mp4', seconds: 120 },
} as never;

const IMG_MSG = {
  imageMessage: { mimetype: 'image/jpeg' },
} as never;

const createCtx = (overrides: Partial<Record<string, unknown>> = {}): MessageContext =>
  ({
    message: { key: { id: 'm1', remoteJid: 'chat@g.us', fromMe: false }, message: VIDEO_MSG },
    quoted: undefined,
    quotedMessageId: undefined,
    quotedParticipant: undefined,
    chat: { jid: 'chat@g.us', isGroup: true },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as MessageContext;

describe('StickerCommand error reporting', () => {
  let command: StickerCommand;
  let ctx: MessageContext;

  beforeEach(() => {
    command = new StickerCommand();
    ctx = createCtx();
    vi.clearAllMocks();
  });

  it('tells the user the video is too long when the conversion times out', async () => {
    mockedDownload.mockResolvedValue(Buffer.from('video'));
    mockedCreate.mockRejectedValue(
      Object.assign(new Error('Command sticker timed out after 30000ms'), {
        message: 'Command sticker timed out after 30000ms',
      }),
    );

    await command.execute(ctx);

    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(reply).toContain('demasiado largo');
  });

  it('reports ffmpeg conversion failures with the ffmpeg reason', async () => {
    mockedDownload.mockResolvedValue(Buffer.from('video'));
    mockedCreate.mockRejectedValue(new Error('FFmpeg video failed: Invalid data'));

    await command.execute(ctx);

    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(reply).toContain('convertir el video');
    expect(reply).toContain('Invalid data');
  });

  it('reports media download failures separately', async () => {
    mockedDownload.mockRejectedValue(new Error('download failed'));

    await command.execute(ctx);

    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(reply).toContain('descargar');
  });

  it('downloads quoted media from the original cached message, not the url-less stub', async () => {
    const original = {
      key: { id: 'Q1', remoteJid: 'chat@g.us', fromMe: false, participant: 'x@s.whatsapp.net' },
      message: { imageMessage: { url: 'https://mmg.whatsapp.net/full', mediaKey: Buffer.from('k') } },
    };
    const { mediaMessageCache } = await import('@/services/media/MediaMessageCache.js');
    mediaMessageCache.put(original);

    mockedDownload.mockResolvedValue(Buffer.from('img'));
    mockedCreate.mockResolvedValue(Buffer.from('sticker'));

    const quotedCtx = createCtx({
      message: {
        key: { id: 'cmd1', remoteJid: 'chat@g.us', fromMe: false },
        message: { extendedTextMessage: { text: '!sticker' } },
      },
      quoted: { imageMessage: { mimetype: 'image/jpeg' } },
      quotedMessageId: 'Q1',
      quotedParticipant: 'x@s.whatsapp.net',
    });

    await command.execute(quotedCtx);

    expect(mockedDownload.mock.calls[0]?.[0]).toBe(original);
    expect(quotedCtx.sock?.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ sticker: expect.anything() }),
    );
  });
});
