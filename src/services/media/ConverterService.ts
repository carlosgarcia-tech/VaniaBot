import { Jimp } from 'jimp';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { logError, logger } from '@/utils/logger.js';

const execAsync = promisify(exec);

export type ImageFormat = 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'tif';

export const FORMAT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export const FORMAT_EXT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  tiff: 'tiff',
  tif: 'tiff',
};

const CANONICAL: Record<string, ImageFormat> = {
  jpeg: 'jpeg',
  jpg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  tiff: 'tiff',
  tif: 'tiff',
};

export function normalizeFormat(format: string): ImageFormat {
  const f = format.toLowerCase();
  const canonical = CANONICAL[f];
  if (!canonical)
    throw new Error(`Formato no soportado: "${format}". Usa: jpeg, png, webp, gif, bmp, tiff`);
  return canonical;
}

export function getFormatMime(format: ImageFormat): string {
  return FORMAT_MIME[format] ?? 'application/octet-stream';
}

export function getFormatExt(format: ImageFormat): string {
  return FORMAT_EXT[format] ?? format;
}

export type OverlayPosition = 'br' | 'bl' | 'tr' | 'tl' | 'center';

export type WatermarkMode = 'single' | 'tile';

export type BackgroundRemoval = 'auto' | 'white' | 'black' | 'none';

function overlayCoords(position: OverlayPosition, padding: number): { x: string; y: string } {
  const p = String(padding);
  switch (position) {
    case 'br':
      return { x: `W-w-${p}`, y: `H-h-${p}` };
    case 'bl':
      return { x: p, y: `H-h-${p}` };
    case 'tr':
      return { x: `W-w-${p}`, y: p };
    case 'tl':
      return { x: p, y: p };
    case 'center':
      return { x: '(W-w)/2', y: '(H-h)/2' };
  }
}

/**
 * Samplea las 4 esquinas del logo para determinar si tiene un fondo sólido
 * blanco o negro (caso típico de logos exportados sin transparencia).
 * Si el logo ya tiene transparencia real, o las esquinas no son uniformes,
 * devuelve 'none' y no se toca nada.
 */
async function detectBackgroundColor(buffer: Buffer): Promise<'white' | 'black' | 'none'> {
  try {
    const img = await Jimp.read(buffer);
    const w = img.width;
    const h = img.height;
    const margin = Math.max(1, Math.floor(Math.min(w, h) * 0.02));

    const points: Array<[number, number]> = [
      [margin, margin],
      [w - 1 - margin, margin],
      [margin, h - 1 - margin],
      [w - 1 - margin, h - 1 - margin],
    ];

    const decode = (hex: number) => ({
      r: (hex >>> 24) & 0xff,
      g: (hex >>> 16) & 0xff,
      b: (hex >>> 8) & 0xff,
      a: hex & 0xff,
    });

    const corners = points.map(([x, y]) => decode(img.getPixelColor(x, y)));

    const hasTransparency = corners.some(c => c.a < 200);
    if (hasTransparency) return 'none';

    const allWhite = corners.every(c => c.r > 235 && c.g > 235 && c.b > 235);
    if (allWhite) return 'white';

    const allBlack = corners.every(c => c.r < 20 && c.g < 20 && c.b < 20);
    if (allBlack) return 'black';

    return 'none';
  } catch (error) {
    logError('[ConverterService] detectBackgroundColor', error);
    return 'none';
  }
}

export class ConverterService {
  private static readonly TEMP_DIR = './data/temp';
  private static ffmpegAvailable: boolean | null = null;

  constructor() {
    if (!existsSync(ConverterService.TEMP_DIR)) {
      mkdirSync(ConverterService.TEMP_DIR, { recursive: true });
    }
  }

