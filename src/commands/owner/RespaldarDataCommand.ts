/**
 * RespaldarDataCommand.ts
 *
 * owner command `respaldar` — Genera un respaldo de tus datos
 * Usage: !respaldar
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';

/** Command handler for `!respaldar`: Genera un respaldo de tus datos. */
export class RespaldarDataCommand extends Command {
  name = 'respaldar';
  description = 'Genera un respaldo de tus datos';
  category = CommandCategory.OWNER;
  permissions = { user: [PermissionLevel.OWNER] };
  // Sin alias 'backup': es el name de BackupCommand (respaldo de sesion).
  aliases = ['export', 'misdatos'];
  usage = '!respaldar';
  examples = ['!respaldar'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    await ctx.react('📦');
    await ctx.reply('🔄 Generando respaldo de tus datos...');

    try {
      const user = await serviceManager.userService.getUser(ctx.sender.jid);

      let message = `˚₊· ͟͟͞͞➳ *tu respaldo* ˚₊· ͟͟͞͞➳\n`;
      message += `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n`;
      message += `✿ *usuario:* ${ctx.sender.jid.split('@')[0]}\n`;
      message += `✿ *dinero:* $${user.money.toLocaleString()}\n`;
      message += `✿ *XP:* ${user.xp.toLocaleString()}\n`;
      message += `✿ *nivel:* ${user.level}\n`;
      message += `✩ *comandos totales:* ${user.totalCommands.toLocaleString()} ✩\n\n`;

      if (user.inventory && user.inventory.length > 0) {
        message += `🎒 *Inventario:*\n`;
        for (const item of user.inventory) {
          const expires = item.expiresAt
            ? `\n   ⏰ Expira: ${new Date(item.expiresAt).toLocaleDateString()}`
            : '';
          message += `  • ${item.name}${expires}\n`;
        }
        message += '\n';
      }

      if (user.achievements && user.achievements.length > 0) {
        message += `🏆 *Logros:*\n`;
        for (const achievement of user.achievements.slice(0, 5)) {
          message += `  • ${achievement}\n`;
        }
        if (user.achievements.length > 5) {
          message += `  ...y ${user.achievements.length - 5} más\n`;
        }
      }

      message += `\n📅 *Fecha:* ${new Date().toLocaleString()}\n`;
      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
      message += footer;

      await ctx.reply(message);
      await ctx.react('✅');
    } catch (_error) {
      await ctx.reply(`❌ Error al generar respaldo.`);
    }
  }
}
