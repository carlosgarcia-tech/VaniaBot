/**
 * CircleCommand.ts
 *
 * creative command `circle` — Genera imagen circular
 * Usage: !circle [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CanvasBase } from './CanvasBase.js';
import { ImageHelper } from '@/utils/ImageHelper.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

/** Command handler for `!circle`: Genera imagen circular. */
export class CircleCommand extends Command {
  name = 'circle';
  description = 'Genera imagen circular';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!circle [@usuario]';
  examples = ['!circle', '!circle @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('⭕');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'circle', { url: imageUrl });
  }
}
