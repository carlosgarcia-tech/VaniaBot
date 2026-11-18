/**
 * PlayStoreCommand.ts
 *
 * anime command `playstore` — Searches apps on Google Play Store
 * Usage: !playstore <app>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { playStoreService } from '@/services/external/PlayStoreService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!playstore`: Searches apps on Google Play Store. */
export class PlayStoreCommand extends Command {
  name = 'playstore';
  description = 'Busca aplicaciones en Google Play Store';
  category = CommandCategory.ANIME;
  aliases = ['playstore'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!playstore <app>';
  examples = ['!playstore instagram'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !playstore <app>\n_Ejemplo: !playstore instagram');
      return;
    }

    await ctx.react('📱');
    try {
      // google-play-scraper (gratuito, verificado en vivo).
      const apps = await playStoreService.search(query);
      if (apps.length === 0) {
        await ctx.reply('❌ No se encontraron resultados.');
        return;
      }
      const list = apps
        .map(
          a =>
            `📱 *${a.title}*\n👤 ${a.developer}\n⭐ ${a.score.toFixed(1)}\n🔗 https://play.google.com/store/apps/details?id=${a.appId}`,
        )
        .join('\n\n');
      await ctx.reply(`🔎 *Resultados para:* ${query}\n\n${list}`);
      await ctx.react('✅');
    } catch (error) {
      logError('[PlayStoreCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
