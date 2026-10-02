/**
 * ConversionService.ts
 *
 * VaniaBot services module exposing `ConversionService`.
 *
 * @author **Carlos G**
 */

import { ImageToPdfService } from './ImageToPdfService.js';
import { PythonBridge } from './PythonBridge.js';
import type { ConversionResult, ImageFormat } from './types.js';

export class ConversionService {
  private static instance: ConversionService;
  private imageToPdf: ImageToPdfService;
  private pythonBridge: PythonBridge;

  private constructor() {
    this.imageToPdf = ImageToPdfService.getInstance();
    this.pythonBridge = PythonBridge.getInstance();
  }

  static getInstance(): ConversionService {
    if (!ConversionService.instance) {
      ConversionService.instance = new ConversionService();
    }
    return ConversionService.instance;
  }

  async imagesToPdf(images: Buffer[]): Promise<ConversionResult> {
    const data = await this.imageToPdf.convert(images);
    return {
      data,
      fileName: `documento.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async pdfToImages(pdfBuffer: Buffer, format: ImageFormat = 'jpeg'): Promise<ConversionResult> {
    const result = await this.pythonBridge.execute('pdf2img', pdfBuffer, { format });

    if (result.outputType === 'zip') {
      return {
        data: result.data,
        fileName: `paginas.zip`,
        mimeType: 'application/zip',
      };
    }

    const ext = result.outputType === 'png' ? 'png' : 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    return {
      data: result.data,
      fileName: `pagina.${ext}`,
      mimeType,
    };
  }

  async pptToPdf(pptBuffer: Buffer): Promise<ConversionResult> {
    const result = await this.pythonBridge.execute('ppt2pdf', pptBuffer);
    return {
      data: result.data,
      fileName: `presentacion.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async docxToPdf(docxBuffer: Buffer): Promise<ConversionResult> {
    const result = await this.pythonBridge.execute('docx2pdf', docxBuffer);
    return {
      data: result.data,
      fileName: `documento.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async pdfToDocx(pdfBuffer: Buffer): Promise<ConversionResult> {
    const result = await this.pythonBridge.execute('pdf2docx', pdfBuffer);
    return {
      data: result.data,
      fileName: `documento.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  async pdfToPpt(pdfBuffer: Buffer): Promise<ConversionResult> {
    const result = await this.pythonBridge.execute('pdf2ppt', pdfBuffer);
    return {
      data: result.data,
      fileName: `presentacion.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
  }
}
