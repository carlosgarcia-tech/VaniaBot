/**
 * TranslatorService.ts
 *
 * VaniaBot services module exposing `translatorService`.
 *
 * @author **Carlos G**
 */

import { isLeft, left, right } from '@/utils/either.js';
import { aiService } from '@/services/external/AIService.js';
import { ValidationError, NetworkError } from '@/utils/errors.js';
import { resolverIdioma, type TraduccionOpts, type TraduccionResult } from './TranslatorTypes.js';

interface CacheEntry {
  result: TraduccionResult;
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CHARS = 2000;

function buildPrompt(opts: TraduccionOpts): string {
  const dest = resolverIdioma(opts.idiomaDestino);
  const origen = opts.idiomaOrigen ? resolverIdioma(opts.idiomaOrigen) : null;

  const idiomaDestinoNombre = dest?.nombre ?? opts.idiomaDestino;
  const idiomaOrigenNombre = origen?.nombre ?? opts.idiomaOrigen ?? 'detectar automáticamente';

  const modoInstr = {
    literal: 'Traduce de forma literal y fiel, respetando cada palabra lo más posible.',
    contextual:
      'Traduce de forma contextual: preserva el significado, tono y registro. Adapta expresiones idiomáticas al idioma destino de forma natural.',
    libre:
      'Traduce con libertad creativa: el resultado debe sonar completamente nativo en el idioma destino, aunque no sea literal.',
  }[opts.modo ?? 'contextual'];

  const formalInstr = opts.formal
    ? 'Usa un registro formal y profesional.'
    : 'Mantén el mismo registro del texto original (coloquial si es coloquial, formal si es formal).';

  const notasInstr = opts.notas
    ? `Después de la traducción, en una nueva línea que empiece con "📝 Notas:", añade brevemente observaciones culturales, diferencias de expresión o alternativas relevantes (máximo 2 líneas).`
    : '';

  return `Eres un traductor experto y contextual.

Idioma origen: ${idiomaOrigenNombre}
Idioma destino: ${idiomaDestinoNombre}

Instrucciones:
- ${modoInstr}
- ${formalInstr}
- Preserva emojis, saltos de línea y formato del texto original.
- NO añadas introducción, NO escribas "Traducción:", NO pongas comillas alrededor.
- Responde ÚNICAMENTE con la traducción (y las notas si aplica).
${notasInstr}

Texto a traducir:
${opts.texto}`;
}

function buildDetectPrompt(texto: string): string {
  return `Identifica el idioma del siguiente texto. Responde ÚNICAMENTE con el código ISO 639-1 de 2 letras (ej: "es", "en", "fr", "ja"). Sin explicaciones.

Texto: ${texto.slice(0, 300)}`;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

class TranslatorService {
  private cache = new Map<string, CacheEntry>();

  async traducir(opts: TraduccionOpts): Promise<TraduccionResult> {
    if (opts.texto.length > MAX_CHARS) {
      return left(
        new ValidationError(
          `El texto es muy largo (máx ${MAX_CHARS} caracteres). Tienes ${opts.texto.length}.`,
        ),
      );
    }

    if (!opts.texto.trim()) {
      return left(new ValidationError('No hay texto para traducir.'));
    }

    const dest = resolverIdioma(opts.idiomaDestino);
    if (!dest) {
      return left(
        new ValidationError(
          `Idioma desconocido: "${opts.idiomaDestino}". Usa *!traducir idiomas* para ver los disponibles.`,
        ),
      );
    }

    const normalizedOpts: TraduccionOpts = {
      ...opts,
      idiomaDestino: dest.codigo,
    };

    const cacheKey = `${dest.codigo}::${opts.idiomaOrigen ?? 'auto'}::${opts.modo ?? 'contextual'}::${opts.texto}`;
    if (!opts.notas) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        const cachedResult = cached.result;
        if (cachedResult._tag === 'Right' && cachedResult.right.notas !== undefined) {
          return right({ ...cachedResult.right, notas: cachedResult.right.notas + ' (caché)' });
        }
        return cachedResult;
      }
    }

    let origenNombre = opts.idiomaOrigen ?? 'Detectado automáticamente';
    let origenBand = '🔍';

    if (!opts.idiomaOrigen) {
      const detectado = await this._detectarIdioma(opts.texto);
      if (detectado) {
        const origenResuelto = resolverIdioma(detectado);
        if (origenResuelto) {
          origenNombre = origenResuelto.nombre;
          origenBand = origenResuelto.bandera;
          normalizedOpts.idiomaOrigen = origenResuelto.codigo;
        }
      }
    } else {
      const origenResuelto = resolverIdioma(opts.idiomaOrigen);
      if (origenResuelto) {
        origenNombre = origenResuelto.nombre;
        origenBand = origenResuelto.bandera;
      }
    }

    const prompt = buildPrompt(normalizedOpts);
    const response = await aiService.generate(prompt, 1000);

    if (isLeft(response)) {
      return left(
        new NetworkError(
          extractErrorMessage(response.left) ?? 'No pude traducir el texto. Intenta de nuevo.',
        ),
      );
    }

    let traduccion = response.right.trim();
    let notas: string | undefined;

    if (opts.notas) {
      const notasIdx = traduccion.indexOf('📝 Notas:');
      if (notasIdx !== -1) {
        notas = traduccion.slice(notasIdx).trim();
        traduccion = traduccion.slice(0, notasIdx).trim();
      }
    }

    const result = right({
      traduccion,
      textoOriginal: opts.texto,
      idiomaOrigen: origenNombre,
      idiomaDestino: dest.nombre,
      bandOrigen: origenBand,
      bandDestino: dest.bandera,
      notas,
    });

    if (!opts.notas) {
      this.cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL });
    }

    return result;
  }

  async detectarIdioma(texto: string): Promise<TraduccionResult> {
    const detectado = await this._detectarIdioma(texto);
    if (!detectado) {
      return left(new NetworkError('No pude detectar el idioma.'));
    }

    const resuelto = resolverIdioma(detectado);
    return right({
      idiomaOrigen: resuelto?.nombre ?? detectado,
      bandOrigen: resuelto?.bandera ?? '🔍',
      textoOriginal: texto,
      traduccion: '',
      idiomaDestino: '',
      bandDestino: '',
    });
  }

  private async _detectarIdioma(texto: string): Promise<string | null> {
    const prompt = buildDetectPrompt(texto);
    const response = await aiService.generate(prompt, 10);
    if (isLeft(response)) return null;
    return (
      response.right
        .trim()
        .toLowerCase()
        .slice(0, 5)
        .replace(/[^a-z]/g, '') || null
    );
  }

  cleanCache(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now > v.expiresAt) this.cache.delete(k);
    }
  }

  formatResult(result: TraduccionResult, mostrarOriginal = false): string {
    if (result._tag === 'Left') return `❌ ${result.left.message}`;

    const success = result.right;
    let msg = '';

    msg += `${success.bandOrigen ?? '🔍'} ${success.idiomaOrigen ?? '?'} `;
    msg += `→ ${success.bandDestino ?? '🌐'} *${success.idiomaDestino ?? '?'}*\n`;
    msg += `━━━━━━━━━━━━\n\n`;

    if (mostrarOriginal && success.textoOriginal) {
      msg += `_Original:_\n${success.textoOriginal}\n\n`;
      msg += `_Traducción:_\n`;
    }

    msg += success.traduccion;

    if (success.notas) {
      msg += `\n\n${success.notas}`;
    }

    msg += `\n\n> _VaniaBot🌐 — Traductor contextual_`;
    return msg;
  }
}

export const translatorService = new TranslatorService();
