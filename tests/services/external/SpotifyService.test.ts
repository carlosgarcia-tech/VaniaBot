/**
 * SpotifyService.test.ts
 *
 * The Spotify Web API stopped being free (2026); these tests pin the free
 * replacements verified live: oEmbed metadata and the embed-page trackList,
 * plus ytsearch1 download via the shared yt-dlp pipeline.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import {
  SpotifyService,
  spotifyService,
} from '@/services/external/SpotifyService.js';

vi.mock('child_process', () => ({ spawn: vi.fn() }));

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const htmlResponse = (html: string) =>
  ({
    ok: true,
    status: 200,
    text: async () => html,
  }) as unknown as Response;

const EMBED_HTML = (tracks: string) => `
<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      state: { data: { entity: { trackList: JSON.parse(tracks) } } },
    },
  },
})}</script></head></html>`;

const TRACKLIST = JSON.stringify([
  { title: 'Run Away With Me', subtitle: 'Carly Rae Jepsen' },
  { title: 'Emotion', subtitle: 'Carly Rae Jepsen' },
  { title: 'Cut To The Feeling', subtitle: 'Carly Rae Jepsen' },
]);

describe('SpotifyService', () => {
  let service: SpotifyService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpotifyService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gets title and thumbnail from oEmbed', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        title: 'Never Gonna Give You Up',
        thumbnail_url: 'https://image-cdn.spotifycdn.com/x.jpg',
      }),
    );

    const info = await service.getTrackInfo('https://open.spotify.com/track/abc');

    expect(info.title).toBe('Never Gonna Give You Up');
    expect(info.thumbnailUrl).toBe('https://image-cdn.spotifycdn.com/x.jpg');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('open.spotify.com/oembed');
  });

  it('throws when oEmbed fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);

    await expect(service.getTrackInfo('https://open.spotify.com/track/abc')).rejects.toThrow('404');
  });

  it('downloads a track via oEmbed title and ytsearch1', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Flickermood Forss' }));
    (spawn as unknown as ReturnType<typeof vi.fn>).mockImplementation(((
      _cmd: string,
      args: string[],
    ) => {
      const out = args[args.indexOf('-o') + 1] ?? args[args.length - 1];
      writeFileSync(out, Buffer.from('mp3'));
      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, cb: (code: number) => void) => {
          if (event === 'close') setTimeout(() => cb(0), 0);
        },
      };
    }) as never);

    const result = await service.downloadTrack('https://open.spotify.com/track/abc');

    expect(result._tag).toBe('Right');
    const ytdlpArgs = (spawn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string[];
    expect(ytdlpArgs[ytdlpArgs.length - 1]).toBe('ytsearch1:Flickermood Forss');
  });

  it('extracts the embed trackList for albums and playlists', async () => {
    fetchMock.mockResolvedValue(htmlResponse(EMBED_HTML(TRACKLIST)));

    const tracks = await service.getTrackList('https://open.spotify.com/album/xyz');

    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toEqual({ title: 'Run Away With Me', artist: 'Carly Rae Jepsen' });
    expect(fetchMock.mock.calls[0]?.[0]).toContain('open.spotify.com/embed/album');
  });

  it('throws when the embed page has no trackList', async () => {
    fetchMock.mockResolvedValue(htmlResponse('<html>blocked</html>'));

    await expect(service.getTrackList('https://open.spotify.com/album/xyz')).rejects.toThrow();
  });

  it('exposes a shared singleton', () => {
    expect(spotifyService).toBeInstanceOf(SpotifyService);
  });
});
