/**
 * TextLeavesCommand.ts
 *
 * creative command `leaves` — Crea un efecto de texto con hojas
 * Usage: !leaves <texto>
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

const PAGE_URL =
  'https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html';

/** Command handler for `!leaves`: Crea un efecto de texto con hojas. */
export class TextLeavesCommand extends Command {
  name = 'leaves';
  description = 'Crea un efecto de texto con hojas';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!leaves <texto>';
  examples = ['!leaves VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !leaves <texto>\n_Ejemplo: !leaves VaniaBot_');
      return;
    }

    await ctx.react('🍃');

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
