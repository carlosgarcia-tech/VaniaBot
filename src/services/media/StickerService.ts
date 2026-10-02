/**
 * StickerService.ts
 *
 * VaniaBot services module exposing `StickerService`, `StickerOptions`.
 *
 * @author **Carlos G**
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { logError, logger } from '@/utils/logger.js';

export interface StickerOptions {
  pack?: string;
  author?: string;
  categories?: string[];
  quality?: number;
  type?: 'full' | 'crop' | 'circle';
}

interface FileTypeResult {
  ext: string;
  mime: string;
}
interface FileTypeModule {
  fileTypeFromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  fromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  default?: {
    fromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
    fileTypeFromBuffer?: (buffer: Buffer) => Promise<FileTypeResult | undefined>;
  };
}

export class StickerService {
  private static readonly TEMP_DIR = './data/temp';
  private static readonly STICKER_SIZE = 512;

  constructor() {
    if (!existsSync(StickerService.TEMP_DIR)) {
      mkdirSync(StickerService.TEMP_DIR, { recursive: true });
    }
  }

  private async getFileType(buffer: Buffer): Promise<{ mime: string; ext: string } | null> {
    try {
      const fileType = (await import('file-type')) as FileTypeModule;
      let result: FileTypeResult | undefined;
      if (fileType.fileTypeFromBuffer) result = await fileType.fileTypeFromBuffer(buffer);
      else if (fileType.fromBuffer) result = await fileType.fromBuffer(buffer);
      else if (fileType.default?.fromBuffer) result = await fileType.default.fromBuffer(buffer);
      else if (fileType.default?.fileTypeFromBuffer)
        result = await fileType.default.fileTypeFromBuffer(buffer);
      else return { mime: 'image/jpeg', ext: 'jpg' };
      return result || { mime: 'image/jpeg', ext: 'jpg' };
    } catch {
      return { mime: 'image/jpeg', ext: 'jpg' };
    }
  }

  async createSticker(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    const type = await this.getFileType(buffer);
    const isVideo = type?.mime.includes('video') || type?.ext === 'gif';
    if (isVideo) return await this.videoToSticker(buffer, options);
    return await this.imageToSticker(buffer, options);
  }

  async addExif(buffer: Buffer, pack: string, author: string): Promise<Buffer> {
    return await this.addExifManual(buffer, pack, author);
  }

  private async addExifManual(buffer: Buffer, pack: string, author: string): Promise<Buffer> {
    try {
      const webp = await import('node-webpmux');
      const Image = webp.default?.Image ?? webp.Image;
      const img = new Image();

      const packJson = JSON.stringify({
        'sticker-pack-name': pack,
        'sticker-pack-publisher': author,
        emojis: [''],
      });

      const jsonBuffer = Buffer.from(packJson, 'utf8');

      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);

      const exif = Buffer.concat([exifAttr, jsonBuffer]);
      exif.writeUIntLE(jsonBuffer.length, 14, 4);

      await img.load(buffer);
      img.exif = exif;
      return await img.save(null);
    } catch (e) {
      logError('[StickerService] addExifManual error', e);
      return buffer;
    }
  }

  async imageToSticker(buffer: Buffer, _options: StickerOptions = {}): Promise<Buffer> {
    const tempInput = join(StickerService.TEMP_DIR, `input-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `output-${Date.now()}.webp`);
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegImageProcess(tempInput, tempOutput);
      const resultBuffer = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return resultBuffer;
    } catch {
      this.cleanup(tempInput, tempOutput);
      logger.warn('[StickerService] FFmpeg falló, usando jimp fallback');
      return await this.imageToStickerJimp(buffer);
    }
  }

  private ffmpegImageProcess(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        input,
        '-vf',
        'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1',
        '-f',
        'webp',
        '-quality',
        '100',
        output,
      ];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${stderr}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  private async imageToStickerJimp(buffer: Buffer): Promise<Buffer> {
    const { Jimp } = await import('jimp');
    const image = await Jimp.read(buffer);
    image.cover({ w: StickerService.STICKER_SIZE, h: StickerService.STICKER_SIZE });

    const tempInput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.webp`);

    try {
      const pngBuffer = await image.getBuffer('image/png');
      writeFileSync(tempInput, pngBuffer);
      await this.ffmpegImageProcess(tempInput, tempOutput);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch {
      this.cleanup(tempInput, tempOutput);
      return await image.getBuffer('image/png');
    }
  }

  async videoToSticker(buffer: Buffer, _options: StickerOptions = {}): Promise<Buffer> {
    const type = await this.getFileType(buffer);
    const tempInput = join(StickerService.TEMP_DIR, `video-${Date.now()}.${type?.ext || 'mp4'}`);
    const tempOutput = join(StickerService.TEMP_DIR, `sticker-${Date.now()}.webp`);
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegVideoProcess(tempInput, tempOutput);
      const resultBuffer = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return resultBuffer;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  private ffmpegVideoProcess(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        input,
        '-vf',
        "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
        '-vcodec',
        'libwebp',
        '-lossless',
        '0',
        '-qscale',
        '75',
        '-preset',
        'default',
        '-loop',
        '0',
        '-an',
        '-vsync',
        '0',
        '-t',
        '00:00:10',
        output,
      ];
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        code === 0 ? resolve() : reject(new Error(`FFmpeg video failed: ${stderr}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    files.forEach(file => {
      try {
        if (existsSync(file)) unlinkSync(file);
      } catch (error) {
        logger.debug(`[StickerService] No se pudo eliminar el temporal ${file}:`, error);
      }
    });
  }

  async checkFFmpeg(): Promise<boolean> {
    return new Promise(resolve => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('close', code => resolve(code === 0));
      ffmpeg.on('error', error => {
        // checkFFmpeg devuelve false por diseño, pero el motivo (no existe,
        // sin permisos) quedaba totalmente invisible.
        logger.debug(`[StickerService] ffmpeg probe failed: ${error.message}`);
        resolve(false);
      });
    });
  }
}
