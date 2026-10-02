/**
 * ResumirChatCommand.ts
 *
 * group command `resumirchat` — Resume conversación reciente del grupo
 * Usage: !resumirchat [cantidad]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { chatSummaryService } from '@/services/chat/ChatSummaryService.js';

/** Command handler for `!resumirchat`: Resume conversación reciente del grupo. */
export class ResumirChatCommand extends Command {
  name = 'resumirchat';
  description = 'Resume conversación reciente del grupo';
  category = CommandCategory.GROUP;
  aliases = ['chatresumen', 'resumenchat', 'resumen'];
  usage = '!resumirchat [cantidad]';
  examples = ['!resumirchat', '!resumirchat 50'];
  cooldown = 10_000;
  contexts = [CommandContext.GROUP];

  async execute(ctx: MessageContext): Promise<void> {
    const limit = parseInt(ctx.args[0], 10) || 40;
    const clampedLimit = Math.max(10, Math.min(120, limit));
    const summary = chatSummaryService.getSummary(ctx.chat.jid, clampedLimit);

    if (!summary) {
      await ctx.reply(
        `Aún no tengo suficiente historial para resumir este chat.\n` +
          `Hablen un poco más y vuelve a probar: *!resumirchat*`,
      );
      return;
    }

    const participantText = summary.participants.length
      ? summary.participants.map((entry, idx) => `${idx + 1}. ${entry[0]} (${entry[1]})`).join('\n')
      : 'Sin datos';

    const keywordText = summary.keywords.length
      ? summary.keywords.map(entry => `${entry[0]}(${entry[1]})`).join(', ')
      : 'Sin temas claros';

    await ctx.reply(
      `╭━━━〔 🧠 RESUMEN DE CHAT 〕━━━⬣\n` +
        `┃ Mensajes analizados: *${summary.count}*\n` +
        `┃ Rango: *${summary.range}*\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━⬣\n\n` +
        `👥 *Más activos*\n${participantText}\n\n` +
        `🏷️ *Temas detectados*\n${keywordText}\n\n` +
        `📝 *Últimos destacados*\n${summary.highlights.join('\n')}`,
    );
  }
}
