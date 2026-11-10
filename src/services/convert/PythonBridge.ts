/**
 * PythonBridge.ts
 *
 * OrbitBot services module exposing `ScannedPdfError`, `TooManyPagesError`, `PythonBridge`, `BridgeResult`.
 *
 * @author **Carlos G**
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logError, logger } from '@/utils/logger.js';
import type { ConversionAction, ImageFormat } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = './data/temp';
const BRIDGE_SCRIPT = join(__dirname, 'scripts', 'bridge.py');

export interface BridgeResult {
  data: Buffer;
  /** Number of items produced (e.g. pages) */
  count: number;
  /** Output type: 'zip' | 'jpg' | 'png' | 'pdf' | 'docx' | 'pptx' */
  outputType: string;
}

/** The PDF has no extractable text (likely scanned) */
export class ScannedPdfError extends Error {
  constructor() {
    super('El PDF no contiene texto extraíble (parece escaneado)');
    this.name = 'ScannedPdfError';
  }
}

/** The document exceeds the supported page limit */
export class TooManyPagesError extends Error {
  constructor() {
    super('El documento excede el límite de páginas soportado');
    this.name = 'TooManyPagesError';
  }
}

export class PythonBridge {
  private static instance: PythonBridge;

  private constructor() {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  static getInstance(): PythonBridge {
    if (!PythonBridge.instance) {
      PythonBridge.instance = new PythonBridge();
    }
    return PythonBridge.instance;
  }

  async execute(
    action: ConversionAction,
    inputBuffer: Buffer,
    options?: { format?: ImageFormat },
  ): Promise<BridgeResult> {
    const inputPath = join(
      TEMP_DIR,
      `bridge-input-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const outputPath = join(
      TEMP_DIR,
      `bridge-output-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );

    try {
      writeFileSync(inputPath, inputBuffer);

      const args = [BRIDGE_SCRIPT, action, inputPath, outputPath];
      if (options?.format) {
        args.push(options.format);
      }

      const stdout = await this.spawnPython(args);

      if (!existsSync(outputPath)) {
        throw new Error(`Python bridge did not produce output for action: ${action}`);
      }

      const { count, outputType } = this.parseStdout(stdout, action);

      return {
        data: readFileSync(outputPath),
        count,
        outputType,
      };
    } catch (error) {
      logError(`[PythonBridge] ${action} failed`, error);
      throw error;
    } finally {
      this.cleanup(inputPath, outputPath);
    }
  }

  /**
   * Parses the last "OK:<count>:<type>" line printed by bridge.py.
   * If it cannot be parsed, falls back to conservative defaults.
   */
  private parseStdout(
    stdout: string,
    action: ConversionAction,
  ): { count: number; outputType: string } {
    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1] ?? '';
    const match = lastLine.match(/^OK:(\d+):(\w+)$/);

    if (match) {
      return { count: parseInt(match[1], 10), outputType: match[2] };
    }

    logError(`[PythonBridge] Unexpected stdout format for ${action}: "${stdout}"`, null);
    return { count: 1, outputType: 'zip' };
  }

  private spawnPython(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('python3', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', code => {
        if (code === 0) {
          resolve(stdout);
        } else if (code === 2) {
          reject(new ScannedPdfError());
        } else if (code === 3) {
          reject(new TooManyPagesError());
        } else {
          reject(new Error(`Python bridge exited code ${code}: ${stderr.slice(0, 500)}`));
        }
      });

      proc.on('error', reject);
    });
  }

  private cleanup(...files: string[]): void {
    for (const file of files) {
      try {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      } catch (error) {
        logger.debug(`[PythonBridge] No se pudo eliminar el temporal ${file}:`, error);
      }
    }
  }
}
