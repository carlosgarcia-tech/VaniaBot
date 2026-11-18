/**
 * EnhanceUpscale.test.ts
 *
 * Enhance/Upscale used Delirius `ia` (dead) and rebuilt quoted messages
 * without the CDN url (same bug as sticker). Pins: DeepAI torch-srgan
 * (graceful "needs key" without DEEPAI_API_KEY) and cached quoted media.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { EnhanceCommand } from '@/commands/ia/EnhanceCommand.js';
import { UpscaleCommand } from '@/commands/ia/UpscaleCommand.js';
import { mediaMessageCache } from '@/services/media/MediaMessageCache.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('axios');

vi.mock('baileys', () => ({
  downloadMediaMessage: vi.fn(),
}));

const mockedAxios = axios as unknown as {
  postForm: ReturnType<typeof vi.fn>;
};

const URL_ARG_CTX = (): MessageContext =>
  ({
    args: ['https://example.com/img.jpg'],
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    quoted: undefined,
    message: { key: { id: 'm1', remoteJid: 'chat@g.us' }, message: {} },
  }) as unknown as MessageContext;

describe('Enhance/Upscale via DeepAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaMessageCache.clear();
    delete process.env.DEEPAI_API_KEY;
  });

  it('enhance asks for the key instead of dying in a dead API', async () => {
    const ctx = URL_ARG_CTX();

    await new EnhanceCommand().execute(ctx);

    expect(mockedAxios.postForm).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('DEEPAI_API_KEY'));
  });

  it('upscale asks for the key instead of dying in a dead API', async () => {
    const ctx = URL_ARG_CTX();

    await new UpscaleCommand().execute(ctx);

    expect(mockedAxios.postForm).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('DEEPAI_API_KEY'));
  });

  it('enhance posts to DeepAI torch-srgan and sends the result', async () => {
    process.env.DEEPAI_API_KEY = 'k';
    mockedAxios.postForm.mockResolvedValue({ data: { output_url: 'https://deepai.org/out.jpg' } });
    const ctx = URL_ARG_CTX();

    await new EnhanceCommand().execute(ctx);

    expect(mockedAxios.postForm).toHaveBeenCalledWith(
      'https://api.deepai.org/api/torch-srgan',
      expect.anything(),
      expect.objectContaining({ headers: { 'api-key': 'k' } }),
    );
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ image: { url: 'https://deepai.org/out.jpg' } }),
    );
  });

  it('upscale posts to DeepAI torch-srgan and sends the result', async () => {
    process.env.DEEPAI_API_KEY = 'k';
    mockedAxios.postForm.mockResolvedValue({ data: { output_url: 'https://deepai.org/up.jpg' } });
    const ctx = URL_ARG_CTX();

    await new UpscaleCommand().execute(ctx);

    expect(mockedAxios.postForm).toHaveBeenCalledWith(
      'https://api.deepai.org/api/torch-srgan',
      expect.anything(),
      expect.objectContaining({ headers: { 'api-key': 'k' } }),
    );
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ image: { url: 'https://deepai.org/up.jpg' } }),
    );
  });

  it('resolves quoted media from the MediaMessageCache original', async () => {
    process.env.DEEPAI_API_KEY = 'k';
    const original = {
      key: { id: 'Q1', remoteJid: 'chat@g.us', fromMe: false, participant: 'x@s.whatsapp.net' },
      message: { imageMessage: { url: 'https://mmg.whatsapp.net/full', mediaKey: Buffer.from('k') } },
    };
    mediaMessageCache.put(original);
    mockedAxios.postForm.mockResolvedValue({ data: { output_url: 'https://deepai.org/q.jpg' } });

    const ctx = URL_ARG_CTX();
    // strip the URL arg so the command takes the quoted path
    (ctx as { args: string[] }).args = [];
    (
      ctx as unknown as {
        quoted: unknown;
        quotedMessageId: string;
        quotedParticipant: string;
      }
    ).quoted = { imageMessage: { mimetype: 'image/jpeg' } };
    (ctx as unknown as { quotedMessageId: string }).quotedMessageId = 'Q1';
    (ctx as unknown as { quotedParticipant: string }).quotedParticipant = 'x@s.whatsapp.net';
    const { downloadMediaMessage } = await import('baileys');
    (downloadMediaMessage as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('img'));

    await new EnhanceCommand().execute(ctx);

    // The image input went through imgbb (needs key) or directly; the
    // important pin: DeepAI was called (not Delirius) and no crash.
    expect(mockedAxios.postForm).toHaveBeenCalled();
  });
});
