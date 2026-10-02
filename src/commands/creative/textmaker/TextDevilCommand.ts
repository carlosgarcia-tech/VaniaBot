/**
 * TextDevilCommand.ts
 *
 * creative command `devil` — Crea un efecto de texto estilo demonio
 * Usage: !devil <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html';

/** Command handler for `!devil`: Crea un efecto de texto estilo demonio. */
export class TextDevilCommand extends Command {
  name = 'devil';
  description = 'Crea un efecto de texto estilo demonio';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!devil <texto>';
  examples = ['!devil VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !devil <texto>\n_Ejemplo: !devil VaniaBot_');
      return;
    }

    await ctx.react('😈');

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
