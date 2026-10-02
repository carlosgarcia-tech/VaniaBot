/**
 * PoesiaParser.ts
 *
 * VaniaBot services module exposing `ParsedArgs`, `parsePoesiaArgs`, `ESTILO_ALIASES`, `TEMA_ALIASES`.
 *
 * @author **Carlos G**
 */

import { ContenidoTipo, EstiloPoema, TemaPoema, type GenerarOpts } from './PoesiaTypes.js';

export const ESTILO_ALIASES: Record<string, EstiloPoema> = {
  romantico: EstiloPoema.ROMANTICO,
  romántico: EstiloPoema.ROMANTICO,
  romance: EstiloPoema.ROMANTICO,
  melancolico: EstiloPoema.MELANCOLICO,
  melancólico: EstiloPoema.MELANCOLICO,
  triste: EstiloPoema.MELANCOLICO,
  sad: EstiloPoema.MELANCOLICO,
  apasionado: EstiloPoema.APASIONADO,
  intenso: EstiloPoema.APASIONADO,
  pasion: EstiloPoema.APASIONADO,
  pasión: EstiloPoema.APASIONADO,
  tierno: EstiloPoema.TIERNO,
  dulce: EstiloPoema.TIERNO,
  cute: EstiloPoema.TIERNO,
  picaro: EstiloPoema.PICARO,
  pícaro: EstiloPoema.PICARO,
  coqueto: EstiloPoema.PICARO,
  hot: EstiloPoema.PICARO,
  atrevido: EstiloPoema.PICARO,
  epico: EstiloPoema.EPICO,
  épico: EstiloPoema.EPICO,
  dramático: EstiloPoema.EPICO,
  dramatico: EstiloPoema.EPICO,
  mistico: EstiloPoema.MISTICO,
  místico: EstiloPoema.MISTICO,
  espiritual: EstiloPoema.MISTICO,
  profundo: EstiloPoema.MISTICO,
  moderno: EstiloPoema.MODERNO,
  urbano: EstiloPoema.MODERNO,
  actual: EstiloPoema.MODERNO,
  clasico: EstiloPoema.CLASICO,
  clásico: EstiloPoema.CLASICO,
  formal: EstiloPoema.CLASICO,
  sarcastico: EstiloPoema.SARCASTICO,
  sarcástico: EstiloPoema.SARCASTICO,
  ironico: EstiloPoema.SARCASTICO,
  irónico: EstiloPoema.SARCASTICO,
  chistoso: EstiloPoema.CHISTOSO,
  gracioso: EstiloPoema.CHISTOSO,
  comico: EstiloPoema.CHISTOSO,
  cómico: EstiloPoema.CHISTOSO,
  funny: EstiloPoema.CHISTOSO,
  oscuro: EstiloPoema.OSCURO,
  dark: EstiloPoema.OSCURO,
  sombrio: EstiloPoema.OSCURO,
};

export const TEMA_ALIASES: Record<string, string> = {
  amor: TemaPoema.AMOR,
  love: TemaPoema.AMOR,
  desamor: TemaPoema.DESAMOR,
  ruptura: TemaPoema.DESAMOR,
  corazon: TemaPoema.DESAMOR,
  naturaleza: TemaPoema.NATURALEZA,
  nature: TemaPoema.NATURALEZA,
  amistad: TemaPoema.AMISTAD,
  amigos: TemaPoema.AMISTAD,
  vida: TemaPoema.VIDA,
  existencia: TemaPoema.VIDA,
  muerte: TemaPoema.MUERTE,
  muerto: TemaPoema.MUERTE,
  esperanza: TemaPoema.ESPERANZA,
  fe: TemaPoema.ESPERANZA,
  soledad: TemaPoema.SOLEDAD,
  solo: TemaPoema.SOLEDAD,
  alegria: TemaPoema.ALEGRIA,
  alegría: TemaPoema.ALEGRIA,
  felicidad: TemaPoema.ALEGRIA,
  noche: TemaPoema.NOCHE,
  medianoche: TemaPoema.NOCHE,
  mar: TemaPoema.MAR,
  ocean: TemaPoema.MAR,
  océano: TemaPoema.MAR,
  luna: TemaPoema.LUNA,
  moon: TemaPoema.LUNA,
  patria: TemaPoema.PATRIA,
  mexico: TemaPoema.PATRIA,
  nostalgia: TemaPoema.NOSTALGIA,
  recuerdo: TemaPoema.NOSTALGIA,
  libertad: TemaPoema.LIBERTAD,
  libre: TemaPoema.LIBERTAD,
};

export interface ParsedArgs {
  opts: GenerarOpts;
  nombre?: string;
  rawText: string;
}

