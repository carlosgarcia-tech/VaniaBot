/**
 * TextThunderCommand.ts
 *
 * creative command `thunder` — Crea un efecto de texto de rayos
 * Usage: !thunder <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/thunder-text-effect-online-97.html';

/** Command handler for `!thunder`: Crea un efecto de texto de rayos. */
export class TextThunderCommand extends Command {
  name = 'thunder';
  description = 'Crea un efecto de texto de rayos';
  category = CommandCategory.CREATIVE;
  aliases = ['rayo'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!thunder <texto>';
  examples = ['!thunder VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !thunder <texto>\n_Ejemplo: !thunder VaniaBot_');
      return;
    }

    await ctx.react('⚡');

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
