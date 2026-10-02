/**
 * WelcardCommand.ts
 *
 * creative command `welcard` — Genera tarjeta de bienvenida
 * Usage: !welcard [nombre] [autor] [servidor]
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

/** Command handler for `!welcard`: Genera tarjeta de bienvenida. */
export class WelcardCommand extends Command {
  name = 'welcard';
  description = 'Genera tarjeta de bienvenida';
  category = CommandCategory.CREATIVE;
  aliases = [];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];
  usage = '!welcard [nombre] [autor] [servidor]';
  examples = ['!welcard', '!welcard Juan MiServidor Servidor'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];

    await ctx.react('🎫');

    let imageUrl = await ImageHelper.getImageOrProfile(ctx);
    if (!imageUrl) {
      imageUrl = await ImageHelper.getProfileImage(ctx);
    }

    if (!imageUrl) {
      await ctx.reply('❌ No pude obtener la foto de perfil.');
      return;
    }

    const name = args[0] || ctx.sender.pushName || 'Usuario';
    const author = args[1] || ctx.sender.pushName || 'Usuario';
    const server = args[2] || 'VaniaBot';

    await new CanvasBase().sendImage(ctx, 'welcard', {
      image: imageUrl,
      name: name.substring(0, 20),
      author: author.substring(0, 20),
      server: server.substring(0, 20),
    });
  }
}
