/**
 * TranslatorTypes.ts
 *
 * VaniaBot services module exposing `TraduccionSuccess`, `TraduccionOpts`, `resolverIdioma`, `idiomasDisponibles`.
 *
 * @author **Carlos G**
 */

export const IDIOMAS: Record<string, { nombre: string; bandera: string; codigo: string }> = {
  es: { nombre: 'Español', bandera: '🇲🇽', codigo: 'es' },
  español: { nombre: 'Español', bandera: '🇲🇽', codigo: 'es' },
  spanish: { nombre: 'Español', bandera: '🇲🇽', codigo: 'es' },
  spa: { nombre: 'Español', bandera: '🇲🇽', codigo: 'es' },

  en: { nombre: 'Inglés', bandera: '🇺🇸', codigo: 'en' },
  inglés: { nombre: 'Inglés', bandera: '🇺🇸', codigo: 'en' },
  ingles: { nombre: 'Inglés', bandera: '🇺🇸', codigo: 'en' },
  english: { nombre: 'Inglés', bandera: '🇺🇸', codigo: 'en' },
  eng: { nombre: 'Inglés', bandera: '🇺🇸', codigo: 'en' },

  pt: { nombre: 'Portugués', bandera: '🇧🇷', codigo: 'pt' },
  portugués: { nombre: 'Portugués', bandera: '🇧🇷', codigo: 'pt' },
  portugues: { nombre: 'Portugués', bandera: '🇧🇷', codigo: 'pt' },
  portuguese: { nombre: 'Portugués', bandera: '🇧🇷', codigo: 'pt' },

  fr: { nombre: 'Francés', bandera: '🇫🇷', codigo: 'fr' },
  francés: { nombre: 'Francés', bandera: '🇫🇷', codigo: 'fr' },
  frances: { nombre: 'Francés', bandera: '🇫🇷', codigo: 'fr' },
  french: { nombre: 'Francés', bandera: '🇫🇷', codigo: 'fr' },

  de: { nombre: 'Alemán', bandera: '🇩🇪', codigo: 'de' },
  alemán: { nombre: 'Alemán', bandera: '🇩🇪', codigo: 'de' },
  aleman: { nombre: 'Alemán', bandera: '🇩🇪', codigo: 'de' },
  german: { nombre: 'Alemán', bandera: '🇩🇪', codigo: 'de' },

  it: { nombre: 'Italiano', bandera: '🇮🇹', codigo: 'it' },
  italiano: { nombre: 'Italiano', bandera: '🇮🇹', codigo: 'it' },
  italian: { nombre: 'Italiano', bandera: '🇮🇹', codigo: 'it' },

  ja: { nombre: 'Japonés', bandera: '🇯🇵', codigo: 'ja' },
  japonés: { nombre: 'Japonés', bandera: '🇯🇵', codigo: 'ja' },
  japones: { nombre: 'Japonés', bandera: '🇯🇵', codigo: 'ja' },
  japanese: { nombre: 'Japonés', bandera: '🇯🇵', codigo: 'ja' },
  jp: { nombre: 'Japonés', bandera: '🇯🇵', codigo: 'ja' },

  ko: { nombre: 'Coreano', bandera: '🇰🇷', codigo: 'ko' },
  coreano: { nombre: 'Coreano', bandera: '🇰🇷', codigo: 'ko' },
  korean: { nombre: 'Coreano', bandera: '🇰🇷', codigo: 'ko' },
  kr: { nombre: 'Coreano', bandera: '🇰🇷', codigo: 'ko' },

  zh: { nombre: 'Chino', bandera: '🇨🇳', codigo: 'zh' },
  chino: { nombre: 'Chino', bandera: '🇨🇳', codigo: 'zh' },
  chinese: { nombre: 'Chino', bandera: '🇨🇳', codigo: 'zh' },
  cn: { nombre: 'Chino', bandera: '🇨🇳', codigo: 'zh' },

  ar: { nombre: 'Árabe', bandera: '🇸🇦', codigo: 'ar' },
  árabe: { nombre: 'Árabe', bandera: '🇸🇦', codigo: 'ar' },
  arabe: { nombre: 'Árabe', bandera: '🇸🇦', codigo: 'ar' },
  arabic: { nombre: 'Árabe', bandera: '🇸🇦', codigo: 'ar' },

  ru: { nombre: 'Ruso', bandera: '🇷🇺', codigo: 'ru' },
  ruso: { nombre: 'Ruso', bandera: '🇷🇺', codigo: 'ru' },
  russian: { nombre: 'Ruso', bandera: '🇷🇺', codigo: 'ru' },

  hi: { nombre: 'Hindi', bandera: '🇮🇳', codigo: 'hi' },
  hindi: { nombre: 'Hindi', bandera: '🇮🇳', codigo: 'hi' },

  tr: { nombre: 'Turco', bandera: '🇹🇷', codigo: 'tr' },
  turco: { nombre: 'Turco', bandera: '🇹🇷', codigo: 'tr' },
  turkish: { nombre: 'Turco', bandera: '🇹🇷', codigo: 'tr' },

  nl: { nombre: 'Holandés', bandera: '🇳🇱', codigo: 'nl' },
  holandés: { nombre: 'Holandés', bandera: '🇳🇱', codigo: 'nl' },
  hoalandes: { nombre: 'Holandés', bandera: '🇳🇱', codigo: 'nl' },
  dutch: { nombre: 'Holandés', bandera: '🇳🇱', codigo: 'nl' },

  pl: { nombre: 'Polaco', bandera: '🇵🇱', codigo: 'pl' },
  polaco: { nombre: 'Polaco', bandera: '🇵🇱', codigo: 'pl' },
  polish: { nombre: 'Polaco', bandera: '🇵🇱', codigo: 'pl' },

  el: { nombre: 'Griego', bandera: '🇬🇷', codigo: 'el' },
  griego: { nombre: 'Griego', bandera: '🇬🇷', codigo: 'el' },
  greek: { nombre: 'Griego', bandera: '🇬🇷', codigo: 'el' },

  sv: { nombre: 'Sueco', bandera: '🇸🇪', codigo: 'sv' },
  sueco: { nombre: 'Sueco', bandera: '🇸🇪', codigo: 'sv' },
  swedish: { nombre: 'Sueco', bandera: '🇸🇪', codigo: 'sv' },

  no: { nombre: 'Noruego', bandera: '🇳🇴', codigo: 'no' },
  noruego: { nombre: 'Noruego', bandera: '🇳🇴', codigo: 'no' },
  norwegian: { nombre: 'Noruego', bandera: '🇳🇴', codigo: 'no' },

  he: { nombre: 'Hebreo', bandera: '🇮🇱', codigo: 'he' },
  hebreo: { nombre: 'Hebreo', bandera: '🇮🇱', codigo: 'he' },
  hebrew: { nombre: 'Hebreo', bandera: '🇮🇱', codigo: 'he' },

  th: { nombre: 'Tailandés', bandera: '🇹🇭', codigo: 'th' },
  tailandés: { nombre: 'Tailandés', bandera: '🇹🇭', codigo: 'th' },
  tailandes: { nombre: 'Tailandés', bandera: '🇹🇭', codigo: 'th' },
  thai: { nombre: 'Tailandés', bandera: '🇹🇭', codigo: 'th' },

  id: { nombre: 'Indonesio', bandera: '🇮🇩', codigo: 'id' },
  indonesio: { nombre: 'Indonesio', bandera: '🇮🇩', codigo: 'id' },
  indonesian: { nombre: 'Indonesio', bandera: '🇮🇩', codigo: 'id' },

  vi: { nombre: 'Vietnamita', bandera: '🇻🇳', codigo: 'vi' },
  vietnamita: { nombre: 'Vietnamita', bandera: '🇻🇳', codigo: 'vi' },
  vietnamese: { nombre: 'Vietnamita', bandera: '🇻🇳', codigo: 'vi' },

  ca: { nombre: 'Catalán', bandera: '🏴', codigo: 'ca' },
  catalán: { nombre: 'Catalán', bandera: '🏴', codigo: 'ca' },
  catalan: { nombre: 'Catalán', bandera: '🏴', codigo: 'ca' },

  la: { nombre: 'Latín', bandera: '🏛️', codigo: 'la' },
  latin: { nombre: 'Latín', bandera: '🏛️', codigo: 'la' },
  latín: { nombre: 'Latín', bandera: '🏛️', codigo: 'la' },
};

