/**
 * PoesiaPrompts.ts
 *
 * VaniaBot services module exposing `buildPoemaPrompt`, `buildFrasePrompt`, `buildPiropopPrompt`, `buildDedicatoriaPrompt`.
 *
 * @author **Carlos G**
 */

import { ContenidoTipo, EstiloPoema, type GenerarOpts } from './PoesiaTypes.js';

const PERSONALIDAD_BASE = `Eres un poeta y escritor creativo de VaniaBot.
Tu escritura es fresca, emotiva y en español mexicano/latinoamericano.
Usa lenguaje natural, no cursi en exceso. Evita clichés como "tus ojos son dos luceros".
Responde ÚNICAMENTE con el contenido pedido, sin introducción, sin "aquí tienes tu poema", sin comillas alrededor.`;

function estiloInstruccion(estilo?: string): string {
  if (!estilo) return '';
  const map: Record<string, string> = {
    romántico: 'Estilo romántico: sentimientos profundos, imágenes bellas, emoción contenida.',
    melancólico: 'Estilo melancólico: nostalgia, pérdida, belleza en la tristeza.',
    apasionado: 'Estilo apasionado: intenso, visceral, lleno de fuego y deseo.',
    tierno: 'Estilo tierno: suave, cálido, dulce sin ser empalagoso.',
    pícaro: 'Estilo pícaro: coqueto, con doble sentido elegante, travieso.',
    épico: 'Estilo épico: grandioso, dramático, como una historia heroica.',
    místico: 'Estilo místico: metáforas profundas, referencias a lo espiritual y universal.',
    moderno: 'Estilo moderno: lenguaje cotidiano, verso libre, referencias contemporáneas.',
    clásico: 'Estilo clásico: estructura formal, rima consonante o asonante, vocabulario culto.',
    sarcástico: 'Estilo sarcástico: irónico, mordaz, con humor negro o cinismo.',
    chistoso: 'Estilo chistoso: gracioso, rima humorística, que arranque una carcajada.',
    oscuro: 'Estilo oscuro: metáforas sombrías, belleza en lo oscuro, atmósfera densa.',
  };
  return map[estilo] ?? `Estilo: ${estilo}.`;
}

function dedicatoriaLinea(dedicado?: string): string {
  if (!dedicado) return '';
  return `Va dedicado a: *${dedicado}*. Personalízalo mencionando ese nombre de forma natural.`;
}

export function buildPoemaPrompt(opts: GenerarOpts): string {
  const versos = opts.versos ?? 12;
  return `${PERSONALIDAD_BASE}

Escribe un poema sobre "${opts.tema ?? 'amor'}" con las siguientes características:
- ${versos} versos aproximadamente, organizados en estrofas de 4 versos
- ${estiloInstruccion(opts.estilo) || 'Estilo libre y emotivo'}
- ${dedicatoriaLinea(opts.dedicado)}
- ${opts.contexto ? `Contexto especial: ${opts.contexto}` : ''}
- Usa imágenes poéticas originales, no clichés
- El último verso debe ser memorable y contundente
- Formato WhatsApp: usa _cursiva_ solo para el título si quieres`;
}

export function buildFrasePrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Genera 5 frases hermosas y originales sobre "${opts.tema ?? 'amor'}".
${estiloInstruccion(opts.estilo)}
${dedicatoriaLinea(opts.dedicado)}
${opts.contexto ? `Contexto: ${opts.contexto}` : ''}

Reglas:
- Cada frase en su propia línea, precedida de un emoji relevante
- Entre 15 y 40 palabras cada una
- Profundas, evocadoras, que den ganas de compartirlas
- No numeres las frases, solo el emoji al inicio`;
}

export function buildPiropopPrompt(opts: GenerarOpts): string {
  const picante = opts.estilo === EstiloPoema.PICARO;
  return `${PERSONALIDAD_BASE}

Genera 5 piropos ${picante ? 'pícaros y atrevidos (sin ser vulgares)' : 'creativos y encantadores'} para decirle a alguien especial.
${dedicatoriaLinea(opts.dedicado)}
${opts.contexto ? `La persona es: ${opts.contexto}` : ''}

Reglas:
- Un piropo por línea, con emoji al inicio
- Originales, que no se escuchen repetidos
- ${picante ? 'Con doble sentido elegante, sugerente pero no grosero' : 'Encantadores, que hagan sonrojar de la emoción'}
- Mezcla humor con ternura
- En español latinoamericano natural`;
}

export function buildDedicatoriaPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe una dedicatoria emotiva y personal ${opts.dedicado ? `para *${opts.dedicado}*` : 'para alguien especial'}.
${opts.tema ? `Motivo/ocasión: ${opts.tema}` : ''}
${estiloInstruccion(opts.estilo)}
${opts.contexto ? `Contexto: ${opts.contexto}` : ''}

Estructura:
- Inicio: saludo cálido y personalizado
- Desarrollo: 3-4 oraciones emotivas con imágenes bellas
- Cierre: frase final que quede grabada en la memoria
- Longitud: media (no muy corta, no muy larga — como para escribir en una tarjeta o nota)
- Tono: sincero, desde el corazón, que se sienta real`;
}

export function buildHaikuPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe 3 haikus sobre "${opts.tema ?? 'amor'}" en español.
${estiloInstruccion(opts.estilo)}
${dedicatoriaLinea(opts.dedicado)}

