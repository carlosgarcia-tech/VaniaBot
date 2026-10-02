/**
 * NpmCommand.ts
 *
 * anime command `npm` — Busca paquetes en NPM
 * Usage: !npm <paquete>
 *
 * @author **Carlos G**
 */

import { Command } from '../../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!npm`: Busca paquetes en NPM. */
export class NpmCommand extends Command {
  name = 'npm';
  description = 'Busca paquetes en NPM';
  category = CommandCategory.ANIME;
  aliases = ['npm', 'npmsearch'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!npm <paquete>';
  examples = ['!npm express'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args?.join(' ').trim();

    if (!query) {
      await ctx.reply('✍️ *Uso:* !npm <paquete>\n_Ejemplo: !npm express');
      return;
    }

    await ctx.react('📦');
    try {
      const data = (await deliriusService.search('npm', { q: query })) as { result?: string };

      if (data?.result) {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          image: { url: data.result },
        });
        await ctx.react('✅');
      } else {
        await ctx.reply('❌ No se encontraron resultados.');
      }
    } catch (error) {
      logError('[NpmCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ Error al buscar. Intenta de nuevo.');
    }
  }
}
