/**
 * GifToMp4.ts
 *
 * Shared gif→mp4 conversion with a disk cache, used by the reaction services
 * (nekos.best, purrbot). WhatsApp cannot play raw GIFs with gifPlayback, so
 * every unique gif is downloaded, converted once with ffmpeg and cached in
 * TEMP_DIR keyed by its file name.
 *
 * @author **Carlos G**
 * @created 2026-11-17
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEMP_DIR = './data/temp';

/** Downloads a gif URL and returns the converted mp4 Buffer (cached). */
export async function gifUrlToMp4(url: string): Promise<Buffer> {
  const gifName = url.split('/').pop() ?? `${Date.now()}.gif`;
  const mp4Path = join(TEMP_DIR, `gifmp4-${gifName.replace(/\.gif$/, '')}.mp4`);

  if (existsSync(mp4Path)) {
    return readFileSync(mp4Path);
  }

  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  const controller = new AbortController();
  // cdn.purrbot.site is slow from this server (~30s for 2MB); nekos.best is
  // fast but shares the pipeline, so keep one generous timeout.
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  let gifBuffer: Buffer;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OrbitBot/7.4 (WhatsApp bot)' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`gif download failed (${response.status})`);
    }
    gifBuffer = Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeoutId);
  }

  const tempGif = join(TEMP_DIR, `gifmp4-${gifName}`);
  writeFileSync(tempGif, gifBuffer);
  try {
    await convertGifToMp4(tempGif, mp4Path);
    return readFileSync(mp4Path);
  } finally {
    try {
      unlinkSync(tempGif);
    } catch {
      // best-effort cleanup
    }
  }
}

function convertGifToMp4(input: string, output: string): Promise<void> {
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
