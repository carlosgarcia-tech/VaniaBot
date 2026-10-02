/**
 * TextHackerCommand.ts
 *
 * creative command `hacker` — Crea un efecto de texto estilo hacker
 * Usage: !hacker <texto>
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

const PAGE_URL = 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html';

/** Command handler for `!hacker`: Crea un efecto de texto estilo hacker. */
export class TextHackerCommand extends Command {
  name = 'hacker';
  description = 'Crea un efecto de texto estilo hacker';
  category = CommandCategory.CREATIVE;
  aliases = ['cyber'];
  cooldown = 15000;
  contexts = [CommandContext.BOTH];
  usage = '!hacker <texto>';
  examples = ['!hacker VaniaBot'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !hacker <texto>\n_Ejemplo: !hacker VaniaBot_');
      return;
    }

    await ctx.react('💻');

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
