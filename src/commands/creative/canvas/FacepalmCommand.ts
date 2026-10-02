/**
 * FacepalmCommand.ts
 *
 * creative command `facepalm` — Genera imagen con facepalm
 * Usage: !facepalm [@usuario]
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

/** Command handler for `!facepalm`: Genera imagen con facepalm. */
export class FacepalmCommand extends Command {
  name = 'facepalm';
  description = 'Genera imagen con facepalm';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!facepalm [@usuario]';
  examples = ['!facepalm', '!facepalm @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('🤦');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'facepalm', { url: imageUrl });
  }
}
