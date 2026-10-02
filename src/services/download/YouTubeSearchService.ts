/**
 * YouTubeSearchService.ts
 *
 * VaniaBot services module exposing `YouTubeVideo`.
 *
 * @author **Carlos G**
 */

import { logError, logger } from '@/utils/logger.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { secondsToHMS } from '@/utils/helpers.js';

const execFileAsync = promisify(execFile);

export interface YouTubeVideo {
  videoId: string;
  title: string;
  duration: string;
  thumbnail: string;
  url: string;
  channel?: string;
  viewCount?: number;
  likeCount?: number;
}

async function searchWithYtDlp(query: string): Promise<YouTubeVideo | null> {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      [
        'ytsearch1:' + query,
        '--dump-json',
        '--no-playlist',
        '--skip-download',
        '--quiet',
        '--no-warnings',
      ],
      { timeout: 20000 },
    );

    const data = JSON.parse(stdout.trim());
    return {
      videoId: data.id,
      title: data.title,
      duration: secondsToHMS(data.duration ?? 0),
      thumbnail: data.thumbnail ?? `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
      url: `https://youtu.be/${data.id}`,
      channel: data.uploader ?? data.channel ?? undefined,
      viewCount: data.view_count ?? undefined,
      likeCount: data.like_count ?? undefined,
    };
  } catch (error) {
    logError('yt-dlp search', error);
    return null;
  }
}

async function getVideoInfoWithYtDlp(urlOrId: string): Promise<YouTubeVideo | null> {
  try {
    const videoId = extractVideoId(urlOrId);
    const searchQuery = videoId ? `https://youtu.be/${videoId}` : urlOrId;

    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--dump-json', '--no-playlist', '--skip-download', '--quiet', '--no-warnings', searchQuery],
      { timeout: 20000 },
    );

    const data = JSON.parse(stdout.trim());
    return {
      videoId: data.id,
      title: data.title,
      duration: secondsToHMS(data.duration ?? 0),
      thumbnail: data.thumbnail ?? `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
      url: `https://youtu.be/${data.id}`,
      channel: data.uploader ?? data.channel ?? undefined,
      viewCount: data.view_count ?? undefined,
      likeCount: data.like_count ?? undefined,
    };
  } catch (error) {
    logError('yt-dlp getVideoInfo', error);
    return null;
  }
}

export async function searchVideo(query: string): Promise<YouTubeVideo | null> {
  logger.debug(`[YouTube] Searching: ${query}`);

  if (query.includes('youtube.com') || query.includes('youtu.be')) {
    return await getVideoInfoWithYtDlp(query);
  }

  return await searchWithYtDlp(query);
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
