/**
 * APKCommand.ts
 *
 * media command `apk` — Busca aplicaciones Android
 * Usage: !apk <nombre de app>
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview APKCommand.ts - Search Android apps
 *
 * Searches for Android applications using dvyer-api.
 *
 * @module commands/media/download/APKCommand
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { apkSearchService } from '@/services/download/APKSearchService.js';
import { logError } from '@/utils/logger.js';

/** Command handler for `!apk`: Busca aplicaciones Android. */
export class APKCommand extends Command {
  name = 'apk';
  description = 'Busca aplicaciones Android';
  category = CommandCategory.MEDIA;
  aliases = ['app', 'apksearch'];
  usage = '!apk <nombre de app>';
  examples = ['!apk freefire', '!apk telegram'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *APK Search* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:*\n` +
          `  ﹒!apk <nombre de app>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!apk freefire\n` +
          `  ﹒!apk telegram`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando APK: "${query}"...`);

    try {
      const result = await apkSearchService.search(query);

      if (result._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      const text = apkSearchService.formatResults(result.right, query);
      await ctx.reply(text);

      await ctx.react('✅');
    } catch (error) {
      logError('APKCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar APK');
    }
  }
}

export class APKDLCommand extends Command {
  name = 'apkdl';
  description = 'Descarga una app Android';
  category = CommandCategory.MEDIA;
  aliases = ['apkdownload'];
  usage = '!apkdl <nombre>';
  examples = ['!apkdl freefire'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];
  mediaGroup = true;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(`✿ *cómo usar:* !apkdl <nombre de app>`);
      return;
    }

    await ctx.react('🔍');
    await ctx.reply(`🔍 Buscando: "${query}"...`);

    try {
      const result = await apkSearchService.search(query, 1);

      if (result._tag === 'Left') {
        await ctx.react('❌');
        await ctx.reply(`❌ ${result.left.message}`);
        return;
      }

      const app = result.right[0];

      if (app.download) {
        await ctx.react('⬇️');
        await ctx.reply(`⬇️ Descargando: ${app.name}...`);

        await ctx.sock.sendMessage(
          ctx.chat.jid,
          {
            text: `📱 *${app.name}*\n👤 ${app.developer || 'Desarrollador desconocido'}\n📌 ${app.version || 'Versión desconocida'}\n\n🔗 ${app.download}`,
          },
          { quoted: ctx.message },
        );

        await ctx.react('✅');
      } else {
        await ctx.reply(
          `📱 *${app.name}*\n` +
            `👤 ${app.developer || 'Desconocido'}\n` +
            `${app.version ? `📌 Versión: ${app.version}\n` : ''}` +
            `${app.size ? `💾 Tamaño: ${app.size}\n` : ''}\n\n` +
            `🔗 Usa el enlace directo para descargar`,
        );
      }
    } catch (error) {
      logError('APKDLCommand error:', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al procesar APK');
    }
  }
}