export function parsePoesiaArgs(tipo: ContenidoTipo, args: string[]): ParsedArgs {
  const raw = args.join(' ').trim();
  const opts: GenerarOpts = { tipo };
  let nombre: string | undefined;

  if (!raw) return { opts, rawText: raw };

  const tokens = args.map(a => a.toLowerCase());

  const paraIdx = tokens.findIndex(t => t.startsWith('para:') || t === 'para');
  if (paraIdx !== -1) {
    if (tokens[paraIdx].startsWith('para:')) {
      opts.dedicado = args[paraIdx].slice(5).replace(/^@/, '');
    } else if (args[paraIdx + 1]) {
      opts.dedicado = args[paraIdx + 1].replace(/^@/, '');
      args.splice(paraIdx + 1, 1);
    }
    args.splice(paraIdx, 1);
    tokens.splice(paraIdx, Math.min(2, tokens.length - paraIdx));
  }

  if (tipo === ContenidoTipo.ACROSTICO) {
    const nombreRaw = args[0];
    if (nombreRaw && /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ]+$/i.test(nombreRaw)) {
      nombre = nombreRaw.toUpperCase();
      opts.nombre = nombre;
      opts.dedicado = opts.dedicado ?? nombreRaw;
      args.shift();
      tokens.shift();
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const estilo = ESTILO_ALIASES[tokens[i]];
    if (estilo) {
      opts.estilo = estilo;
      args.splice(i, 1);
      tokens.splice(i, 1);
      break;
    }
  }

  let temaEncontrado = false;
  for (let i = 0; i < tokens.length; i++) {
    const tema = TEMA_ALIASES[tokens[i]];
    if (tema) {
      opts.tema = tema;
      args.splice(i, 1);
      tokens.splice(i, 1);
      temaEncontrado = true;
      break;
    }
  }

  if (!temaEncontrado && args.length > 0) {
    const temaLibre = args.join(' ').trim();
    if (temaLibre) opts.tema = temaLibre;
    args.length = 0;
  } else if (temaEncontrado && args.length > 0) {
    opts.contexto = args.join(' ').trim();
  }

  return { opts, nombre, rawText: raw };
}

export const HELP_TEXTS: Record<ContenidoTipo, string> = {
  [ContenidoTipo.POEMA]: `🌹 *Poema*
_!poema [tema] [estilo] [para:nombre]_

• !poema amor
• !poema desamor melancólico
• !poema la luna para:María
• !poema nuestro primer encuentro romántico`,

  [ContenidoTipo.FRASE]: `✨ *Frases*
_!frases [tema] [estilo]_

• !frases amor
• !frases vida apasionado
• !frases nostalgia oscuro`,

  [ContenidoTipo.PIROPO]: `😏 *Piropos*
_!piropo [estilo] [para:nombre]_

• !piropo
• !piropo chistoso
• !piropo pícaro para:Ana
• !piropo tierno`,

  [ContenidoTipo.DEDICATORIA]: `💌 *Dedicatoria*
_!dedicatoria [tema/ocasión] [estilo] [para:nombre]_

• !dedicatoria para:Carlos
• !dedicatoria cumpleaños para:Ana tierno
• !dedicatoria primer aniversario romántico`,

  [ContenidoTipo.HAIKU]: `🍃 *Haiku*
_!haiku [tema] [estilo]_

• !haiku amor
• !haiku naturaleza místico
• !haiku noche melancólico`,

  [ContenidoTipo.SONETO]: `📜 *Soneto*
_!soneto [tema] [estilo] [para:nombre]_

• !soneto amor
• !soneto desamor clásico
• !soneto vida épico`,

  [ContenidoTipo.COPLA]: `🎶 *Coplas*
_!copla [tema] [estilo]_

• !copla amor
• !copla vida pícaro
• !copla amistad chistoso`,

  [ContenidoTipo.ACROSTICO]: `🔤 *Acróstico*
_!acrostico [NOMBRE] [tema] [estilo]_

• !acrostico MARIA
• !acrostico CARLOS amor romántico
• !acrostico ANA vida tierno`,

  [ContenidoTipo.CARTA]: `💌 *Carta de Amor*
_!carta [tema/motivo] [estilo] [para:nombre]_

• !carta para:Ana
• !carta despedida melancólico
• !carta primer amor romántico para:Carlos`,

  [ContenidoTipo.HISTORIA]: `📖 *Historia de Amor*
_!historia [tema] [estilo]_

• !historia amor
• !historia desamor melancólico
• !historia encuentro inesperado romántico`,
};

export const ESTILOS_LIST = [
  '💕 romántico',
  '😢 melancólico',
  '🔥 apasionado',
  '🌸 tierno',
  '😏 pícaro',
  '⚔️ épico',
  '🌌 místico',
  '🏙️ moderno',
  '📖 clásico',
  '😒 sarcástico',
  '😂 chistoso',
  '🖤 oscuro',
].join('  ');

export const TEMAS_LIST = [
  '❤️ amor',
  '💔 desamor',
  '🌿 naturaleza',
  '👫 amistad',
  '✨ vida',
  '🌙 muerte',
  '🌅 esperanza',
  '🏠 soledad',
  '😊 alegría',
  '🌃 noche',
  '🌊 mar',
  '🌕 luna',
  '🇲🇽 patria',
  '🕊️ nostalgia',
  '🦋 libertad',
].join('  ');