import type { Either } from '@/utils/either.js';
import type { ValidationError, NetworkError } from '@/utils/errors.js';

export interface TraduccionSuccess {
  traduccion: string;
  idiomaOrigen: string;
  idiomaDestino: string;
  bandOrigen: string;
  bandDestino: string;
  textoOriginal?: string;
  notas?: string;
}

export type TraduccionError = ValidationError | NetworkError;
export type TraduccionResult = Either<TraduccionError, TraduccionSuccess>;

export interface TraduccionOpts {
  texto: string;
  idiomaDestino: string;
  idiomaOrigen?: string;
  formal?: boolean;
  notas?: boolean;
  modo?: 'literal' | 'contextual' | 'libre';
}

export function resolverIdioma(
  input: string,
): { nombre: string; bandera: string; codigo: string } | null {
  return IDIOMAS[input.toLowerCase().trim()] ?? null;
}

export function idiomasDisponibles(): string {
  const unicos = new Map<string, { nombre: string; bandera: string }>();
  for (const v of Object.values(IDIOMAS)) {
    if (!unicos.has(v.codigo)) unicos.set(v.codigo, { nombre: v.nombre, bandera: v.bandera });
  }
  return [...unicos.values()].map(i => `${i.bandera} ${i.nombre}`).join('  ');
}
