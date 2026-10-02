/**
 * ImageToPdfService.ts
 *
 * VaniaBot services module exposing `ImageToPdfService`.
 *
 * @author **Carlos G**
 */

import { spawn } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { logError } from '@/utils/logger.js';
import { ConverterService } from '@/services/media/ConverterService.js';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

export class ImageToPdfService {
  private static instance: ImageToPdfService;
  private converterService: ConverterService;

  private constructor() {
    this.converterService = new ConverterService();
  }

  static getInstance(): ImageToPdfService {
    if (!ImageToPdfService.instance) {
      ImageToPdfService.instance = new ImageToPdfService();
    }
    return ImageToPdfService.instance;
  }

  async convert(images: Buffer[]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    for (const imgBuffer of images) {
      try {
        const pngBuffer = await this.toPngViaFfmpeg(imgBuffer);
        const image = await pdfDoc.embedPng(pngBuffer);
        const { width, height } = image.scaleToFit(A4_WIDTH, A4_HEIGHT);
        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        page.drawImage(image, {
          x: (A4_WIDTH - width) / 2,
          y: (A4_HEIGHT - height) / 2,
          width,
          height,
        });
      } catch (err) {
        logError('[ImageToPdf] Error processing image', err);
        throw new Error('Error processing image');
      }
    }

    return Buffer.from(await pdfDoc.save());
  }

  private toPngViaFfmpeg(buffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i',
        'pipe:0',
        '-f',
        'image2pipe',
        '-c:v',
        'png',
        'pipe:1',
      ]);

      const chunks: Buffer[] = [];
      let errorOutput = '';

      ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      ffmpeg.stderr.on('data', (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`FFmpeg PNG conversion failed: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', reject);
      ffmpeg.stdin.end(buffer);
    });
  }
}
