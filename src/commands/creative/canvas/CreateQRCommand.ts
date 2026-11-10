/**
 * CreateQRCommand.ts
 *
 * creative command `createqr` — Generates a QR code from your text
 * Usage: !createqr <texto>
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

/** Command handler for `!createqr`: Generates a QR code from your text. */
export class CreateQRCommand extends Command {
  name = 'createqr';
  description = 'Genera un código QR con tu texto';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!createqr <texto>';
  examples = ['!createqr https://google.com'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const text = ctx.args?.join(' ').trim();

    if (!text) {
      await ctx.reply('✍️ *Uso:* !createqr <texto>\n_Ejemplo: !createqr https://google.com_');
      return;
    }

    await ctx.react('📱');
    await new CanvasBase().sendImage(ctx, 'createqr', { text: text.substring(0, 200) });
  }
}
