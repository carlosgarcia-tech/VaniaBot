/**
 * BooruCommand.test.ts
 *
 * The generic `!booru <tag>` command (SFW: Danbooru + rating:g appended,
 * max 2 anonymous tags). Pins: bad tags are rejected locally before any
 * request, and the resolved image is sent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { booruCommand } from '@/commands/anime/BooruCommand.js';
import { booruService } from '@/services/external/BooruService.js';
import type { MessageContext } from '@/types/index.js';

vi.mock(import('@/services/external/BooruService.js'), async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/external/BooruService.js')>()),
  booruService: {
    randomPost: vi.fn(),
  },
}));

const mockedRandom = booruService.randomPost as ReturnType<typeof vi.fn>;

const createCtx = (args: string[]): MessageContext =>
  ({
    args,
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('BooruCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches danbooru SFW with the user tag and sends the image', async () => {
    mockedRandom.mockResolvedValue('https://cdn.donmai.us/x.jpg');
    const ctx = createCtx(['maid']);

    await booruCommand.execute(ctx);

    expect(mockedRandom).toHaveBeenCalledWith('danbooru', 'maid rating:g');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ image: { url: 'https://cdn.donmai.us/x.jpg' } }),
    );
  });

  it('rejects blacklisted tags locally without any request', async () => {
    const ctx = createCtx(['loli']);

    await booruCommand.execute(ctx);

    expect(mockedRandom).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('bloqueado'));
  });

  it('keeps at most 1 user tag (danbooru anonymous limit of 2 with rating)', async () => {
    mockedRandom.mockResolvedValue('https://cdn.donmai.us/x.jpg');
    const ctx = createCtx(['maid', 'uniform']);

    await booruCommand.execute(ctx);

    expect(mockedRandom).toHaveBeenCalledWith('danbooru', 'maid rating:g');
  });

  it('shows usage without args', async () => {
    const ctx = createCtx([]);

    await booruCommand.execute(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Uso'));
  });
});
