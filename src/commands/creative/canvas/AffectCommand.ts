/**
 * AffectCommand.ts
 *
 * creative command `affect` — Genera imagen estilo affect
 * Usage: !affect [@usuario]
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

/** Command handler for `!affect`: Genera imagen estilo affect. */
export class AffectCommand extends Command {
  name = 'affect';
  description = 'Genera imagen estilo affect';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!affect [@usuario]';
  examples = ['!affect', '!affect @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('😢');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'affect', { url: imageUrl });
  }
}
