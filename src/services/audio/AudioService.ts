import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { logError, logger } from '@/utils/logger.js';
import { promisify } from 'util';
import { aiService } from '@/services/external/AIService.js';
import type { Either } from '@/utils/either.js';
import { right, left, isRight } from '@/utils/either.js';

const execAsync = promisify(exec);
const TEMP_DIR = './data/temp/audio';

export type AudioTipo = 'voz' | 'musica' | 'silencio' | 'ruido' | 'desconocido';
export type AudioFormato = 'ogg' | 'mp3' | 'mp4' | 'wav' | 'm4a' | 'aac' | 'flac' | 'webm' | 'opus';

export interface AudioInfo {
  valido: boolean;
  formato: AudioFormato | 'desconocido';
  tamañoKB: number;
  esNotaDeVoz: boolean;
  comprimido: boolean;
  error?: string;
}

export interface AudioAnalisis {
  tipo: AudioTipo;
  confianza: number;
  descripcion: string;
  recomendacion: string;
}

export interface TranscripcionCompletaSuccess {
  texto: string;
  resumen?: string;
  puntosClave?: string[];
  idioma?: string;
  duracionEst?: string;
  info?: AudioInfo;
  analisis?: AudioAnalisis;
}

export type TranscripcionError = { message: string };
export type TranscripcionCompleta = Either<TranscripcionError, TranscripcionCompletaSuccess>;

