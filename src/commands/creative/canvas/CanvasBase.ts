/**
 * CanvasBase.ts
 *
 * VaniaBot commands module exposing `CanvasBase`.
 *
 * @author **Carlos G**
 */

import { canvasService } from '@/services/external/CanvasService.js';
import { logError } from '@/utils/logger.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { MessageContext } from '@/types/index.js';

const execFileAsync = promisify(execFile);

/**
 * Convierte un buffer WebM a WebP animado usando ffmpeg.
 * WhatsApp solo acepta stickers animados en formato WebP.
 */
async function webmToAnimatedWebP(webmBuffer: Buffer): Promise<Buffer> {
  const id = `canvas_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputPath = join(tmpdir(), `${id}.webm`);
  const outputPath = join(tmpdir(), `${id}.webp`);

  try {
    await writeFile(inputPath, webmBuffer);

    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      '-loop',
      '0',
      '-lossless',
      '0',
      '-quality',
      '80',
      '-preset',
      'default',
      '-an',
      outputPath,
    ]);

    const webpBuffer = await readFile(outputPath);
    return webpBuffer;
  } finally {
    await unlink(inputPath).catch((error: unknown) => logError('[CanvasBase]', error));
    await unlink(outputPath).catch((error: unknown) => logError('[CanvasBase]', error));
  }
}

export class CanvasBase {
  public async getImageUrl(endpoint: string, params?: Record<string, string>): Promise<string> {
    return canvasService.getImage(endpoint, params);
  }

  public async sendImage(
    ctx: MessageContext,
    endpoint: string,
    params?: Record<string, string>,
  ): Promise<void> {
    try {
      const result = await canvasService.getResult(endpoint, params);

      if (result.type === 'url') {
        await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: result.url } });
        await ctx.react('✅');
        return;
      }

      const { buffer, contentType } = result;
      const isWebM = contentType.includes('webm') || contentType.includes('video');
      const isGif = contentType.includes('gif');
      const isAnimated = isWebM || isGif;

      if (isAnimated) {
        const webpBuffer = await webmToAnimatedWebP(buffer);
        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: webpBuffer,
          mimetype: 'image/webp',
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: buffer,
          mimetype: contentType,
        });
      }

      await ctx.react('✅');
    } catch (error) {
      logError('[CanvasBase]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }

  public async sendImageWithCaption(
    ctx: MessageContext,
    endpoint: string,
    params?: Record<string, string>,
    caption?: string,
  ): Promise<void> {
    try {
      const result = await canvasService.getResult(endpoint, params);

      if (result.type === 'url') {
        await ctx.sock.sendMessage(ctx.chat.jid, { image: { url: result.url }, caption });
        await ctx.react('✅');
        return;
      }

      const { buffer, contentType } = result;
      const isWebM = contentType.includes('webm') || contentType.includes('video');
      const isGif = contentType.includes('gif');
      const isAnimated = isWebM || isGif;

      if (isAnimated) {
        if (caption) {
          await ctx.sock.sendMessage(ctx.chat.jid, { text: caption });
        }
        const webpBuffer = await webmToAnimatedWebP(buffer);
        await ctx.sock.sendMessage(ctx.chat.jid, {
          sticker: webpBuffer,
          mimetype: 'image/webp',
        });
      } else {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: buffer,
          caption,
          mimetype: contentType,
        });
      }

      await ctx.react('✅');
    } catch (error) {
      logError('[CanvasBase]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }
}
