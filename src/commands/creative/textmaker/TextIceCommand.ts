/**
 * TextIceCommand.ts
 *
 * creative command `ice` — Crea un efecto de texto de hielo
 * Usage: !ice <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/ice-text-effect-online-101.html';

/** Command handler for `!ice`: Crea un efecto de texto de hielo. */
export class TextIceCommand extends Command {
  name = 'ice';
  description = 'Crea un efecto de texto de hielo';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!ice <texto>';
  examples = ['!ice VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !ice <texto>\n_Ejemplo: !ice VaniaBot_');
      return;
    }

    await ctx.react('❄️');

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
