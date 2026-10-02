/**
 * UrlShortenerCommand.ts
 *
 * utility command `acortar` — Acorta una URL larga usando TinyURL.
 * Usage: !acortar <url>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!acortar`: Acorta una URL larga usando TinyURL. */
export class UrlShortenerCommand extends Command {
  name = 'acortar';
  description = 'Acorta una URL larga usando TinyURL.';
  category = CommandCategory.UTILITY;
  aliases = ['short', 'shorten', 'url', 'tinyurl'];
  usage = '!acortar <url>';
  examples = [
    '!acortar https://www.google.com/search?q=esto+es+una+url+muy+larga',
    '!acortar https://github.com/usuario/repositorio/blob/main/archivo.ts',
  ];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *acortador de URLs* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usarlo:* !acortar <url>\n\n` +
          `✩ *ejemplo:*\n` +
          `  ﹒!acortar https://www.example.com/pagina?muy=larga&con=parametros ✩`,
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.isValidUrl(url)) {
      await ctx.reply(
        `❌ URL inválida: *${url}*\n` + `La URL debe comenzar con http:// o https://`,
      );
      return;
    }

    if (url.length < 30) {
      await ctx.reply('ℹ️ La URL ya es lo suficientemente corta.');
      return;
    }

    await ctx.react('⏳');

    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const shortened = await res.text();

      if (!shortened.startsWith('http')) {
        throw new Error('Respuesta inválida de TinyURL');
      }

      const msg =
        `*URL Acortada*\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `*Original:*\n${url}\n\n` +
        `*Acortada:*\n${shortened}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `Reducida de ${url.length} a ${shortened.length} caracteres`;

      await ctx.react('✅');
      await ctx.reply(msg);
    } catch (error) {
      await ctx.react('❌');
      logError('[UrlShortener] Error', error);
      await ctx.reply('❌ Error al acortar la URL. Intenta más tarde.');
    }
  }
}
