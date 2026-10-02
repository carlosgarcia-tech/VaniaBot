/**
 * imageProcessor.ts
 *
 * Image loading, text compositing and resizing, with a layered fallback chain.
 *
 * The bot targets environments where native tooling varies wildly (Docker,
 * plain Linux VPS, and Android/Termux where FFmpeg is built without several
 * usual features), so every operation degrades instead of failing:
 *
 *   text compositing:  FFmpeg drawtext -> resvg + Jimp -> canvas -> base image
 *   image loading:     FFmpeg -> Jimp
 *   resizing:          FFmpeg -> Jimp
 *
 * SVG text is never handed to FFmpeg's own SVG decoder (it needs librsvg, absent
 * on Termux); text is parsed out and re-rendered via the `drawtext` filter.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { Jimp } from 'jimp';
import { readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { logger, logError } from '@/utils/logger.js';

const execAsync = promisify(exec);

/** An image plus its dimensions, which callers need for layout maths. */
export interface ImageProcessorResult {
  buffer: Buffer;
  width: number;
  height: number;
}

/** A single `<text>` element parsed out of an SVG. */
interface ParsedTextBlock {
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight: string;
  textAnchor: string;
}

export class ImageProcessor {
  /** Lazily probed capability flags; null means "not checked yet". */
  private static ffmpegAvailable: boolean | null = null;
  private static resvgAvailable: boolean | null = null;
  private static readonly TEMP_DIR = './data/temp';

  /** Cached font path. `undefined` = not yet searched, `null` = none found. */
  private static fontPath: string | null | undefined = undefined;