const MAGIC: Record<string, { offset: number; bytes: number[] }> = {
  ogg: { offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] },
  mp3: { offset: 0, bytes: [0xff, 0xfb] },
  mp3id3: { offset: 0, bytes: [0x49, 0x44, 0x33] },
  mp4: { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  wav: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  flac: { offset: 0, bytes: [0x66, 0x4c, 0x61, 0x43] },
  webm: { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
};

const MAX_SIZE_MB = 25;
const COMPRESS_MB = 5;
const MIN_SIZE_BYTES = 1000;

function matchesMagic(buf: Buffer, key: string): boolean {
  const m = MAGIC[key];
  if (!m || buf.length < m.offset + m.bytes.length) return false;
  return m.bytes.every((b, i) => buf[m.offset + i] === b);
}

function detectarFormato(buf: Buffer): AudioFormato | 'desconocido' {
  if (matchesMagic(buf, 'ogg')) return 'ogg';
  if (matchesMagic(buf, 'mp3')) return 'mp3';
  if (matchesMagic(buf, 'mp3id3')) return 'mp3';
  if (matchesMagic(buf, 'mp4')) return 'mp4';
  if (matchesMagic(buf, 'wav')) return 'wav';
  if (matchesMagic(buf, 'flac')) return 'flac';
  if (matchesMagic(buf, 'webm')) return 'webm';
  return 'desconocido';
}

function estimarDuracion(tamañoKB: number, formato: string): string {
  const kbps: Record<string, number> = {
    ogg: 32,
    mp3: 128,
    mp4: 128,
    m4a: 128,
    wav: 1411,
    flac: 700,
    webm: 64,
    opus: 32,
  };
  const br = kbps[formato] ?? 64;
  const segs = (tamañoKB * 8) / br;
  if (segs < 60) return `~${Math.round(segs)}s`;
  return `~${Math.floor(segs / 60)}m ${Math.round(segs % 60)}s`;
}

async function ffmpegDisponible(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

class AudioService {
  validar(buffer: Buffer, esNotaDeVoz = false): AudioInfo {
    const tamañoKB = buffer.length / 1024;
    const tamañoMB = tamañoKB / 1024;

    if (buffer.length < MIN_SIZE_BYTES) {
      return {
        valido: false,
        formato: 'desconocido',
        tamañoKB,
        esNotaDeVoz,
        comprimido: false,
        error: 'El archivo es demasiado pequeño para ser audio válido.',
      };
    }

    if (tamañoMB > MAX_SIZE_MB) {
      return {
        valido: false,
        formato: 'desconocido',
        tamañoKB,
        esNotaDeVoz,
        comprimido: false,
        error: `El audio pesa ${tamañoMB.toFixed(1)} MB. El límite es ${MAX_SIZE_MB} MB.`,
      };
    }

    const formato = detectarFormato(buffer);

    return {
      valido: true,
      formato,
      tamañoKB,
      esNotaDeVoz,
      comprimido: false,
    };
  }

  async comprimir(
    buffer: Buffer,
    extensionOrigen: string,
  ): Promise<{ buffer: Buffer; comprimido: boolean; extension: string }> {
    const tamañoMB = buffer.length / 1024 / 1024;

    if (tamañoMB < COMPRESS_MB) {
      return { buffer, comprimido: false, extension: extensionOrigen };
    }

    if (!(await ffmpegDisponible())) {
      logger.debug('[AudioService] ffmpeg not available, skipping compression');
      return { buffer, comprimido: false, extension: extensionOrigen };
    }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    const tmpIn = path.join(TEMP_DIR, `in_${Date.now()}.${extensionOrigen}`);
    const tmpOut = path.join(TEMP_DIR, `out_${Date.now()}.ogg`);

    try {
      fs.writeFileSync(tmpIn, buffer);

      await execAsync(
        `ffmpeg -y -i "${tmpIn}" ` +
          `-af "highpass=f=80,lowpass=f=8000,volume=2.0,dynaudnorm" ` +
          `-ac 1 -ar 16000 -c:a libopus -b:a 32k "${tmpOut}" 2>/dev/null`,
      );

      const compressed = fs.readFileSync(tmpOut);
      const ratio = ((1 - compressed.length / buffer.length) * 100).toFixed(0);
      logger.debug(
        `[AudioService] Compression: ${tamañoMB.toFixed(1)}MB → ${(compressed.length / 1024 / 1024).toFixed(1)}MB (-${ratio}%)`,
      );

      return { buffer: compressed, comprimido: true, extension: 'ogg' };
    } catch (err) {
      logError('[AudioService] Error en compresión', err);
      return { buffer, comprimido: false, extension: extensionOrigen };
    } finally {
      try {
        fs.unlinkSync(tmpIn);
      } catch (error) {
        logger.debug(`[AudioService] Temp input cleanup failed (${tmpIn}):`, error);
      }
      try {
        fs.unlinkSync(tmpOut);
      } catch (error) {
        logger.debug(`[AudioService] Temp output cleanup failed (${tmpOut}):`, error);
      }
    }
  }

  async analizarTipo(transcripcion: string, duracionEst: string): Promise<AudioAnalisis> {
    if (!transcripcion || transcripcion.trim().length < 3) {
      return {
        tipo: 'silencio',
        confianza: 0.9,
        descripcion: 'No se detectó contenido de voz.',
        recomendacion: 'Verifica que el audio contenga voz clara.',
      };
    }

    const prompt =
      `Analiza esta transcripción de audio (duración estimada: ${duracionEst}) y responde SOLO con JSON válido:\n\n` +
      `Transcripción: "${transcripcion.slice(0, 500)}"\n\n` +
      `Responde EXACTAMENTE con este JSON sin markdown:\n` +
      `{"tipo":"voz|musica|ruido|desconocido","confianza":0.0,"descripcion":"una oración","recomendacion":"una oración"}`;

    const response = await aiService.generate(prompt, 150);

    if (!isRight(response)) {
      return {
        tipo: 'voz',
        confianza: 0.5,
        descripcion: 'Audio con contenido de voz.',
        recomendacion: 'Transcripción disponible.',
      };
    }

    try {
      const clean = response.right.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return {
        tipo: parsed.tipo ?? 'voz',
        confianza: parsed.confianza ?? 0.7,
        descripcion: parsed.descripcion ?? '',
        recomendacion: parsed.recomendacion ?? '',
      };
    } catch {
      return {
        tipo: 'voz',
        confianza: 0.6,
        descripcion: 'Audio procesado.',
        recomendacion: 'Transcripción disponible.',
      };
    }
  }

  async resumir(transcripcion: string): Promise<{ resumen: string; puntosClave: string[] }> {
    if (transcripcion.split(' ').length < 20) {
      return { resumen: transcripcion, puntosClave: [] };
    }

    const prompt =
      `Eres un asistente de notas. Resume esta transcripción de audio de forma clara y útil.\n\n` +
      `Transcripción:\n"${transcripcion}"\n\n` +
      `Responde SOLO con JSON válido sin markdown:\n` +
      `{"resumen":"2-3 oraciones con lo más importante","puntosClave":["punto 1","punto 2","punto 3"]}`;

    const response = await aiService.generate(prompt, 400);

    if (!isRight(response)) {
      return { resumen: transcripcion.slice(0, 200), puntosClave: [] };
    }

    try {
      const clean = response.right.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      return {
        resumen: parsed.resumen ?? '',
        puntosClave: parsed.puntosClave ?? [],
      };
    } catch {
      return { resumen: transcripcion.slice(0, 200), puntosClave: [] };
    }
  }

  async procesarCompleto(opts: {
    buffer: Buffer;
    extension: string;
    esNotaDeVoz: boolean;
    resumir: boolean;
    idioma?: string;
  }): Promise<TranscripcionCompleta> {
    const info = this.validar(opts.buffer, opts.esNotaDeVoz);
    if (!info.valido) {
      return left({ message: info.error ?? 'Audio inválido' });
    }

    const duracionEst = estimarDuracion(info.tamañoKB, opts.extension);

    const { buffer, comprimido, extension } = await this.comprimir(opts.buffer, opts.extension);
    info.comprimido = comprimido;

    const transcResponse = await aiService.transcribeAudio(buffer, extension, opts.idioma);

    if (!isRight(transcResponse)) {
      return left({ message: transcResponse.left.message ?? 'No pude transcribir el audio.' });
    }

    const texto = transcResponse.right.trim();

    if (!texto) {
      return left({ message: 'No se detectó voz en el audio. Asegúrate de que haya voz clara.' });
    }
    const [analisis, resumenData] = await Promise.all([
      this.analizarTipo(texto, duracionEst),
      opts.resumir ? this.resumir(texto) : Promise.resolve(null),
    ]);

    return right({
      texto,
      resumen: resumenData?.resumen,
      puntosClave: resumenData?.puntosClave,
      duracionEst,
      info,
      analisis,
    });
  }

  formatearResultado(
    result: TranscripcionCompleta,
    modo: 'simple' | 'completo' | 'resumen',
  ): string {
    if (result._tag === 'Left') {
      return `❌ ${result.left.message}`;
    }

    const success = result.right;
    const info = success.info;
    const analisis = success.analisis;

    if (modo === 'simple') {
      return `🎙️ *Transcripción:*\n\n${success.texto}`;
    }

    if (modo === 'resumen') {
      let msg = `📋 *Resumen del audio*\n━━━━━━━━━━\n\n`;

      if (success.resumen) {
        msg += `📝 *Resumen:*\n${success.resumen}\n\n`;
      }

      if (success.puntosClave?.length) {
        msg += `🔑 *Puntos clave:*\n`;
        success.puntosClave.forEach((p: string) => {
          msg += `• ${p}\n`;
        });
        msg += '\n';
      }

      msg += `📄 *Transcripción completa:*\n${success.texto}\n\n`;
      msg += `> _VaniaBot🎙️ — Transcriptor IA_`;
      return msg;
    }

    let msg = `🎙️ *Transcripción*\n━━━━━━━━\n\n`;
    msg += success.texto;
    msg += '\n\n━━━━━━━━\n';

    const tipoEmoji: Record<string, string> = {
      voz: '🗣️',
      musica: '🎵',
      silencio: '🔇',
      ruido: '🔊',
      desconocido: '❓',
    };

    if (analisis) {
      msg += `${tipoEmoji[analisis.tipo] ?? '🎵'} Tipo: *${analisis.tipo}*`;
      if (analisis.confianza > 0) msg += ` (${Math.round(analisis.confianza * 100)}%)`;
      msg += '\n';
    }

    if (success.duracionEst) msg += `⏱️ Duración: ${success.duracionEst}\n`;
    if (info?.tamañoKB) msg += `💾 Tamaño: ${info.tamañoKB.toFixed(0)} KB`;
    if (info?.comprimido) msg += ` _(comprimido)_`;
    msg += '\n';

    msg += `\n> _VaniaBot🎙️ — Transcriptor IA_`;
    return msg;
  }
}

export const audioService = new AudioService();