  static async isFFmpegAvailable(): Promise<boolean> {
    if (ConverterService.ffmpegAvailable !== null) return ConverterService.ffmpegAvailable;
    try {
      await execAsync('ffmpeg -version');
      ConverterService.ffmpegAvailable = true;
    } catch {
      ConverterService.ffmpegAvailable = false;
      logger.warn('[ConverterService] FFmpeg not available');
    }
    return ConverterService.ffmpegAvailable;
  }

  async convertImage(
    buffer: Buffer,
    format: ImageFormat,
    options?: { quality?: number },
  ): Promise<Buffer> {
    const canonical = normalizeFormat(format);
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegConvertImage(buffer, canonical, options?.quality ?? 90);
      } catch (error) {
        logError('ConverterService.convertImage (ffmpeg)', error);
      }
    }

    return this.convertImageJimp(buffer, canonical, options?.quality);
  }

  private async ffmpegConvertImage(
    buffer: Buffer,
    format: ImageFormat,
    quality: number,
  ): Promise<Buffer> {
    const tempInput = join(ConverterService.TEMP_DIR, `conv-in-${Date.now()}.img`);
    const ext = format === 'jpeg' ? 'jpg' : format;
    const tempOutput = join(ConverterService.TEMP_DIR, `conv-out-${Date.now()}.${ext}`);

    try {
      writeFileSync(tempInput, buffer);

      let args: string[];
      switch (format) {
        case 'jpeg':
          args = [
            '-y',
            '-i',
            tempInput,
            '-qscale:v',
            String(this.qualityToJpegQScale(quality)),
            '-frames:v',
            '1',
            tempOutput,
          ];
          break;
        case 'png':
          args = ['-y', '-i', tempInput, '-compression_level', '9', tempOutput];
          break;
        case 'webp':
          args = ['-y', '-i', tempInput, '-quality', String(quality), tempOutput];
          break;
        case 'gif':
          args = ['-y', '-i', tempInput, '-c:v', 'gif', tempOutput];
          break;
        case 'bmp':
          args = ['-y', '-i', tempInput, '-c:v', 'bmp', tempOutput];
          break;
        case 'tiff':
          args = ['-y', '-i', tempInput, '-c:v', 'tiff', '-compression_algo', 'lzw', tempOutput];
          break;
        default:
          throw new Error(`Formato no soportado por ffmpeg: ${format}`);
      }

      await this.runFFmpeg(args);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  private qualityToJpegQScale(quality: number): number {
    const q = Math.max(0, Math.min(100, quality));
    return Math.round(31 - (q / 100) * 29);
  }

  private async convertImageJimp(
    buffer: Buffer,
    format: ImageFormat,
    _quality: number = 90,
  ): Promise<Buffer> {
    const image = await Jimp.read(buffer);

    switch (format) {
      case 'jpeg':
        return await image.getBuffer('image/jpeg');
      case 'png':
        return await image.getBuffer('image/png');
      case 'webp':
        logger.warn('[ConverterService] webp sin ffmpeg no soportado, devolviendo PNG');
        return await image.getBuffer('image/png');
      case 'gif':
        return await image.getBuffer('image/gif');
      case 'bmp':
        return await image.getBuffer('image/bmp');
      case 'tiff':
        return await image.getBuffer('image/tiff');
      default:
        return await image.getBuffer('image/png');
    }
  }

  async resizeImage(
    buffer: Buffer,
    width?: number,
    height?: number,
    options?: { fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' },
  ): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegResizeImage(buffer, width, height, options?.fit ?? 'inside');
      } catch (error) {
        logError('ConverterService.resizeImage (ffmpeg)', error);
      }
    }

    return this.resizeImageJimp(buffer, width, height);
  }

  private async ffmpegResizeImage(
    buffer: Buffer,
    width: number | undefined,
    height: number | undefined,
    fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside',
  ): Promise<Buffer> {
    const tempInput = join(ConverterService.TEMP_DIR, `resize-in-${Date.now()}.img`);
    const tempOutput = join(ConverterService.TEMP_DIR, `resize-out-${Date.now()}.png`);

    try {
      writeFileSync(tempInput, buffer);

      const w = width ?? -1;
      const h = height ?? -1;

      let scaleFilter: string;
      switch (fit) {
        case 'fill':
          scaleFilter = `scale=${w}:${h}`;
          break;
        case 'cover':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
          break;
        case 'contain':
        case 'inside':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=decrease`;
          break;
        case 'outside':
          scaleFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase`;
          break;
        default:
          scaleFilter = `scale=${w}:${h}`;
      }

      await this.runFFmpeg(['-y', '-i', tempInput, '-vf', scaleFilter, tempOutput]);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  private async resizeImageJimp(buffer: Buffer, width?: number, height?: number): Promise<Buffer> {
    const image = await Jimp.read(buffer);

    if (width && height) {
      image.cover({ w: width, h: height });
    } else if (width) {
      image.resize({ w: width });
    } else if (height) {
      image.resize({ h: height });
    }

    return await image.getBuffer('image/png');
  }

  async compressImage(buffer: Buffer, quality: number = 70, maxSizeKB?: number): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (maxSizeKB !== undefined && ffmpegAvailable) {
      return this.compressToTargetSize(buffer, quality, maxSizeKB);
    }

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegConvertImage(buffer, 'jpeg', quality);
      } catch (error) {
        logError('ConverterService.compressImage (ffmpeg)', error);
      }
    }

    return this.compressImageJimp(buffer, quality);
  }

  private async compressToTargetSize(
    buffer: Buffer,
    startQuality: number,
    maxSizeKB: number,
  ): Promise<Buffer> {
    let low = 1;
    let high = 99;
    let best = buffer;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const compressed = await this.ffmpegConvertImage(buffer, 'jpeg', mid);
      const sizeKB = compressed.length / 1024;

      if (sizeKB <= maxSizeKB) {
        best = compressed;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return best;
  }

  private async compressImageJimp(buffer: Buffer, _quality: number = 70): Promise<Buffer> {
    const image = await Jimp.read(buffer);
    return await image.getBuffer('image/jpeg');
  }

  /**
   * Superpone `logo` sobre `background`.
   *
   * @param options.mode          'single' (default) coloca un solo logo. 'tile' lo repite
   *                              en una grilla por toda la imagen.
   * @param options.tileRows/tileCols  tamaño de la grilla en modo 'tile' (default 3x3).
   * @param options.opacity       0 a 1 (default 0.85 en 'single', 0.35 en 'tile').
   * @param options.removeBackground  'auto' (default) detecta y quita fondo blanco/negro sólido,
   *                                  'white' | 'black' fuerzan ese color, 'none' lo desactiva.
   */
  async overlayImage(
    background: Buffer,
    logo: Buffer,
    options?: {
      position?: OverlayPosition;
      scale?: number;
      padding?: number;
      opacity?: number;
      removeBackground?: BackgroundRemoval;
      mode?: WatermarkMode;
      tileRows?: number;
      tileCols?: number;
    },
  ): Promise<Buffer> {
    const mode = options?.mode ?? 'single';
    const position = options?.position ?? 'br';
    const padding = options?.padding ?? 10;
    const removeBackground = options?.removeBackground ?? 'auto';

    const scale = options?.scale ?? (mode === 'tile' ? 0.15 : 0.2);
    const opacity = Math.max(0, Math.min(1, options?.opacity ?? (mode === 'tile' ? 0.35 : 0.85)));
    const tileRows = Math.max(1, options?.tileRows ?? 3);
    const tileCols = Math.max(1, options?.tileCols ?? 3);

    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();

    if (mode === 'tile') {
      if (ffmpegAvailable) {
        try {
          return await this.ffmpegTileOverlay(
            background,
            logo,
            scale,
            opacity,
            removeBackground,
            tileRows,
            tileCols,
          );
        } catch (error) {
          logError('ConverterService.overlayImage (ffmpeg tile)', error);
        }
      }
      return this.jimpTileOverlay(
        background,
        logo,
        scale,
        opacity,
        removeBackground,
        tileRows,
        tileCols,
      );
    }

    if (ffmpegAvailable) {
      try {
        return await this.ffmpegOverlay(
          background,
          logo,
          position,
          scale,
          padding,
          opacity,
          removeBackground,
        );
      } catch (error) {
        logError('ConverterService.overlayImage (ffmpeg)', error);
      }
    }

    return this.overlayImageJimp(
      background,
      logo,
      position,
      scale,
      padding,
      opacity,
      removeBackground,
    );
  }

  private async ffmpegOverlay(
    background: Buffer,
    logo: Buffer,
    position: OverlayPosition,
    scale: number,
    padding: number,
    opacity: number,
    removeBackground: BackgroundRemoval,
  ): Promise<Buffer> {
    const id = Date.now();
    const bgInput = join(ConverterService.TEMP_DIR, `ol-bg-${id}.img`);
    const logoInput = join(ConverterService.TEMP_DIR, `ol-logo-${id}.img`);
    const tempOutput = join(ConverterService.TEMP_DIR, `ol-out-${id}.png`);

    try {
      writeFileSync(bgInput, background);
      writeFileSync(logoInput, logo);

      const pct = Math.round(scale * 100);
      const coords = overlayCoords(position, padding);

      let bgColorToKey: 'white' | 'black' | 'none' = 'none';
      if (removeBackground === 'auto') {
        bgColorToKey = await detectBackgroundColor(logo);
      } else if (removeBackground === 'white' || removeBackground === 'black') {
        bgColorToKey = removeBackground;
      }

      const colorkeyPart = bgColorToKey !== 'none' ? `,colorkey=${bgColorToKey}:0.15:0.20` : '';

      const filter =
        `[1:v]scale=${pct}*iw/100:-1,format=rgba${colorkeyPart},` +
        `colorchannelmixer=aa=${opacity}[logo];[0:v][logo]overlay=${coords.x}:${coords.y}`;

      const args = ['-y', '-i', bgInput, '-i', logoInput, '-filter_complex', filter, tempOutput];

      await this.runFFmpeg(args);
      const result = readFileSync(tempOutput);
      this.cleanup(bgInput, logoInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(bgInput, logoInput, tempOutput);
      throw error;
    }
  }

  private async overlayImageJimp(
    background: Buffer,
    logo: Buffer,
    position: OverlayPosition,
    scale: number,
    padding: number,
    opacity: number,
    removeBackground: BackgroundRemoval,
  ): Promise<Buffer> {
    const bg = await Jimp.read(background);
    const overlay = await Jimp.read(logo);

    const logoW = Math.round(bg.width * scale);
    overlay.resize({ w: logoW });

    let bgColorToKey: 'white' | 'black' | 'none' = 'none';
    if (removeBackground === 'auto') {
      bgColorToKey = await detectBackgroundColor(logo);
    } else if (removeBackground === 'white' || removeBackground === 'black') {
      bgColorToKey = removeBackground;
    }

    this.applyBackgroundKeyAndOpacity(overlay, bgColorToKey, opacity);

    const coords = overlayCoords(position, padding);
    const parseExpr = (expr: string): number => {
      const val = expr
        .replace(/W/g, String(bg.width))
        .replace(/H/g, String(bg.height))
        .replace(/w/g, String(overlay.width))
        .replace(/h/g, String(overlay.height));
      try {
        return Function(`"use strict"; return (${val})`)();
      } catch {
        return Number(val) || 0;
      }
    };

    const x = parseExpr(coords.x);
    const y = parseExpr(coords.y);

    bg.composite(overlay, x, y);
    return await bg.getBuffer('image/png');
  }

  /**
   * Repite el logo en una grilla (rows x cols) por toda la imagen usando ffmpeg.
   * Procesa el logo UNA vez (resize + colorkey + opacidad) y lo duplica con
   * `split` para poder pegarlo en cada celda de la grilla con `overlay` encadenados.
   * Las posiciones usan fracciones de W/H (resueltas por ffmpeg), así que no
   * hace falta conocer el tamaño real del fondo desde JS.
   */
  private async ffmpegTileOverlay(
    background: Buffer,
    logo: Buffer,
    scale: number,
    opacity: number,
    removeBackground: BackgroundRemoval,
    rows: number,
    cols: number,
  ): Promise<Buffer> {
    const id = Date.now();
    const bgInput = join(ConverterService.TEMP_DIR, `tile-bg-${id}.img`);
    const logoInput = join(ConverterService.TEMP_DIR, `tile-logo-${id}.img`);
    const tempOutput = join(ConverterService.TEMP_DIR, `tile-out-${id}.png`);

    try {
      writeFileSync(bgInput, background);
      writeFileSync(logoInput, logo);

      const pct = Math.round(scale * 100);

      let bgColorToKey: 'white' | 'black' | 'none' = 'none';
      if (removeBackground === 'auto') {
        bgColorToKey = await detectBackgroundColor(logo);
      } else if (removeBackground === 'white' || removeBackground === 'black') {
        bgColorToKey = removeBackground;
      }
      const colorkeyPart = bgColorToKey !== 'none' ? `,colorkey=${bgColorToKey}:0.15:0.20` : '';

      const total = rows * cols;
      const splitLabels = Array.from({ length: total }, (_, i) => `[l${i}]`).join('');

      let filter =
        `[1:v]scale=${pct}*iw/100:-1,format=rgba${colorkeyPart},` +
        `colorchannelmixer=aa=${opacity}[logoproc];` +
        `[logoproc]split=${total}${splitLabels};`;

      let current = '[0:v]';
      let idx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fracX = (c + 0.5) / cols;
          const fracY = (r + 0.5) / rows;
          const isLast = idx === total - 1;
          const outLabel = isLast ? '' : `[tmp${idx}]`;
          filter += `${current}[l${idx}]overlay=W*${fracX}-w/2:H*${fracY}-h/2${outLabel};`;
          current = isLast ? '' : `[tmp${idx}]`;
          idx++;
        }
      }
      filter = filter.replace(/;$/, '');

      const args = ['-y', '-i', bgInput, '-i', logoInput, '-filter_complex', filter, tempOutput];

      await this.runFFmpeg(args);
      const result = readFileSync(tempOutput);
      this.cleanup(bgInput, logoInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(bgInput, logoInput, tempOutput);
      throw error;
    }
  }

  /**
   * Fallback sin ffmpeg: procesa el logo una vez (resize + key + opacidad) y lo
   * pega repetidas veces en una grilla usando las dimensiones reales del fondo.
   */
  private async jimpTileOverlay(
    background: Buffer,
    logo: Buffer,
    scale: number,
    opacity: number,
    removeBackground: BackgroundRemoval,
    rows: number,
    cols: number,
  ): Promise<Buffer> {
    const bg = await Jimp.read(background);
    const overlay = await Jimp.read(logo);

    const logoW = Math.round(bg.width * scale);
    overlay.resize({ w: logoW });

    let bgColorToKey: 'white' | 'black' | 'none' = 'none';
    if (removeBackground === 'auto') {
      bgColorToKey = await detectBackgroundColor(logo);
    } else if (removeBackground === 'white' || removeBackground === 'black') {
      bgColorToKey = removeBackground;
    }
    this.applyBackgroundKeyAndOpacity(overlay, bgColorToKey, opacity);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fracX = (c + 0.5) / cols;
        const fracY = (r + 0.5) / rows;
        const x = Math.round(bg.width * fracX - overlay.width / 2);
        const y = Math.round(bg.height * fracY - overlay.height / 2);
        bg.composite(overlay, x, y);
      }
    }

    return await bg.getBuffer('image/png');
  }

  /**
   * Recorre los píxeles del logo (ya redimensionado) y:
   *  1. Pone alpha=0 en los píxeles que coincidan con el fondo sólido a remover.
   *  2. Multiplica el alpha restante por `opacity` para bajar la opacidad general.
   */
  private applyBackgroundKeyAndOpacity(
    image: { bitmap: { data: Buffer; width: number; height: number } },
    bgColor: 'white' | 'black' | 'none',
    opacity: number,
  ): void {
    const threshold = 30;
    const { data } = image.bitmap;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let a = data[i + 3];

      if (
        bgColor === 'white' &&
        r > 255 - threshold &&
        g > 255 - threshold &&
        b > 255 - threshold
      ) {
        a = 0;
      } else if (bgColor === 'black' && r < threshold && g < threshold && b < threshold) {
        a = 0;
      }

      data[i + 3] = Math.round(a * opacity);
    }
  }

  async convertVideoToMP4(buffer: Buffer): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir video.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.mp4`);

    try {
      writeFileSync(tempInput, buffer);
      await this.runFFmpeg([
        '-y',
        '-i',
        tempInput,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        tempOutput,
      ]);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.convertVideoToMP4', error);
      throw new Error('Error convirtiendo video. FFmpeg puede no estar instalado.');
    }
  }

  async extractAudioFromVideo(buffer: Buffer, format: 'mp3' | 'ogg' = 'mp3'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede extraer audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      const args =
        format === 'mp3'
          ? ['-y', '-i', tempInput, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', tempOutput]
          : ['-y', '-i', tempInput, '-vn', '-c:a', 'libvorbis', tempOutput];

      await this.runFFmpeg(args);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.extractAudioFromVideo', error);
      throw new Error('Error extrayendo audio. FFmpeg puede no estar instalado.');
    }
  }

  async convertAudio(buffer: Buffer, format: 'mp3' | 'ogg' | 'wav'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede convertir audio.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.audio`);
    const tempOutput = join(ConverterService.TEMP_DIR, `output-${Date.now()}.${format}`);

    try {
      writeFileSync(tempInput, buffer);

      let args: string[];
      switch (format) {
        case 'mp3':
          args = [
            '-y',
            '-i',
            tempInput,
            '-vn',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-b:a',
            '192k',
            tempOutput,
          ];
          break;
        case 'ogg':
          args = ['-y', '-i', tempInput, '-vn', '-c:a', 'libvorbis', tempOutput];
          break;
        case 'wav':
          args = ['-y', '-i', tempInput, '-acodec', 'pcm_s16le', tempOutput];
          break;
        default:
          throw new Error(`Formato no soportado: ${format as string}`);
      }

      await this.runFFmpeg(args);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.convertAudio', error);
      throw new Error('Error convirtiendo audio. FFmpeg puede no estar instalado.');
    }
  }

  async createVideoThumbnail(buffer: Buffer, timestamp: string = '00:00:01'): Promise<Buffer> {
    const ffmpegAvailable = await ConverterService.isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg no está instalado. No se puede crear thumbnail.');
    }

    const tempInput = join(ConverterService.TEMP_DIR, `input-${Date.now()}.video`);
    const tempOutput = join(ConverterService.TEMP_DIR, `thumb-${Date.now()}.jpg`);

    try {
      writeFileSync(tempInput, buffer);

      await this.runFFmpeg(['-y', '-i', tempInput, '-ss', timestamp, '-vframes', '1', tempOutput]);

      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      logError('ConverterService.createVideoThumbnail', error);
      throw new Error('Error creando thumbnail. FFmpeg puede no estar instalado.');
    }
  }

  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      ffmpeg.stderr.on('data', data => {
        stderr += data.toString();
      });
      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
        }
      });
      ffmpeg.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    files.forEach(file => {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (error) {
        logger.debug(`[ConverterService] No se pudo eliminar el temporal ${file}:`, error);
      }
    });
  }
}
