/**
 * NekosBestService.ts
 *
 * Client for nekos.best — the replacement for the dead Delirius reactions
 * and Prince Techn animebase endpoints (verified alive 17-nov-2026).
 *
 * The API serves reaction GIFs as .gif files; WhatsApp only plays video
 * messages with gifPlayback, so GIF categories are downloaded and converted
 * to mp4 once (ffmpeg), then cached on disk by their unique id.
 *
 * The docs require a well-formed User-Agent on every request.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const TIMEOUT_MS = 20000;
const USER_AGENT = 'OrbitBot/7.3 (WhatsApp bot; nekos.best client)';

export class NekosBestService {
  private readonly BASE = 'https://nekos.best/api/v2';
  private readonly TEMP_DIR = './data/temp';

  /** Image URL for an image category (neko, waifu, kitsune, husbando…). */
  async getImageUrl(category: string): Promise<string> {
    const data = await this.fetchJson(category);
    const url = data.results?.[0]?.url;
    if (!url) throw new Error(`nekos.best: no url for '${category}'`);
    return url;
  }

  /**
   * GIF category → mp4 Buffer, ready for `gifPlayback` sending. Converted
   * results are cached in TEMP_DIR keyed by the gif's unique file name.
   */
  async getReactionVideo(category: string): Promise<Buffer> {
    const url = await this.getImageUrl(category);
    const gifName = url.split('/').pop() ?? `${category}.gif`;
    const mp4Path = join(this.TEMP_DIR, `nk-${gifName.replace(/\.gif$/, '')}.mp4`);

    if (existsSync(mp4Path)) {
      return readFileSync(mp4Path);
    }

    if (!existsSync(this.TEMP_DIR)) {
      mkdirSync(this.TEMP_DIR, { recursive: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let gifBuffer: Buffer;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`nekos.best: image download failed (${response.status})`);
      }
      gifBuffer = Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timeoutId);
    }

    const tempGif = join(this.TEMP_DIR, `nk-${gifName}`);
    writeFileSync(tempGif, gifBuffer);
    try {
      await this.convertGifToMp4(tempGif, mp4Path);
      return readFileSync(mp4Path);
    } finally {
      try {
        unlinkSync(tempGif);
      } catch {
        // best-effort cleanup
      }
    }
  }

  private async fetchJson(category: string): Promise<{ results?: Array<{ url?: string }> }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.BASE}/${category}?amount=1`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`nekos.best error: ${response.status}`);
      }
      return (await response.json()) as { results?: Array<{ url?: string }> };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private convertGifToMp4(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i',
        input,
        '-movflags',
        'faststart',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-r',
        '15',
        output,
      ]);
      let stderr = '';
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-200)}`));
      });
      ffmpeg.on('error', reject);
    });
  }
}

export const nekosBestService = new NekosBestService();
