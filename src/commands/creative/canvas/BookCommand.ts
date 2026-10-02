/**
 * BookCommand.ts
 *
 * creative command `book` — Genera imagen de libro
 * Usage: !book <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const MAX_WORDS = 30;

/** Command handler for `!book`: Genera imagen de libro. */
export class BookCommand extends Command {
  name = 'book';
  description = 'Genera imagen de libro';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!book <texto>';
  examples = ['!book Bienvenidos a VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const input = ctx.args?.join(' ').trim();

    if (!input) {
      await ctx.reply(
        `📖 *Uso:* !book <texto>\n` +
          `_Ejemplo: !book Bienvenidos a VaniaBot_\n\n` +
          `✩ máximo ${MAX_WORDS} palabras`,
      );
      return;
    }

    const words = input.split(/\s+/);
    if (words.length > MAX_WORDS) {
      await ctx.reply(`❌ Máximo ${MAX_WORDS} palabras. Tienes ${words.length}.`);
      return;
    }

    await ctx.react('📖');

    await new CanvasBase().sendImage(ctx, 'book', {
      text: words.join(' '),
      footer: 'VaniaBot',
    });
  }
}
