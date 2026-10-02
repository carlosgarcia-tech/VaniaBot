/**
 * PatrickCommand.ts
 *
 * creative command `patrick` — Genera imagen con Patrick Star
 * Usage: !patrick [@usuario]
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

/** Command handler for `!patrick`: Genera imagen con Patrick Star. */
export class PatrickCommand extends Command {
  name = 'patrick';
  description = 'Genera imagen con Patrick Star';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!patrick [@usuario]';
  examples = ['!patrick', '!patrick @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('⭐');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'patrick', { url: imageUrl });
  }
}