  /** Probes for FFmpeg once and caches the result. */
  static async isFFmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;
    try {
      await execAsync('ffmpeg -version');
      this.ffmpegAvailable = true;
    } catch {
      this.ffmpegAvailable = false;
      logger.warn('[ImageProcessor] FFmpeg no disponible, usando Jimp como fallback');
    }
    return this.ffmpegAvailable;
  }

  /** Probes for the resvg SVG renderer once and caches the result. */
  static async isResvgAvailable(): Promise<boolean> {
    if (this.resvgAvailable !== null) return this.resvgAvailable;
    try {
      await import('@resvg/resvg-js');
      this.resvgAvailable = true;
    } catch {
      this.resvgAvailable = false;
    }
    return this.resvgAvailable;
  }

  /**
   * Finds the first TTF font usable by FFmpeg's drawtext filter.
   *
   * Rather than guessing specific filenames, whole directories are scanned.
   * Priority order:
   *   1. data/assets/font.ttf        (project's own font)
   *   2. /system/fonts/              (Android — any available .ttf)
   *   3. Termux font packages        (pkg install font-dejavu, etc.)
   *   4. standard Linux font paths   (VPS / desktop)
   *
   * @returns Font path, or null when none is found (drawtext then cannot run).
   */
  private static findFont(): string | null {
    if (this.fontPath !== undefined) return this.fontPath;

    const ownFont = join(process.cwd(), 'data', 'assets', 'font.ttf');
    if (existsSync(ownFont)) {
      this.fontPath = ownFont;
      logger.warn(`[ImageProcessor] Fuente propia: ${ownFont}`);
      return this.fontPath;
    }

    const scanDirs = [
      '/system/fonts',
      '/data/data/com.termux/files/usr/share/fonts/TTF',
      '/data/data/com.termux/files/usr/share/fonts/truetype/DejaVu',
      '/usr/share/fonts/truetype/dejavu',
      '/usr/share/fonts/TTF',
      '/usr/share/fonts/truetype/liberation',
      '/usr/share/fonts/truetype/freefont',
    ];

    const preferred = [
      'Roboto-Regular.ttf',
      'NotoSans-Regular.ttf',
      'DroidSans.ttf',
      'Arial.ttf',
      'DejaVuSans.ttf',
      'LiberationSans-Regular.ttf',
      'FreeSans.ttf',
    ];

    for (const dir of scanDirs) {
      if (!existsSync(dir)) continue;

      let files: string[];
      try {
        files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.ttf'));
      } catch {
        continue;
      }

      if (files.length === 0) continue;

      for (const pref of preferred) {
        if (files.includes(pref)) {
          this.fontPath = join(dir, pref);
          logger.warn(`[ImageProcessor] Fuente (preferida): ${this.fontPath}`);
          return this.fontPath;
        }
      }

      this.fontPath = join(dir, files[0]);
      logger.warn(`[ImageProcessor] Fuente (primera disponible): ${this.fontPath}`);
      return this.fontPath;
    }

    this.fontPath = null;
    logger.warn(
      '[ImageProcessor] ⚠️ Sin fuente TTF.\n' +
        '  Opción A: pon cualquier .ttf en data/assets/font.ttf\n' +
        '  Opción B (Termux): pkg install font-dejavu',
    );
    return null;
  }

  /** Loads an image, preferring FFmpeg and falling back to Jimp. */
  static async loadImage(imagePath: string): Promise<ImageProcessorResult> {
    const useFFmpeg = await this.isFFmpegAvailable();
    if (useFFmpeg) {
      try {
        return await this.loadImageFFmpeg(imagePath);
      } catch (error) {
        logError('[ImageProcessor] loadImageFFmpeg', error);
      }
    }
    return await this.loadImageJimp(imagePath);
  }

  private static async loadImageFFmpeg(imagePath: string): Promise<ImageProcessorResult> {
    const { width, height } = await this.probeDimensions(imagePath);

    if (!this.TEMP_DIR_exists()) mkdirSync(this.TEMP_DIR, { recursive: true });
    const outPath = join(this.TEMP_DIR, `load-${Date.now()}.png`);

    await this.runFFmpeg(['-y', '-i', imagePath, outPath]);
    const buffer = readFileSync(outPath);
    this.cleanup(outPath);

    return { buffer, width, height };
  }

  /**
   * Reads image dimensions via ffprobe.
   * Falls back to 512x512 when probing fails, so callers always get usable values.
   */
  private static async probeDimensions(
    imagePath: string,
  ): Promise<{ width: number; height: number }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${imagePath}"`,
      );
      const [w, h] = stdout.trim().split('x').map(Number);
      if (w && h) return { width: w, height: h };
    } catch (error) {
      logError('[ImageProcessor] probeDimensions (ffprobe)', error);
    }
    return { width: 512, height: 512 };
  }

  private static async loadImageJimp(imagePath: string): Promise<ImageProcessorResult> {
    const image = await Jimp.read(imagePath);
    return {
      buffer: await image.getBuffer('image/png'),
      width: image.width,
      height: image.height,
    };
  }

  /**
   * Renders an SVG to PNG.
   * Tries resvg first, then the canvas-based text-only renderer.
   * @throws When no SVG renderer is available.
   */
  static async svgToBuffer(svgContent: string, width: number, height: number): Promise<Buffer> {
    if (await this.isResvgAvailable()) {
      try {
        const { Resvg } = await import('@resvg/resvg-js');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
        return Buffer.from(resvg.render().asPng());
      } catch (err) {
        logger.warn('[ImageProcessor] resvg-js falló:', err);
      }
    }

    try {
      return await this.svgToBufferCanvas(svgContent, width, height);
    } catch (err) {
      logger.warn('[ImageProcessor] canvas SVG render falló:', err);
    }

    throw new Error('No hay renderer SVG disponible. Ejecuta: npm install @resvg/resvg-js');
  }

  /**
   * Canvas-based SVG renderer used when resvg is unavailable.
   * Renders only the text elements, since shapes are already baked into the
   * base image by the time this runs.
   */
  private static async svgToBufferCanvas(
    svgContent: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const blocks = this.parseSvgTextBlocks(svgContent);
    for (const b of blocks) {
      ctx.font = `${b.fontWeight} ${b.fontSize}px Arial`;
      ctx.fillStyle = b.fill;
      ctx.textAlign = b.textAnchor as 'start' | 'end' | 'left' | 'right' | 'center';
      ctx.fillText(b.content, b.x, b.y);
    }
    return canvas.toBuffer('image/png');
  }

  /**
   * Draws the text from an SVG onto a base image.
   *
   * Tries FFmpeg drawtext, then resvg+Jimp, then canvas. If every method fails
   * the untouched base image is returned rather than throwing, so a card always
   * gets sent to the user.
   */
  static async compositeText(
    imagePath: string,
    svgContent: string,
    width: number,
    _height: number,
  ): Promise<Buffer> {
    if (!this.TEMP_DIR_exists()) mkdirSync(this.TEMP_DIR, { recursive: true });

    try {
      return await this.compositeTextFFmpegDrawtext(imagePath, svgContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ImageProcessor] FFmpeg drawtext falló: ${msg}`);
    }

    if (await this.isResvgAvailable()) {
      try {
        const { Resvg } = await import('@resvg/resvg-js');
        const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: width } });
        const svgBuffer = Buffer.from(resvg.render().asPng());
        const base = await Jimp.read(imagePath);
        const overlay = await Jimp.read(svgBuffer);
        base.composite(overlay, 0, 0);
        return await base.getBuffer('image/png');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[ImageProcessor] resvg+Jimp falló: ${msg}`);
      }
    }

    try {
      return await this.compositeTextCanvas(imagePath, svgContent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[ImageProcessor] Canvas falló: ${msg}`);
    }

    logger.error('[ImageProcessor] Todos los métodos fallaron, enviando imagen base sin texto');
    return (await Jimp.read(imagePath)).getBuffer('image/png');
  }

  /**
   * Parses the SVG `<text>` elements and builds an FFmpeg `drawtext` filter chain.
   *
   * Deliberately avoids FFmpeg's SVG decoder (it requires librsvg, which is
   * absent on Termux) and uses only the libavfilter `drawtext` filter, which is
   * available in Termux's FFmpeg build.
   *
   * NOTE: the `bold=` option is not emitted — unsupported in Termux FFmpeg (ARM64).
   *
   * @throws When no usable TTF font can be found.
   */
  private static async compositeTextFFmpegDrawtext(
    imagePath: string,
    svgContent: string,
  ): Promise<Buffer> {
    const blocks = this.parseSvgTextBlocks(svgContent);
    if (blocks.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const fontPath = this.findFont();

    if (!fontPath) {
      throw new Error(
        'Sin fuente TTF. Pon una en data/assets/font.ttf o ejecuta: pkg install font-dejavu',
      );
    }

    const filters = blocks.map(b => this.buildDrawtextFilter(b, fontPath)).filter(Boolean);
    if (filters.length === 0) {
      return (await Jimp.read(imagePath)).getBuffer('image/png');
    }

    const outPath = join(this.TEMP_DIR, `drawtext-${Date.now()}.png`);
    const vfArg = filters.join(',');

    logger.warn(
      `[ImageProcessor] FFmpeg drawtext: ${filters.length} bloque(s) | font: ${fontPath}`,
    );

    await this.runFFmpeg(['-y', '-i', imagePath, '-vf', vfArg, outPath]);

    const result = readFileSync(outPath);
    this.cleanup(outPath);
    return result;
  }

  /**
   * Converts a ParsedTextBlock into an FFmpeg `drawtext` clause.
   *
   * Coordinate and colour conversions required between the two models:
   * - SVG y = baseline -> FFmpeg y = top of the bounding box (subtract ~82% of fontSize)
   * - text-anchor="middle" -> x = cx - text_w/2  (FFmpeg expression)
   * - colours: SVG #RRGGBB -> FFmpeg 0xRRGGBBAA
   * - fontfile= is mandatory on Termux/Android
   * - bold= omitted: unsupported in Termux FFmpeg
   *
   * @returns The filter clause, or an empty string for a blank text block.
   */
  private static buildDrawtextFilter(b: ParsedTextBlock, fontPath: string): string {
    if (!b.content) return '';

    const escaped = b.content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '')
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    if (!escaped.trim()) return '';

    let color = b.fill;
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      color = `0x${
        hex.length === 3
          ? hex
              .split('')
              .map(c => c + c)
              .join('')
          : hex
      }FF`;
    }

    let xExpr: string;
    if (b.textAnchor === 'middle') xExpr = `${b.x}-text_w/2`;
    else if (b.textAnchor === 'end') xExpr = `${b.x}-text_w`;
    else xExpr = `${b.x}`;

    const yVal = Math.max(0, Math.round(b.y - b.fontSize * 0.82));

    return (
      `drawtext=fontfile='${fontPath}':text='${escaped}'` +
      `:x=${xExpr}:y=${yVal}:fontsize=${b.fontSize}:fontcolor=${color}`
    );
  }

  /**
   * Extracts every `<text>` element with its geometry and styling.
   * A regex is used deliberately: a full XML parser is unnecessary here and
   * these SVGs are generated internally with a known, simple shape.
   */
  private static parseSvgTextBlocks(svgContent: string): ParsedTextBlock[] {
    const regex = /<text([^>]*)>([\s\S]*?)<\/text>/gi;
    const blocks: ParsedTextBlock[] = [];

    for (const [, attrs, rawContent] of svgContent.matchAll(regex)) {
      const content = rawContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim();

      if (!content) continue;

      blocks.push({
        content,
        x: parseFloat(attrs.match(/\bx="([\d.-]+)"/)?.[1] ?? '0'),
        y: parseFloat(attrs.match(/\by="([\d.-]+)"/)?.[1] ?? '0'),
        fontSize: parseInt(attrs.match(/font-size="(\d+)"/)?.[1] ?? '40', 10),
        fill: attrs.match(/fill="([^"]+)"/)?.[1] ?? '#ffffff',
        fontWeight: attrs.match(/font-weight="([^"]+)"/)?.[1] ?? 'normal',
        textAnchor: attrs.match(/text-anchor="([^"]+)"/)?.[1] ?? 'start',
      });
    }

    return blocks;
  }

  private static async compositeTextCanvas(imagePath: string, svgContent: string): Promise<Buffer> {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const base = await loadImage(imagePath);
    const canvas = createCanvas(base.width, base.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(base, 0, 0);

    const blocks = this.parseSvgTextBlocks(svgContent);
    for (const b of blocks) {
      ctx.font = `${b.fontWeight} ${b.fontSize}px Arial`;
      ctx.fillStyle = b.fill;
      ctx.textAlign = b.textAnchor as 'start' | 'end' | 'left' | 'right' | 'center';
      ctx.fillText(b.content, b.x, b.y);
    }
    return canvas.toBuffer('image/png');
  }

  /** Resizes with COVER: scales and crops to fill the frame exactly. */
  static async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    const useFFmpeg = await this.isFFmpegAvailable();
    if (useFFmpeg) {
      try {
        return await this.ffmpegResize(buffer, width, height, 'cover');
      } catch (error) {
        logError('[ImageProcessor] resizeImage (ffmpeg)', error);
      }
    }
    const image = await Jimp.read(buffer);
    image.cover({ w: width, h: height });
    return await image.getBuffer('image/png');
  }

  /**
   * Resizes with CONTAIN: scales proportionally and pads with transparency.
   * Use for stickers, where cropping the content is not acceptable.
   */
  static async resizeContain(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    const useFFmpeg = await this.isFFmpegAvailable();
    if (useFFmpeg) {
      try {
        return await this.ffmpegResize(buffer, width, height, 'contain');
      } catch (error) {
        logError('[ImageProcessor] resizeContain (ffmpeg)', error);
      }
    }
    const image = await Jimp.read(buffer);
    image.contain({ w: width, h: height });
    return await image.getBuffer('image/png');
  }

  /**
   * Resizes via FFmpeg, cropping (cover) or padding with transparency (contain).
   * Temp files are always removed, including on failure.
   */
  private static async ffmpegResize(
    buffer: Buffer,
    width: number,
    height: number,
    mode: 'cover' | 'contain',
  ): Promise<Buffer> {
    if (!this.TEMP_DIR_exists()) mkdirSync(this.TEMP_DIR, { recursive: true });

    const tempInput = join(this.TEMP_DIR, `rz-in-${Date.now()}.img`);
    const tempOutput = join(this.TEMP_DIR, `rz-out-${Date.now()}.png`);

    try {
      writeFileSync(tempInput, buffer);

      const filter =
        mode === 'cover'
          ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
          : `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;

      await this.runFFmpeg(['-y', '-i', tempInput, '-vf', filter, tempOutput]);
      const result = readFileSync(tempOutput);
      this.cleanup(tempInput, tempOutput);
      return result;
    } catch (error) {
      this.cleanup(tempInput, tempOutput);
      throw error;
    }
  }

  /** Spawns FFmpeg and rejects on a non-zero exit code, including stderr output. */
  private static async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-800)}`));
        }
      });
      proc.on('error', err => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
    });
  }

  private static TEMP_DIR_exists(): boolean {
    return existsSync(this.TEMP_DIR);
  }

  /** Best-effort deletion of temp files; failures are logged, never thrown. */
  private static cleanup(...files: string[]): void {
    files.forEach(f => {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch (error) {
        logError('[ImageProcessor]', error);
      }
    });
  }
}
