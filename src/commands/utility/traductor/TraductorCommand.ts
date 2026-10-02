/**
 * TraductorCommand.ts
 *
 * utility command `traducir` — Traductor contextual inteligente — detecta idioma y preserva tono
 * Usage: !tr [idioma] [texto] | !tr [origen]>[destino] [texto] | !tr idiomas
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { translatorService } from '@/services/translator/TranslatorService.js';
import { isRight } from '@/utils/either.js';
import { resolverIdioma, idiomasDisponibles } from '@/services/translator/TranslatorTypes.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

function getQuotedText(ctx: MessageContext): string | null {
  const quoted = ctx.quoted;
  if (!quoted) return null;
  return (
    quoted.conversation ??
    quoted.extendedTextMessage?.text ??
    quoted.imageMessage?.caption ??
    quoted.videoMessage?.caption ??
    null
  );
}

function buildHelp(): string {
  return (
    `🌐 *Traductor Contextual — VaniaBot*\n` +
    `━━━━━━━━━━━━\n\n` +
    `📖 *Uso básico:*\n` +
    `• *!tr [idioma] [texto]*\n` +
    `• *!tr [idioma]* _(respondiendo a un mensaje)_\n\n` +
    `🔀 *Especificar origen y destino:*\n` +
    `• *!tr [origen]>[destino] [texto]*\n` +
    `  _!tr es>en Buenos días_\n\n` +
    `🛠️ *Modificadores:*\n` +
    `• *formal* — registro formal/profesional\n` +
    `  _!tr formal en Estimado cliente_\n` +
    `• *notas* — incluye notas culturales\n` +
    `  _!tr notas ja こんにちは_\n` +
    `• *literal* — traducción palabra por palabra\n` +
    `  _!tr literal en Me partí la caja_\n` +
    `• *libre* — versión más natural/nativa\n` +
    `  _!tr libre en ¿Qué onda?_\n\n` +
    `🔍 *Detectar idioma:*\n` +
    `• *!tr detectar [texto]*\n` +
    `• *!tr detectar* _(respondiendo)_\n\n` +
    `📋 *Ver idiomas disponibles:*\n` +
    `• *!tr idiomas*\n\n` +
    `💡 *Atajos:* !traducir · !translate · !trad · !tr\n\n` +
    `> _VaniaBot🌐 — Traductor contextual_`
  );
}

/** Command handler for `!traducir`: Traductor contextual inteligente — detecta idioma y preserva tono. */
export class TraductorCommand extends Command {
  name = 'traducir';
  description = 'Traductor contextual inteligente — detecta idioma y preserva tono';
  category = CommandCategory.UTILITY;
  aliases = ['translate', 'trad', 'tr'];
  cooldown = 4000;
  contexts = [CommandContext.BOTH];
  usage = '!tr [idioma] [texto] | !tr [origen]>[destino] [texto] | !tr idiomas';
  examples = [
    '!tr en Hola mundo',
    '!tr japonés (respondiendo a un mensaje)',
    '!tr es>en Buenos días',
    '!tr formal en Estimado cliente',
    '!tr notas ja こんにちは',
    '!tr detectar Bonjour tout le monde',
    '!tr idiomas',
  ];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = [...(ctx.args ?? [])];

    if (!args.length) {
      await ctx.reply(buildHelp());
      return;
    }

    const first = args[0].toLowerCase();

    if (first === 'idiomas' || first === 'languages' || first === 'langs') {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *idiomas que entiendo* ˚₊· ͟͟͞͞➳\n\n${idiomasDisponibles()}\n\n` +
          `✩ *cómo pedírmelos:* nombre, código ISO, o como los digas en español/inglés\n` +
          `♡ *ejemplo:* "inglés", "en", "english" — los entiendo todos ♡\n\n` +
          `> _VaniaBot 🌸 — tu traductora favorita_`,
      );
      return;
    }

    if (first === 'detectar' || first === 'detect') {
      args.shift();
      let texto = args.join(' ').trim();

      if (!texto) {
        const quoted = getQuotedText(ctx);
        if (!quoted) {
          await ctx.reply(
            `❌ Escribe el texto a detectar o responde a un mensaje.\n` +
              `_Ej: !tr detectar Bonjour tout le monde_`,
          );
          return;
        }
        texto = quoted;
      }

      await ctx.react('🔍');
      const result = await translatorService.detectarIdioma(texto);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      await ctx.react('✅');
      const detected = result.right;
      await ctx.reply(
        `🔍 *Idioma detectado:*\n\n` +
          `${detected.bandOrigen} *${detected.idiomaOrigen}*\n\n` +
          `_"${texto.slice(0, 100)}${texto.length > 100 ? '...' : ''}"_\n\n` +
          `> _VaniaBot🌐 — Traductor contextual_`,
      );
      return;
    }

    let formal = false;
    let notas = false;
    let modo: 'literal' | 'contextual' | 'libre' = 'contextual';

    while (args.length > 0) {
      const token = args[0].toLowerCase();
      if (token === 'formal') {
        formal = true;
        args.shift();
      } else if (token === 'notas' || token === 'notes') {
        notas = true;
        args.shift();
      } else if (token === 'literal') {
        modo = 'literal';
        args.shift();
      } else if (token === 'libre' || token === 'free') {
        modo = 'libre';
        args.shift();
      } else break;
    }

    if (!args.length) {
      await ctx.reply(buildHelp());
      return;
    }

    let idiomaOrigen: string | undefined;
    let idiomaDestino: string | undefined;
    const idiomaArg = args[0];

    if (idiomaArg.includes('>')) {
      const [orig, dest] = idiomaArg.split('>');
      const resolvedOrig = resolverIdioma(orig ?? '');
      const resolvedDest = resolverIdioma(dest ?? '');

      if (!resolvedDest) {
        await ctx.reply(
          `❌ Idioma destino desconocido: *"${dest}"*\n` +
            `Usa *!tr idiomas* para ver los disponibles.`,
        );
        return;
      }

      idiomaOrigen = resolvedOrig?.codigo;
      idiomaDestino = resolvedDest.codigo;
      args.shift();
    } else {
      const resolved = resolverIdioma(idiomaArg);
      if (!resolved) {
        await ctx.reply(
          `❌ Idioma desconocido: *"${idiomaArg}"*\n` +
            `Usa *!tr idiomas* para ver los disponibles.\n\n` +
            `_Ej: !tr en Hola · !tr japonés · !tr es>fr Buenos días_`,
        );
        return;
      }
      idiomaDestino = resolved.codigo;
      args.shift();
    }

    let texto = args.join(' ').trim();

    if (!texto) {
      const quoted = getQuotedText(ctx);
      if (!quoted) {
        await ctx.reply(
          `❌ Escribe el texto a traducir o responde a un mensaje.\n\n` +
            `_Ej: !tr en Hola mundo_\n` +
            `_O responde a un mensaje con: !tr japonés_`,
        );
        return;
      }
      texto = quoted;
    }

    await ctx.react('🔄');

    if (!idiomaDestino) {
      await ctx.reply('❌ Error: No se especificó idioma destino');
      return;
    }

    const result = await translatorService.traducir({
      texto,
      idiomaDestino,
      idiomaOrigen,
      formal,
      notas,
      modo,
    });

    if (!isRight(result)) {
      await ctx.react('❌');
      await ctx.reply(`❌ ${result.left.message}`);
      return;
    }

    await ctx.react('✅');

    const textoEsQuoted = !args.length || args.join(' ').trim() === texto;
    await ctx.reply(translatorService.formatResult(result, textoEsQuoted));
  }
}
