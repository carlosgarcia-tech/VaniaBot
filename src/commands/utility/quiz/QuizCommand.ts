import { Command } from '../../Command.js';
import { quizService } from '@/services/study/QuizService.js';
import { isRight } from '@/utils/either.js';
import { logError } from '@/utils/logger.js';
import { difficultyEngine } from '@/services/study/DifficultyEngine.js';
import { QuizCategory, type UserQuizStats } from '@/services/study/QuizTypes.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { primeService } from '@/services/system/PrimeService.js';

const CATEGORY_ALIASES: Record<string, string> = {
  js: QuizCategory.JAVASCRIPT,
  javascript: QuizCategory.JAVASCRIPT,
  ts: QuizCategory.TYPESCRIPT,
  typescript: QuizCategory.TYPESCRIPT,
  py: QuizCategory.PYTHON,
  python: QuizCategory.PYTHON,
  historia: QuizCategory.HISTORIA,
  history: QuizCategory.HISTORIA,
  ciencia: QuizCategory.CIENCIA,
  science: QuizCategory.CIENCIA,
  mate: QuizCategory.MATEMATICAS,
  matematicas: QuizCategory.MATEMATICAS,
  math: QuizCategory.MATEMATICAS,
  anime: QuizCategory.ANIME,
  cultura: QuizCategory.CULTURA,
  general: QuizCategory.CULTURA,
  geo: QuizCategory.GEOGRAFIA,
  geografia: QuizCategory.GEOGRAFIA,
};

const CATEGORIES_LIST = [
  '📜 historia',
  '🔬 ciencia',
  '➕ matematicas',
  '🎌 anime',
  '🌍 geografia',
  '🌐 cultura general',
  '💛 javascript',
  '🔷 typescript',
  '🐍 python',
].join('\n');

interface UserWithQuizStats {
  quizStats?: UserQuizStats;
}

const DEFAULT_STATS: UserQuizStats = {
  totalCorrect: 0,
  totalAnswered: 0,
  totalScore: 0,
  bestStreak: 0,
  currentStreak: 0,
  byCategory: {},
  lastPlayed: 0,
  sessionsPlayed: 0,
};

export class QuizCommand extends Command {
  name = 'quiz';
  description = 'Modo estudio — responde preguntas y gana monedas';
  category = CommandCategory.UTILITY;
  aliases = ['q', 'estudio', 'study'];
  cooldown = 3000;
  contexts = [CommandContext.GROUP];
  usage = '!quiz [categoría] [preguntas?] | !quiz stop';
  examples = ['!quiz javascript', '!quiz historia 10', '!quiz anime 5', '!quiz stop'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args ?? [];
    const first = args[0]?.toLowerCase();
    const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);
    const quizFooter = footer.replace('>', '> _') + ' — Modo Estudio_';

    if (first === 'stop' || first === 'parar' || first === 'detener') {
      const canStop =
        ctx.sender.isAdmin ||
        ctx.sender.isOwner ||
        quizService.getSession(ctx.chat.jid)?.startedBy === ctx.sender.jid;

      if (!canStop) {
        await ctx.reply('❌ Solo quien inició el quiz o un admin puede detenerlo.');
        return;
      }

      const stopped = await quizService.stopSession(ctx.chat.jid, (_, text) => ctx.reply(text));
      if (!stopped) await ctx.reply('ℹ️ No hay un quiz activo en este grupo.');
      return;
    }

