/**
 * TextSnowCommand.ts
 *
 * creative command `snow` — Crea un efecto de texto de nieve
 * Usage: !snow <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html';

/** Command handler for `!snow`: Crea un efecto de texto de nieve. */
export class TextSnowCommand extends Command {
  name = 'snow';
  description = 'Crea un efecto de texto de nieve';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!snow <texto>';
  examples = ['!snow VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !snow <texto>\n_Ejemplo: !snow VaniaBot_');
      return;
    }

    await ctx.react('🌨️');

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
