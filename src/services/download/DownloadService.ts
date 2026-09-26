import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import {
  VBotError,
  ErrorCode,
  ValidationError,
  NetworkError,
  InvalidURLError,
} from '@/utils/errors.js';
import { logError, logger } from '@/utils/logger.js';

export type DownloadSuccess = {
  filePath: string;
  size: string;
  source: string;
};

export type DownloadError = ValidationError | NetworkError | VBotError;

export type DownloadResult = Either<DownloadError, DownloadSuccess>;

const BLOCKED_URL_PATTERNS = [
  /[;&|`$<>{}]/,
  /localhost/i,
  /127\.\d+\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /0\.0\.0\.0/,
  /::1/,
  /fc00:/i,
  /fe80:/i,
];

export class DownloadService {
  private static readonly TEMP_DIR = './data/temp/downloads';
  private static readonly MAX_AUDIO_SIZE_MB = 50;
  private static readonly MAX_VIDEO_SIZE_MB = 100;

  constructor() {
    if (!fs.existsSync(DownloadService.TEMP_DIR)) {
      fs.mkdirSync(DownloadService.TEMP_DIR, { recursive: true });
    }
  }

  protected getDownloadPrefix(): string {
    return '';
  }

  protected resolveOutputPath?(expectedPath: string): string | null;

  protected DOWNLOAD_PREVIEW_ENABLED = true;
  protected DEFAULT_QUALITY = '720';

  getQualityFromArgs(args: string[]): { quality: string; remainingArgs: string[] } {
    const validQualities: string[] = ['360', '480', '720', '1080'];
    const remainingArgs = [...args];
    let quality = this.DEFAULT_QUALITY;

    for (let i = 0; i < remainingArgs.length; i++) {
      const arg = remainingArgs[i];
      if (arg && validQualities.includes(arg)) {
        quality = arg;
        remainingArgs.splice(i, 1);
        break;
      }
    }

    return { quality, remainingArgs };
  }

  protected validateUrl(url: string): Either<ValidationError, string> {
    if (!url || url.trim().length === 0) {
      return left(new ValidationError('URL está vacía'));
    }

    if (url.length > 2048) {
      return left(new ValidationError('URL muy larga (máx 2048 caracteres)'));
    }

    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return left(new ValidationError('Solo URLs HTTP/HTTPS permitidas'));
      }

      for (const pattern of BLOCKED_URL_PATTERNS) {
        if (pattern.test(url)) {
          return left(new ValidationError('URL contiene patrones bloqueados'));
        }
      }

      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return left(new ValidationError('URLs localhost no permitidas'));
      }

      return right(url);
    } catch {
      return left(new InvalidURLError(url, 'formato inválido'));
    }
  }

  protected runCommand(cmd: string, args: string[], timeout: number = 90000): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(cmd, args);
      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        process.kill();
        reject(new Error('Command timeout'));
      }, timeout);

      process.stdout.on('data', data => {
        stdout += data.toString();
      });

      process.stderr.on('data', data => {
        stderr += data.toString();
      });

      process.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Exit code: ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  protected checkFileSize(
    filePath: string,
    type: 'audio' | 'video',
  ): Either<ValidationError, { sizeMB: number }> {
    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    const maxSize =
      type === 'audio' ? DownloadService.MAX_AUDIO_SIZE_MB : DownloadService.MAX_VIDEO_SIZE_MB;

    if (sizeMB > maxSize) {
      return left(
        new ValidationError(`Archivo muy grande: ${sizeMB.toFixed(1)}MB (máx: ${maxSize}MB)`),
      );
    }

    return right({ sizeMB: parseFloat(sizeMB.toFixed(2)) });
  }

  protected sanitizeFilename(filename: string, maxLength: number = 60): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, maxLength);
  }

  /**
   * Schedules deletion of a temp file. Public: download commands call this
   * after sending the file to the chat.
   */
  async cleanup(filePath: string, delay: number = 30000): Promise<void> {
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`🗑️ Cleaned up: ${path.basename(filePath)}`);
        } catch (error) {
          logError('DownloadService cleanup', error);
        }
      }
    }, delay);
  }

  protected getTempDir(): string {
    return DownloadService.TEMP_DIR;
  }

  protected generateOutputPath(filename: string, extension: string): string {
    const sanitized = this.sanitizeFilename(filename);
    return path.join(this.getTempDir(), `${sanitized}_${Date.now()}.${extension}`);
  }

  protected async tryDownloadMethods(
    methods: Array<{ name: string; cmd: string; args: string[] }>,
    outputPath: string,
    type: 'audio' | 'video',
  ): Promise<DownloadResult> {
    const prefix = this.getDownloadPrefix();
    const tag = prefix ? `[${prefix}]` : '';
    let lastError: VBotError | undefined;

    for (const method of methods) {
      try {
        logger.debug(`${tag} Trying ${method.name}...`);

        await this.runCommand(method.cmd, method.args, 180000);

        let resolvedPath = outputPath;
        if (this.resolveOutputPath) {
          resolvedPath = this.resolveOutputPath(outputPath) ?? outputPath;
        }

        if (fs.existsSync(resolvedPath)) {
          const sizeCheck = this.checkFileSize(resolvedPath, type);

          if (sizeCheck._tag === 'Left') {
            fs.unlinkSync(resolvedPath);
            return left(sizeCheck.left);
          }

          logger.debug(`${tag} ${method.name} succeeded: ${sizeCheck.right.sizeMB}MB`);

          return right({
            filePath: resolvedPath,
            size: sizeCheck.right.sizeMB.toString(),
            source: method.name,
          });
        }
      } catch (error) {
        const err = error as Error;
        lastError = new NetworkError(err.message, { method: method.name });
        logger.debug(`${tag} ${method.name} failed: ${err.message}`);
        continue;
      }
    }

    return left(
      lastError ||
        new VBotError(
          'Descarga fallida. Verifica que yt-dlp y ffmpeg estén instalados.',
          ErrorCode.NETWORK_ERROR,
          true,
          { methods: methods.map(m => m.name) },
        ),
    );
  }
}
