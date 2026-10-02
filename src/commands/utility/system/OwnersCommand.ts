/**
 * OwnersCommand.ts
 *
 * utility command `owners` — Muestra la lista de owners del bot
 * Usage: !owners
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';

/** Command handler for `!owners`: Muestra la lista de owners del bot. */
export class OwnersCommand extends Command {
  name = 'owners';
  description = 'Muestra la lista de owners del bot';
  category = CommandCategory.UTILITY;
  aliases = ['propietarios', 'dueños', 'adminslist'];
  usage = '!owners';
  examples = ['!owners'];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const allUsers = await serviceManager.userService.getAllUsers();
      const owners = allUsers.filter(u => u.isOwner);

      if (owners.length === 0) {
        await ctx.reply('⚠️ No hay owners registrados');
        return;
      }

      let ownersList = '';
      owners.forEach((owner, index) => {
        ownersList += `${index + 1}. 👑 ${owner.name}\n`;
      });

      const message = `
      ˚₊· ͟͟͞͞➳ *owneres de VaniaBot* ˚₊· ͟͟͞͞➳
      ﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒

      ${ownersList}
      ✿ total: ${owners.length} ✿
      `.trim();

      await ctx.reply(message);
    } catch (error) {
      logError('[OwnersCommand] Error', error);
      await ctx.reply('❌ Error al obtener owners');
    }
  }
}
