/**
 * ATTPCommand.ts
 *
 * creative command `attp` — Genera texto animado en imagen
 * Usage: !attp <texto>
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

/** Command handler for `!attp`: Genera texto animado en imagen. */
export class ATTPCommand extends Command {
  name = 'attp';
  description = 'Genera texto animado en imagen';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!attp <texto>';
  examples = ['!attp Hola'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !attp <texto>\n_Ejemplo: !attp Hola_');
      return;
    }

    await ctx.react('✨');

    await new CanvasBase().sendImage(ctx, 'attp', {
      text: text.substring(0, 30),
    });
  }
}
