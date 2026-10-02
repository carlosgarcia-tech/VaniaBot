/**
 * AiClearCommand.ts
 *
 * utility command `aiclear` — Limpia tu historial de conversación con Vania IA
 * Usage: !aiclear  |  !aiclear all (solo admins)
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { aiService } from '@/services/external/AIService.js';

/** Command handler for `!aiclear`: Limpia tu historial de conversación con Vania IA. */
export class AiClearCommand extends Command {
  name = 'aiclear';
  description = 'Limpia tu historial de conversación con Vania IA';
  category = CommandCategory.UTILITY;
  aliases = ['clearchat', 'aiborrar', 'airestart'];
  usage = '!aiclear  |  !aiclear all (solo admins)';
  examples = ['!aiclear', '!aiclear all'];
  cooldown = 3000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    if (ctx.args[0]?.toLowerCase() === 'all') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner) {
        await ctx.reply(' Solo los administradores pueden borrar el historial del grupo.');
        return;
      }
      await aiService.clearGroupSessions(ctx.chat.jid);
      await ctx.react('🗑️');
      await ctx.reply('🗑️ Historial de *todos los usuarios* borrado.');
      return;
    }

    await aiService.clearSession(ctx.chat.jid, ctx.sender.jid);
    await ctx.react('🗑️');
    await ctx.reply('🗑️ Tu historial fue borrado. ¡Empezamos desde cero! 😊');
  }
}
