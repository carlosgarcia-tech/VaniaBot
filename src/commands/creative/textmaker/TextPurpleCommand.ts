/**
 * TextPurpleCommand.ts
 *
 * creative command `purple` — Crea un efecto de texto morado
 * Usage: !purple <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/purple-text-effect-online-100.html';

/** Command handler for `!purple`: Crea un efecto de texto morado. */
export class TextPurpleCommand extends Command {
  name = 'purple';
  description = 'Crea un efecto de texto morado';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!purple <texto>';
  examples = ['!purple VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !purple <texto>\n_Ejemplo: !purple VaniaBot_');
      return;
    }

    await ctx.react('🟣');

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
