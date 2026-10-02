/**
 * CatCommand.ts
 *
 * anime command `cat` — Obtiene una imagen de gato aleatoria
 * Usage: !cat [texto]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { deliriusService } from '@/services/external/DeliriusService.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!cat`: Obtiene una imagen de gato aleatoria. */
export class CatCommand extends Command {
  name = 'cat';
  description = 'Obtiene una imagen de gato aleatoria';
  category = CommandCategory.ANIME;
  aliases = ['cat', 'gato'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!cat [texto]';
  examples = ['!cat', '!cat cute'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🐱');
    try {
      const text = ctx.args?.join(' ').trim() || '';
      const endpoint = text ? `cat?text=${encodeURIComponent(text)}` : 'cat';
      const imageUrl = await deliriusService.getRandomImage(endpoint);
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: { url: imageUrl },
      });
      await ctx.react('✅');
    } catch (error) {
      logError('[CatCommand]', error);
      await ctx.react('❌');
      await ctx.reply('❌ No pude obtener la imagen. Intenta de nuevo.');
    }
  }
}