    if (!first) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *modo estudio — VaniaBot* ˚₊· ͟͟͞͞➳\n` +
          `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n` +
          `✿ *cómo lo usas:* !quiz [categoría] [preguntas]\n\n` +
          `✩ *categorías:*\n${CATEGORIES_LIST}\n\n` +
          `♡ *ejemplos:*\n` +
          `  ﹒!quiz javascript\n` +
          `  ﹒!quiz historia 10\n` +
          `  ﹒!quiz stop\n\n` +
          `la dificultad sube solita mientras más aprendes\n` +
          `si te atoras, usa *!hint* para una pista (la recompensa baja un poquito)\n\n` +
          `> _VaniaBot 💝 — tu compi de estudio_`,
      );
      return;
    }

    if (quizService.hasActiveSession(ctx.chat.jid)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *ya estamos jugando* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ si quieres uno nuevo, primero termina este con *!quiz stop*\n` +
          `✩ no quiero mezclar las preguntas ✩`,
      );
      return;
    }

    const rawCategory = first;
    const category = CATEGORY_ALIASES[rawCategory] ?? rawCategory;

    const rawCount = args[1] ? parseInt(args[1], 10) : 5;
    const total = isNaN(rawCount) || rawCount < 1 ? 5 : Math.min(rawCount, 15);

    const getUserStats = async (jid: string): Promise<UserQuizStats | null> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        return user?.quizStats ?? null;
      } catch {
        return null;
      }
    };

    const updateStats = async (jid: string, patch: Partial<UserQuizStats>): Promise<void> => {
      try {
        const user = (await serviceManager.userService.getUser(jid)) as UserWithQuizStats | null;
        if (!user) return;

        const prev: UserQuizStats = user.quizStats ?? { ...DEFAULT_STATS };

        const updated: UserQuizStats = {
          ...prev,
          totalCorrect: prev.totalCorrect + (patch.totalCorrect ?? 0),
          totalAnswered: prev.totalAnswered + (patch.totalAnswered ?? 0),
          currentStreak:
            patch.currentStreak !== undefined ? patch.currentStreak : prev.currentStreak,
          bestStreak: Math.max(prev.bestStreak, patch.currentStreak ?? prev.currentStreak),
          lastPlayed: patch.lastPlayed ?? prev.lastPlayed,
          sessionsPlayed:
            patch.sessionsPlayed !== undefined ? prev.sessionsPlayed + 1 : prev.sessionsPlayed,
        };

        await serviceManager.userService.updateUser(jid, { quizStats: updated } as Parameters<
          typeof serviceManager.userService.updateUser
        >[1]);
      } catch (e) {
        logError('[QuizCommand] updateStats error', e);
      }
    };

    const awardCoins = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addMoney(jid, amount);
      } catch (error) {
        logError(`[QuizCommand] awardCoins(${amount}) failed for ${jid}`, error);
      }
    };

    const awardXP = async (jid: string, amount: number): Promise<void> => {
      try {
        await serviceManager.userService.addXP(jid, amount);
      } catch (error) {
        logError(`[QuizCommand] awardXP(${amount}) failed for ${jid}`, error);
      }
    };

    await ctx.reply(`Generando preguntas de *${category}*...`);

    const result = await quizService.startSession({
      groupId: ctx.chat.jid,
      startedBy: ctx.sender.jid,
      startedByName: ctx.sender.pushName ?? 'Alguien',
      category,
      totalQuestions: total,
      sendFn: (_, text) => ctx.reply(text),
      getUserStats,
      updateStats,
      awardCoins,
      awardXP,
      footer: quizFooter,
    });

    if (!isRight(result)) {
      await ctx.reply(`❌ ${result.left.message}`);
      return;
    }

    const { firstQuestion: q, difficulty: diff } = result.right;

    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *quiz iniciado* — ${total} preguntas ˚₊· ͟͟͞͞➳\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
        `✿ categoría: *${category}*\n` +
        `${difficultyEngine.emoji(diff)} dificultad inicial: *${difficultyEngine.label(diff)}*\n` +
        `✩ recompensas: hasta *${difficultyEngine.calculateCoins(diff, 5)} moneditas* por respuesta ✩\n\n` +
        `_la dificultad sube solita con tu racha_ 🌸\n` +
        `_usa !hint si necesitas ayuda (la recompensa baja un poquito)_\n\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
        `*pregunta 1/${total}* ${difficultyEngine.emoji(diff)} ${difficultyEngine.label(diff)}\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n\n` +
        `*${q.question}*\n\n` +
        `_tienes 30 segunditos..._`,
    );
  }
}
