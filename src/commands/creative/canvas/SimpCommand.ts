/**
 * SimpCommand.ts
 *
 * creative command `simp` — Efecto simp
 * Usage: !simp [@usuario]
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

/** Command handler for `!simp`: Efecto simp. */
export class SimpCommand extends Command {
  name = 'simp';
  description = 'Efecto simp';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!simp [@usuario]';
  examples = ['!simp', '!simp @usuario'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('💕');

    const imageUrl = await ImageHelper.getProfileImage(ctx);
    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    await new CanvasBase().sendImage(ctx, 'simp', { url: imageUrl });
  }
}
