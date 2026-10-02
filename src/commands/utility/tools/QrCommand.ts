/**
 * QrCommand.ts
 *
 * utility command `qr` — Genera un código QR de cualquier texto o URL.
 * Usage: !qr <texto o URL>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { isValidUrl } from '@/utils/validators.js';

/** Command handler for `!qr`: Genera un código QR de cualquier texto o URL. */
export class QrCommand extends Command {
  name = 'qr';
  description = 'Genera un código QR de cualquier texto o URL.';
  category = CommandCategory.UTILITY;
  aliases = ['qrcode', 'genqr'];
  usage = '!qr <texto o URL>';
  examples = [
    '!qr https://github.com/VaniaBot',
    '!qr Hola, este es mi contacto: +52 1234567890',
    '!qr https://wa.me/521234567890',
  ];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *generador de QR* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usarlo:* !qr <texto o URL>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!qr https://google.com\n` +
          `  ﹒!qr Mi número: +52 123 456 7890\n` +
          `  ﹒!qr Texto secreto 🤫 ✩`,
      );
      return;
    }

    const content = ctx.args.join(' ');

    if (content.length > 500) {
      await ctx.reply('❌ El contenido es demasiado largo (máx. 500 caracteres).');
      return;
    }

    await ctx.react('⏳');

    try {
      const qrUrl =
        `https://api.qrserver.com/v1/create-qr-code/` +
        `?size=400x400` +
        `&margin=10` +
        `&ecc=H` +
        `&format=png` +
        `&data=${encodeURIComponent(content)}`;

      const res = await fetch(qrUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buffer = Buffer.from(await res.arrayBuffer());

      const isUrl = isValidUrl(content);
      const caption =
        `┏━━━━━━━━━━━━━━━━━━┓\n` +
        ` ⌬ *CÓDIGO QR GENERADO* ⌬\n` +
        `┗━━━━━━━━━━━━━━━━━━┛\n\n` +
        `${isUrl ? '➤ ✧ *Enlace*' : '➤ ✧ *Contenido*'} ﹕${content.length > 60 ? content.substring(0, 57) + '...' : content}\n` +
        `➤ ✧ *Resolución* ﹕400×400 px\n` +
        `➤ ✧ *Corrección* ﹕Alta ( 30% )\n\n` +
        `˚ ༘ ⋆｡ ⋆｡˚ ✦ ˚｡⋆｡ ⋆˚ ༘ ˚`;

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: buffer,
        caption,
        mimetype: 'image/png',
      });

      await ctx.react('✅');
    } catch (error) {
      await ctx.react('❌');
      logError('[QrCommand]', error);
      await ctx.reply('❌ Error al generar el QR. Intenta más tarde.');
    }
  }
}
