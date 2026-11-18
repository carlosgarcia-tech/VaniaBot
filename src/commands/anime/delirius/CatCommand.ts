/**
 * CatCommand.ts
 *
 * anime command `cat` — Gets a random cat image
 * Usage: !cat [texto]
 *
 * cataas.com serves the images directly (verified alive 18-nov-2026); the old
 * Delirius glue is dead.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!cat`: Gets a random cat image. */
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
      const text = ctx.args?.join(' ').trim() ?? '';
      // `cache=bust` avoids WhatsApp reusing the previous cat for every call.
      const imageUrl = text
        ? `https://cataas.com/cat/says/${encodeURIComponent(text)}?t=${Date.now()}`
        : `https://cataas.com/cat?t=${Date.now()}`;
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
