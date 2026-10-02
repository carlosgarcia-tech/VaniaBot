/**
 * QuizTopCommand.ts
 *
 * utility command `quiztop` — Top jugadores de quiz del grupo
 * Usage: !quiztop [categoria?]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { cacheManager } from '@/core/CacheManager.js';

interface QuizStats {
  totalCorrect: number;
  totalAnswered: number;
  totalScore: number;
  bestStreak: number;
  currentStreak: number;
  byCategory: Record<string, { correct: number; answered: number }>;
  lastPlayed: number;
  sessionsPlayed: number;
}

interface UserData {
  pushName?: string;
  quizStats?: QuizStats;
}

interface TopEntry {
  name: string;
  score: number;
  correct: number;
  accuracy: number;
  bestStreak: number;
}

/** Command handler for `!quiztop`: Top jugadores de quiz del grupo. */
export class QuizTopCommand extends Command {
  name = 'quiztop';
  description = 'Top jugadores de quiz del grupo';
  category = CommandCategory.UTILITY;
  aliases = ['qtop', 'quizrank', 'topquiz'];
  cooldown = 10000;
  contexts = [CommandContext.GROUP];
  usage = '!quiztop [categoria?]';
  examples = ['!quiztop', '!quiztop javascript'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const category = ctx.args?.[0]?.toLowerCase();

    try {
      const groupMeta = await cacheManager.getGroupMetadataSafe(ctx.sock, ctx.chat.jid);
      const memberJids = groupMeta.participants.map(p => p.id);

      const entries: TopEntry[] = [];

      const results = await Promise.allSettled(
        memberJids.map(async jid => {
          const user = (await serviceManager.userService.getUser(jid)) as unknown as UserData;
          const stats = user?.quizStats;
          if (!stats || stats.totalAnswered === 0) return null;

          let score = stats.totalScore ?? stats.totalCorrect * 35;
          let correct = stats.totalCorrect;
          let answered = stats.totalAnswered;

          if (category && stats.byCategory?.[category]) {
            const cat = stats.byCategory[category];
            correct = cat.correct;
            answered = cat.answered;
            score = correct * 35;
            if (answered === 0) return null;
          } else if (category) {
            return null;
          }

          const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
          const name = user?.pushName ?? jid.split('@')[0];

          return { name, score, correct, accuracy, bestStreak: stats.bestStreak ?? 0 } as TopEntry;
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          entries.push(result.value);
        }
      }

      if (entries.length === 0) {
        await ctx.reply(
          category
            ? `˚₊· ͟͟͞͞➳ *todavía nadie ha jugado ${category}* ˚₊· ͟͟͞͞➳`
            : `˚₊· ͟͟͞͞➳ *nadie ha hecho un quiz aquí todavía* ˚₊· ͟͟͞͞➳\n\n✿ prueba con *!quiz* [categoría] y empezamos a jugar ✿`,
        );
        return;
      }

      entries.sort((a, b) => b.score - a.score || b.correct - a.correct);
      const top = entries.slice(0, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const rows = top
        .map((e, i) => {
          const medal = medals[i] ?? `${i + 1}.`;
          return (
            `${medal} *${e.name}*\n` +
            `    ✅ ${e.correct} correctas · 🎯 ${e.accuracy}% · 🔥 racha ${e.bestStreak}`
          );
        })
        .join('\n\n');

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *top quiz${category ? ` — ${category}` : ''}* ˚₊· ͟͟͞͞➳\n` +
          `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n` +
          rows +
          `\n\n> _VaniaBot 💝 — tu compi de estudio_`,
      );
    } catch (err) {
      logError('[QuizTopCommand] Error', err);
      await ctx.reply('❌ Error al obtener el ranking. Intenta de nuevo.');
    }
  }
}
