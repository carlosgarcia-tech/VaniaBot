/**
 * types.ts
 *
 * VaniaBot services module exposing `ConvertOptions`, `ConversionResult`.
 *
 * @author **Carlos G**
 */

export type ConversionAction = 'pdf2img' | 'ppt2pdf' | 'docx2pdf' | 'pdf2docx' | 'pdf2ppt';

export type ImageFormat = 'jpeg' | 'png';

export interface ConvertOptions {
  format?: ImageFormat;
}

export interface ConversionResult {
  data: Buffer;
  fileName: string;
  mimeType: string;
}
