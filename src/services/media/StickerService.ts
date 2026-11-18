/**
 * StickerService.ts
 *
 * OrbitBot services module exposing `StickerService`, `StickerOptions`.
 *
 * Every sticker created through `createSticker` / `imageToSticker` /
 * `videoToSticker` gets a small, semi-transparent corner watermark burned
 * into the pixels (so external `!wm` / `!take` bots cannot strip it by only
 * rewriting the EXIF block). If `./data/assets/watermark.png` and the copy
 * under `./static/assets/` are both missing, the sticker is generated without
 * watermark and a warning is logged once.
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
  /** Overlay the corner watermark. Defaults to true. */
  watermark?: boolean;
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
  /** WhatsApp rejects animated stickers above ~500KB. */
  private static readonly MAX_VIDEO_STICKER_BYTES = 450 * 1024;

  /**
   * Transparent PNG used as corner watermark. `data/` is a docker volume
   * seeded once, so files added to the image later never reach it: the copy
   * baked into the image under static/ is the durable location.
   */
  private static readonly WATERMARK_PATHS = [
    './data/assets/watermark.png',
    './static/assets/watermark.png',
  ];

  /** First existing watermark asset, or null when none is present. */
  private static get watermarkPath(): string | null {
    return StickerService.WATERMARK_PATHS.find(path => existsSync(path)) ?? null;
  }
  /** 0.0–1.0. Lower = more discreet. */
  private static readonly WATERMARK_OPACITY = 0.35;
  /** Watermark width in px (static stickers are 512px, animated ones 320px). */
  private static readonly WATERMARK_WIDTH_IMAGE = 128;
  private static readonly WATERMARK_WIDTH_VIDEO = 72;

  constructor() {
    if (!existsSync(StickerService.TEMP_DIR)) {
      mkdirSync(StickerService.TEMP_DIR, { recursive: true });
    }
    if (!StickerService.watermarkPath) {
      logger.warn(
        `[StickerService] No existe ${StickerService.WATERMARK_PATHS.join(' ni ')}, los stickers saldrán sin marca de agua`,
      );
    }
  }

  /** True when the watermark was not disabled and the asset exists on disk. */
  private canWatermark(requested: boolean | undefined): boolean {
    return requested !== false && StickerService.watermarkPath !== null;
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

  async imageToSticker(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    const tempInput = join(StickerService.TEMP_DIR, `input-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `output-${Date.now()}.webp`);
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegImageProcess(tempInput, tempOutput, options.watermark);
      const resultBuffer = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return resultBuffer;
    } catch {
      this.cleanup(tempInput, tempOutput);
      logger.warn('[StickerService] FFmpeg falló, usando jimp fallback');
      return await this.imageToStickerJimp(buffer, options);
    }
  }

  private ffmpegImageProcess(input: string, output: string, watermark?: boolean): Promise<void> {
    const watermarkPath = this.canWatermark(watermark) ? StickerService.watermarkPath : null;
    const base = 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba';
    const tail = 'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1';

    // The watermark goes on the already-scaled image and BEFORE the pad, so it
    // sits in the corner of the real content, not in the transparent padding.
    const args = watermarkPath
      ? [
          '-y',
          '-i',
          input,
          '-i',
          watermarkPath,
          '-filter_complex',
          `[0:v]${base}[v];` +
            `[1:v]scale=${StickerService.WATERMARK_WIDTH_IMAGE}:-1,format=rgba,` +
            `colorchannelmixer=aa=${StickerService.WATERMARK_OPACITY}[wm];` +
            `[v][wm]overlay=W-w-6:H-h-6:format=auto,${tail}`,
          '-f',
          'webp',
          '-quality',
          '100',
          output,
        ]
      : ['-y', '-i', input, '-vf', `${base},${tail}`, '-f', 'webp', '-quality', '100', output];

    return new Promise((resolve, reject) => {
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

  private async imageToStickerJimp(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    const { Jimp } = await import('jimp');
    const image = await Jimp.read(buffer);
    image.cover({ w: StickerService.STICKER_SIZE, h: StickerService.STICKER_SIZE });

    const tempInput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.png`);
    const tempOutput = join(StickerService.TEMP_DIR, `jimp-${Date.now()}.webp`);

    try {
      const pngBuffer = await image.getBuffer('image/png');
      writeFileSync(tempInput, pngBuffer);
      await this.ffmpegImageProcess(tempInput, tempOutput, options.watermark);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch {
      this.cleanup(tempInput, tempOutput);
      return await image.getBuffer('image/png');
    }
  }

  async videoToSticker(buffer: Buffer, options: StickerOptions = {}): Promise<Buffer> {
    const type = await this.getFileType(buffer);
    const tempInput = join(StickerService.TEMP_DIR, `video-${Date.now()}.${type?.ext || 'mp4'}`);
    const tempOutput = join(StickerService.TEMP_DIR, `sticker-${Date.now()}.webp`);
    const tempLight = `${tempOutput}.light.webp`;
    try {
      writeFileSync(tempInput, buffer);
      await this.ffmpegVideoProcess(tempInput, tempOutput, 15, 75, options.watermark);
      let resultBuffer = readFileSync(tempOutput);
      // WhatsApp rejects animated stickers over ~500KB; re-encode lighter once.
      if (resultBuffer.length > StickerService.MAX_VIDEO_STICKER_BYTES) {
        await this.ffmpegVideoProcess(tempInput, tempLight, 10, 50, options.watermark);
        resultBuffer = readFileSync(tempLight);
      }
      this.cleanup(tempInput, tempOutput, tempLight);
      return resultBuffer;
    } catch (error) {
      this.cleanup(tempInput, tempOutput, tempLight);
      throw error;
    }
  }

  private ffmpegVideoProcess(
    input: string,
    output: string,
    fps = 15,
    qscale = 75,
    watermark?: boolean,
  ): Promise<void> {
    const watermarkPath = this.canWatermark(watermark) ? StickerService.watermarkPath : null;

    const scale = `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=${fps}`;
    const tail =
      'pad=320:320:-1:-1:color=white@0.0,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse';

    // Input-side cut: palettegen otherwise swallows the WHOLE video
    // building its palette, so long videos blew the command timeout.
    const inputs = watermarkPath
      ? ['-t', '10', '-i', input, '-i', watermarkPath]
      : ['-t', '10', '-i', input];

    // The watermark enters before palettegen, so it is part of the palette.
    const filter = watermarkPath
      ? [
          '-filter_complex',
          `[0:v]${scale},format=rgba[v];` +
            `[1:v]scale=${StickerService.WATERMARK_WIDTH_VIDEO}:-1,format=rgba,` +
            `colorchannelmixer=aa=${StickerService.WATERMARK_OPACITY}[wm];` +
            `[v][wm]overlay=W-w-4:H-h-4:format=auto,${tail}`,
        ]
      : ['-vf', `${scale},${tail}`];

    const args = [
      '-y',
      ...inputs,
      ...filter,
      '-vcodec',
      'libwebp',
      '-lossless',
      '0',
      '-qscale',
      String(qscale),
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

    return new Promise((resolve, reject) => {
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
        // checkFFmpeg returns false by design, but the reason (missing binary,
        // lack of permissions) used to be completely invisible.
        logger.debug(`[StickerService] ffmpeg probe failed: ${error.message}`);
        resolve(false);
      });
    });
  }
}
