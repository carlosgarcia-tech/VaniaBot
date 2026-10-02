/**
 * QuizStatsCommand.ts
 *
 * utility command `quizstats` — Tus estadísticas del modo estudio
 * Usage: !quizstats [@usuario]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { quizService } from '@/services/study/QuizService.js';
import type { UserQuizStats } from '@/services/study/QuizTypes.js';
import { logError } from '@/utils/logger.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';

interface UserWithQuizStats {
  quizStats?: UserQuizStats;
}

/** Command handler for `!quizstats`: Tus estadísticas del modo estudio. */
export class QuizStatsCommand extends Command {
  name = 'quizstats';
  description = 'Tus estadísticas del modo estudio';
  category = CommandCategory.UTILITY;
  aliases = ['qstats', 'misquiz', 'quizperfil'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!quizstats [@usuario]';
  examples = ['!quizstats', '!quizstats @Carlos'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    let targetJid = ctx.sender.jid;
    let targetName = ctx.sender.pushName ?? 'Tú';

    const mentioned = ctx.mentionedJid;
    if (mentioned && (ctx.sender.isAdmin || ctx.sender.isOwner)) {
      targetJid = mentioned;
      targetName = mentioned.split('@')[0];
    }

    try {
      const user = (await serviceManager.userService.getUser(
        targetJid,
      )) as UserWithQuizStats | null;
      const stats: UserQuizStats | undefined = user?.quizStats;

      if (!stats || stats.totalAnswered === 0) {
        const isSelf = targetJid === ctx.sender.jid;
        await ctx.reply(
          isSelf
            ? `˚₊· ͟͟͞͞➳ *aún no has hecho ningún quiz* ˚₊· ͟͟͞͞➳\n\n✿ prueba con *!quiz* [categoría] y empezamos a jugar ✿`
            : `˚₊· ͟͟͞͞➳ *${targetName}* aún no ha hecho ningún quiz ˚₊· ͟͟͞͞➳`,
        );
        return;
      }

      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
      const quizFooter = footer.replace('>', '> _') + ' — Modo Estudio_';
      await ctx.reply(quizService.formatStatsMessage(stats, targetName, quizFooter));
    } catch (err) {
      logError('[QuizStatsCommand] Error', err);
      await ctx.reply('❌ No pude obtener tus estadísticas. Intenta de nuevo.');
    }
  }
}
