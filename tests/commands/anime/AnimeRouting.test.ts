/**
 * AnimeRouting.test.ts
 *
 * Pins the migration of reactions/animebase/random/anime-image commands from
 * the dead Delirius/Prince APIs to their live replacements:
 *  - reactions  → nekos.best gif → mp4 conversion
 *  - neko/waifu → nekos.best images
 *  - dog/duck/coffee/picsum → direct sources
 *  - avatar → dicebear
 *  - unknown random endpoints fail loudly (Delirius is gone)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hugCommand,
  nekoCommand,
  dogCommand,
  picsumCommand,
  fuckCommand,
} from '@/commands/anime/AnimeCommand.js';
import { resolveRandomImage } from '@/commands/anime/AnimeCommand.js';
import { nekosBestService } from '@/services/external/NekosBestService.js';
import { purrbotService } from '@/services/external/PurrbotService.js';
import type { MessageContext } from '@/types/index.js';

vi.mock('@/services/external/NekosBestService.js', () => ({
  nekosBestService: {
    getReactionVideo: vi.fn(),
    getImageUrl: vi.fn(),
  },
}));

vi.mock('@/services/external/PurrbotService.js', () => ({
  purrbotService: {
    getReactionVideo: vi.fn(),
  },
}));

const mockedReaction = nekosBestService.getReactionVideo as ReturnType<typeof vi.fn>;
const mockedImageUrl = nekosBestService.getImageUrl as ReturnType<typeof vi.fn>;
const mockedPurrbot = purrbotService.getReactionVideo as ReturnType<typeof vi.fn>;

const createCtx = (): MessageContext =>
  ({
    chat: { jid: 'chat@g.us' },
    sock: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  }) as unknown as MessageContext;

describe('AnimeCommand routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends hug reactions as converted mp4 video with gifPlayback', async () => {
    mockedReaction.mockResolvedValue(Buffer.from('mp4'));
    const ctx = createCtx();

    await hugCommand.execute(ctx);

    expect(mockedReaction).toHaveBeenCalledWith('hug');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({
        video: Buffer.from('mp4'),
        gifPlayback: true,
      }),
    );
  });

  it('sends neko images from nekos.best url', async () => {
    mockedImageUrl.mockResolvedValue('https://nekos.best/api/v2/neko/abc.png');
    const ctx = createCtx();

    await nekoCommand.execute(ctx);

    expect(mockedImageUrl).toHaveBeenCalledWith('neko');
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ image: { url: 'https://nekos.best/api/v2/neko/abc.png' } }),
    );
  });

  it('routes NSFW fuck to purrbot with the nsfw gate flag on', async () => {
    mockedPurrbot.mockResolvedValue(Buffer.from('mp4'));
    const ctx = createCtx();

    await fuckCommand.execute(ctx);

    expect(mockedPurrbot).toHaveBeenCalledWith('nsfw/fuck');
    expect(mockedReaction).not.toHaveBeenCalled();
    expect(ctx.sock.sendMessage).toHaveBeenCalledWith(
      'chat@g.us',
      expect.objectContaining({ video: Buffer.from('mp4'), gifPlayback: true }),
    );
    // The pipeline gates on command.nsfw with !nsfw on — must be true.
    expect((fuckCommand as unknown as { nsfw: boolean }).nsfw).toBe(true);
    expect((hugCommand as unknown as { nsfw: boolean }).nsfw).toBe(false);
  });

  it('reports the failure instead of throwing when the provider fails', async () => {
    mockedReaction.mockRejectedValue(new Error('nekos.best error: 503'));
    const ctx = createCtx();

    await hugCommand.execute(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Intenta'));
  });
});

describe('resolveRandomImage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps dog to dog.ceo message url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'https://images.dog.ceo/x.jpg' }),
      } as unknown as Response),
    );

    expect(await resolveRandomImage('dog')).toBe('https://images.dog.ceo/x.jpg');
  });

  it('maps duck to random-d.uk url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://random-d.uk/x.png' }),
      } as unknown as Response),
    );

    expect(await resolveRandomImage('duck')).toBe('https://random-d.uk/x.png');
  });

  it('maps coffee to alexflipnote image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ image: 'https://coffee.alexflipnote.dev/x.jpg' }),
      } as unknown as Response),
    );

    expect(await resolveRandomImage('coffee')).toBe('https://coffee.alexflipnote.dev/x.jpg');
  });

  it('maps picsum to a direct URL without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await resolveRandomImage('picsum')).toContain('picsum.photos');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an unmapped endpoint instead of calling the dead Delirius API', async () => {
    await expect(resolveRandomImage('loremflickr')).rejects.toThrow('desconocido');
  });
});