Reglas del haiku en español:
- Estructura: 5-7-5 sílabas (aproximado, el español es más flexible)
- Cada haiku separado por una línea en blanco
- Imagen concreta, momento específico, naturaleza o emoción pura
- Sin título para cada uno
- Al final, pon el número de sílabas entre paréntesis: (5-7-5)`;
}

export function buildSonetoPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe un soneto sobre "${opts.tema ?? 'amor'}".
${estiloInstruccion(opts.estilo) || 'Estilo clásico con toques modernos'}
${dedicatoriaLinea(opts.dedicado)}
${opts.contexto ? `Contexto: ${opts.contexto}` : ''}

Estructura del soneto:
- 14 versos en total
- Dos cuartetos (ABBA ABBA) + dos tercetos (CDC DCD o similar)
- Rima consonante preferiblemente
- El verso 14 (estrambote) debe ser el más impactante
- Vocabulario elevado pero comprensible`;
}

export function buildCoplasPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe 4 coplas sobre "${opts.tema ?? 'amor'}" al estilo de la poesía popular latinoamericana.
${estiloInstruccion(opts.estilo)}
${dedicatoriaLinea(opts.dedicado)}

Reglas de la copla:
- 4 versos por copla, octosílabos (8 sílabas aprox)
- Rima: el 2do y 4to verso riman (ABCB)
- Tono popular, cercano, como canción del pueblo
- Pueden ser tiernas, picaras o melancólicas
- Separa cada copla con una línea en blanco`;
}

export function buildAcrosticoPrompt(opts: GenerarOpts): string {
  const nombre = (opts.nombre ?? opts.dedicado ?? 'AMOR').toUpperCase();
  return `${PERSONALIDAD_BASE}

Escribe un acróstico con el nombre *${nombre}*.
${estiloInstruccion(opts.estilo) || 'Estilo romántico y emotivo'}
${opts.tema ? `Tema: ${opts.tema}` : 'Tema: amor y sentimientos'}
${opts.contexto ? `Contexto: ${opts.contexto}` : ''}

Reglas:
- Cada verso comienza con la letra correspondiente del nombre: ${nombre.split('').join(' - ')}
- El conjunto debe tener sentido y emoción, no solo palabras sueltas
- Formato: pon la letra inicial en *negrita* (usando *letra*)
- Debe ser coherente, que fluya como un poema real
- Entre 6 y 12 palabras por verso`;
}

export function buildCartaPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe una carta de amor ${opts.estilo === EstiloPoema.MELANCOLICO ? 'de despedida o añoranza' : 'apasionada y sincera'} ${opts.dedicado ? `para *${opts.dedicado}*` : ''}.
${estiloInstruccion(opts.estilo)}
${opts.tema ? `Situación/motivo: ${opts.tema}` : ''}
${opts.contexto ? `Contexto extra: ${opts.contexto}` : ''}

Estructura:
- Encabezado: fecha poética (no una fecha real) y saludo especial
- Párrafo 1: cómo esa persona llegó a su vida / qué la hace especial
- Párrafo 2: sentimientos, momentos compartidos o imaginados
- Párrafo 3: promesas, deseos, o despedida según el tono
- Firma: con un seudónimo poético, no "Anónimo"
- Longitud: media-larga, que se sienta como una carta real`;
}

export function buildHistoriaPrompt(opts: GenerarOpts): string {
  return `${PERSONALIDAD_BASE}

Escribe una historia corta de amor (microficción) ${opts.tema ? `sobre "${opts.tema}"` : ''}.
${estiloInstruccion(opts.estilo)}
${opts.dedicado ? `Protagonista o dedicada a: ${opts.dedicado}` : ''}
${opts.contexto ? `Elementos a incluir: ${opts.contexto}` : ''}

Reglas:
- Entre 150 y 250 palabras
- Estructura: planteamiento breve → momento clave → giro o remate
- El último párrafo debe ser impactante o emotivo
- Personajes con nombres reales (no "él/ella" genérico)
- Diálogo opcional pero bienvenido si añade vida
- Puede terminar feliz, triste, ambiguo o con pregunta abierta`;
}

export function buildPrompt(opts: GenerarOpts): string {
  switch (opts.tipo) {
    case ContenidoTipo.POEMA:
      return buildPoemaPrompt(opts);
    case ContenidoTipo.FRASE:
      return buildFrasePrompt(opts);
    case ContenidoTipo.PIROPO:
      return buildPiropopPrompt(opts);
    case ContenidoTipo.DEDICATORIA:
      return buildDedicatoriaPrompt(opts);
    case ContenidoTipo.HAIKU:
      return buildHaikuPrompt(opts);
    case ContenidoTipo.SONETO:
      return buildSonetoPrompt(opts);
    case ContenidoTipo.COPLA:
      return buildCoplasPrompt(opts);
    case ContenidoTipo.ACROSTICO:
      return buildAcrosticoPrompt(opts);
    case ContenidoTipo.CARTA:
      return buildCartaPrompt(opts);
    case ContenidoTipo.HISTORIA:
      return buildHistoriaPrompt(opts);
    default:
      return buildPoemaPrompt(opts);
  }
}

export const MAX_TOKENS: Record<ContenidoTipo, number> = {
  [ContenidoTipo.POEMA]: 600,
  [ContenidoTipo.FRASE]: 400,
  [ContenidoTipo.PIROPO]: 350,
  [ContenidoTipo.DEDICATORIA]: 500,
  [ContenidoTipo.HAIKU]: 300,
  [ContenidoTipo.SONETO]: 700,
  [ContenidoTipo.COPLA]: 500,
  [ContenidoTipo.ACROSTICO]: 400,
  [ContenidoTipo.CARTA]: 900,
  [ContenidoTipo.HISTORIA]: 800,
};
