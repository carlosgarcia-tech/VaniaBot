/**
 * TextFireCommand.ts
 *
 * creative command `fire` — Crea un efecto de texto de fuego
 * Usage: !fire <texto>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { TextMakerBase } from './TextMakerBase.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const PAGE_URL = 'https://en.ephoto360.com/flame-lettering-effect-372.html';

/** Command handler for `!fire`: Crea un efecto de texto de fuego. */
export class TextFireCommand extends Command {
  name = 'fire';
  description = 'Crea un efecto de texto de fuego';
  category = CommandCategory.CREATIVE;
  aliases = ['flame'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!fire <texto>';
  examples = ['!fire VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !fire <texto>\n_Ejemplo: !fire VaniaBot_');
      return;
    }

    await ctx.react('🔥');

    try {
      const base = new TextMakerBase();
      await base.sendImage(ctx, PAGE_URL, text);
      await ctx.react('✅');
    } catch (_error) {
      await ctx.react('❌');
      await ctx.reply('❌ No pude generar la imagen. Intenta de nuevo.');
    }
  }
}
