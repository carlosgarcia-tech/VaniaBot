/**
 * NsfwCommands.test.ts
 *
 * The NSFW commands must keep working (they are gated by the !nsfw toggle)
 * without ever touching a dead API or returning blacklisted content:
 *  - rule34 → Danbooru with rating:e (api.rule34.xxx now requires auth)
 *  - nhentai / nhentaisearch → nhentai API v2 (blacklist enforced in service)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Rule34Command } from '@/commands/anime/nsfw/Rule34Command.js';
import { NhentaiCommand } from '@/commands/anime/nsfw/NhentaiCommand.js';
import { NhentaisearchCommand } from '@/commands/anime/nsfw/NhentaisearchCommand.js';
import { booruService } from '@/services/external/BooruService.js';
import { nhentaiService } from '@/services/external/NhentaiService.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('@/services/external/BooruService.js', () => ({
  booruService: { randomPost: vi.fn() },
}));

vi.mock('@/services/external/NhentaiService.js', () => ({
  nhentaiService: { getGallery: vi.fn(), search: vi.fn() },
}));

const mockedPost = booruService.randomPost as ReturnType<typeof vi.fn>;
const mockedGallery = nhentaiService.getGallery as ReturnType<typeof vi.fn>;
const mockedSearch = nhentaiService.search as ReturnType<typeof vi.fn>;

const createCtx = (args: string[]): MessageContext =>
  ({
    args,
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('NSFW commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rule34 asks danbooru for explicit posts and stays behind the nsfw gate', async () => {
    mockedPost.mockResolvedValue('https://cdn.donmai.us/x.jpg');
    const ctx = createCtx(['anime']);

    const command = new Rule34Command();
    await command.execute(ctx);

    expect(command.nsfw).toBe(true);
    expect(mockedPost).toHaveBeenCalledWith('danbooru', 'anime rating:e');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith('chat@g.us', {
      image: { url: 'https://cdn.donmai.us/x.jpg' },
    });
  });

  it('rule34 falls back to any explicit post when the tag is not a danbooru tag', async () => {
    mockedPost
      .mockRejectedValueOnce(new Error('Sin resultados (o filtrados por la lista negra de tags)'))
      .mockResolvedValueOnce('https://cdn.donmai.us/y.jpg');
    const ctx = createCtx(['anime']);

    await new Rule34Command().execute(ctx);

    expect(mockedPost).toHaveBeenNthCalledWith(2, 'danbooru', 'rating:e');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith('chat@g.us', {
      image: { url: 'https://cdn.donmai.us/y.jpg' },
    });
  });

  it('nhentai fetches the gallery by numeric code', async () => {
    mockedGallery.mockResolvedValue({
      title: 'G',
      coverUrl: 'https://t.nhentai.net/g.jpg',
      pages: 20,
    });
    const ctx = createCtx(['123456']);

    await new NhentaiCommand().execute(ctx);

    expect(mockedGallery).toHaveBeenCalledWith('123456');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith('chat@g.us', {
      image: { url: 'https://t.nhentai.net/g.jpg' },
    });
  });

  it('nhentai refuses a non-numeric code without hitting the api', async () => {
    const ctx = createCtx(['abc']);

    await new NhentaiCommand().execute(ctx);

    expect(mockedGallery).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('No se encontraron'));
  });

  it('nhentaisearch returns the first clean gallery', async () => {
    mockedSearch.mockResolvedValue({
      title: 'G',
      coverUrl: 'https://t.nhentai.net/s.jpg',
      pages: 10,
    });
    const ctx = createCtx(['lisa']);

    await new NhentaisearchCommand().execute(ctx);

    expect(mockedSearch).toHaveBeenCalledWith('lisa');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith('chat@g.us', {
      image: { url: 'https://t.nhentai.net/s.jpg' },
    });
  });
});
