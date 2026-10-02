/**
 * QuizService.ts
 *
 * VaniaBot services module exposing `QuizService`, `StartQuizSuccess`, `StartQuizOptions`, `quizService`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import { right, left } from '@/utils/either.js';
import { questionGenerator } from './QuestionGenerator.js';
import { answerValidator } from './AnswerValidator.js';
import { difficultyEngine, QUESTION_TIMEOUT_SECS, HINT_OFFER_SECS } from './DifficultyEngine.js';
import type { QuizDifficulty } from './QuizTypes.js';
import {
  QuizSessionState,
  type QuizSession,
  type QuizPlayer,
  type QuizQuestion,
  type AnswerResult,
  type UserQuizStats,
} from './QuizTypes.js';

export type SendFn = (groupId: string, text: string) => Promise<void>;

export interface StartQuizSuccess {
  firstQuestion: QuizQuestion;
  difficulty: QuizDifficulty;
}

export type StartQuizError = { message: string };
export type StartQuizResult = Either<StartQuizError, StartQuizSuccess>;

export interface StartQuizOptions {
  groupId: string;
  startedBy: string;
  startedByName: string;
  category: string;
  totalQuestions: number;
  sendFn: SendFn;
  getUserStats: (jid: string) => Promise<UserQuizStats | null>;
  updateStats: (jid: string, patch: Partial<UserQuizStats>) => Promise<void>;
  awardCoins: (jid: string, amount: number) => Promise<void>;
  awardXP: (jid: string, amount: number) => Promise<void>;
  footer?: string;
}

const MAX_QUESTIONS = 15;

export class QuizService {
  private sessions = new Map<string, QuizSession>();

  hasActiveSession(groupId: string): boolean {
    return this.sessions.has(groupId);
  }

  getSession(groupId: string): QuizSession | undefined {
    return this.sessions.get(groupId);
  }

  async startSession(opts: StartQuizOptions): Promise<StartQuizResult> {
    if (this.sessions.has(opts.groupId)) {
      return left({
        message: 'Ya hay un quiz activo en este grupo. Usa *!quiz stop* para detenerlo.',
      });
    }

    const total = Math.min(Math.max(opts.totalQuestions, 1), MAX_QUESTIONS);

    const session: QuizSession = {
      groupId: opts.groupId,
      startedBy: opts.startedBy,
      category: opts.category,
      totalQuestions: total,
      currentIndex: 0,
      currentQuestion: null,
      players: new Map(),
      state: QuizSessionState.WAITING_ANSWER,
      startedAt: Date.now(),
      timer: null,
      hintTimer: null,
      questionLog: [],
    };

    session.footer = opts.footer || '> _VaniaBot💝 — Modo Estudio_';
    this.sessions.set(opts.groupId, session);

    const starterStats = await opts.getUserStats(opts.startedBy);
    const difficulty = difficultyEngine.calculate(starterStats, opts.category, 0);
    const question = await questionGenerator.getQuestion(opts.category, difficulty, []);

    if (!question) {
      this.sessions.delete(opts.groupId);
      return left({ message: 'No pude generar preguntas. Intenta de nuevo.' });
    }

    session.currentQuestion = question;

    this._startTimers(
      session,
      opts.sendFn,
      opts.getUserStats,
      opts.updateStats,
      opts.awardCoins,
      opts.awardXP,
    );

    return right({ firstQuestion: question, difficulty });
  }

  async processAnswer(
    groupId: string,
    senderJid: string,
    senderName: string,
    text: string,
    opts: Pick<
      StartQuizOptions,
      'getUserStats' | 'updateStats' | 'awardCoins' | 'awardXP' | 'sendFn'
    >,
  ): Promise<AnswerResult | null> {
    const session = this.sessions.get(groupId);
    if (!session) return null;
    if (session.state !== QuizSessionState.WAITING_ANSWER) return null;
    if (!session.currentQuestion) return null;
    if (!answerValidator.looksLikeAnswer(text)) return null;

    const validation = answerValidator.validate(text, session.currentQuestion);
    if (!validation.isCorrect) return null;

    this._clearTimers(session);

    if (!session.players.has(senderJid)) {
      session.players.set(senderJid, {
        jid: senderJid,
        pushName: senderName,
        score: 0,
        streak: 0,
        correct: 0,
        wrong: 0,
        usedHint: false,
      });
    }

    const player = session.players.get(senderJid);
    if (!player) return null;

    const isFirst =
      player.correct === 0 ||
      !Array.from(session.players.values()).some(p => p.correct > 0 && p.jid !== senderJid);

    player.streak++;
    player.correct++;
    player.answeredAt = Date.now();

    const difficulty = session.currentQuestion.difficulty;
    const coins =
      difficultyEngine.calculateCoins(difficulty, player.streak) * (player.usedHint ? 0.5 : 1);
    const xp = difficultyEngine.calculateXP(difficulty);

    player.score += Math.round(coins);

    session.questionLog.push({
      question: session.currentQuestion.question,
      answer: session.currentQuestion.answer,
      winner: senderJid,
      winnerName: senderName,
      timeMs: player.answeredAt - session.startedAt,
      noAnswer: false,
    });

    await this._updateUserStats(
      senderJid,
      true,
      difficulty,
      session.category,
      player.streak,
      opts.updateStats,
    );
    await opts.awardCoins(senderJid, Math.round(coins));
    await opts.awardXP(senderJid, xp);

    session.state = QuizSessionState.SHOWING_RESULT;

    const sessionEnded = session.currentIndex + 1 >= session.totalQuestions;

    if (!sessionEnded) {
      setTimeout(() => {
        void this._nextQuestion(session, opts);
      }, 4000);
    } else {
      setTimeout(() => {
        void this._endSession(session, opts.sendFn);
      }, 4000);
    }

    return {
      isCorrect: true,
      isFirst,
      player,
      coinsAwarded: Math.round(coins),
      xpAwarded: xp,
      newStreak: player.streak,
      sessionEnded,
    };
  }

  getHint(groupId: string, senderJid: string): string | null {
    const session = this.sessions.get(groupId);
    if (!session?.currentQuestion) return null;
    if (session.state !== QuizSessionState.WAITING_ANSWER) return null;

    for (const player of session.players.values()) {
      if (player.jid === senderJid) player.usedHint = true;
    }

    return session.currentQuestion.hint;
  }

  async stopSession(groupId: string, sendFn: SendFn): Promise<boolean> {
    const session = this.sessions.get(groupId);
    if (!session) return false;

    this._clearTimers(session);
    await this._endSession(session, sendFn, true);
    return true;
  }

  private _clearTimers(session: QuizSession): void {
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    if (session.hintTimer) {
      clearTimeout(session.hintTimer);
      session.hintTimer = null;
    }
  }

  private _startTimers(
    session: QuizSession,
    sendFn: SendFn,
    getUserStats: StartQuizOptions['getUserStats'],
    updateStats: StartQuizOptions['updateStats'],
    awardCoins: StartQuizOptions['awardCoins'],
    awardXP: StartQuizOptions['awardXP'],
  ): void {
    session.hintTimer = setTimeout(() => {
      void (async () => {
        if (session.state !== QuizSessionState.WAITING_ANSWER) return;
        if (!session.currentQuestion) return;
        await sendFn(
          session.groupId,
          `💡 *Pista:* ${session.currentQuestion.hint}\n\n_Quedan ${QUESTION_TIMEOUT_SECS - HINT_OFFER_SECS}s..._`,
        );
      })();
    }, HINT_OFFER_SECS * 1000);

    session.timer = setTimeout(() => {
      void (async () => {
        if (session.state !== QuizSessionState.WAITING_ANSWER) return;
        if (!session.currentQuestion) return;

        session.questionLog.push({
          question: session.currentQuestion.question,
          answer: session.currentQuestion.answer,
          noAnswer: true,
        });

        session.state = QuizSessionState.SHOWING_RESULT;

        await sendFn(
          session.groupId,
          `⏰ *¡Tiempo!*\n\n` +
            `La respuesta era: *${session.currentQuestion.answer}*\n\n` +
            `📖 ${session.currentQuestion.explanation}`,
        );

        for (const player of session.players.values()) {
          player.wrong++;
          player.streak = 0;
          await updateStats(player.jid, {
            totalAnswered: 1,
            currentStreak: 0,
          });
        }

        const sessionEnded = session.currentIndex + 1 >= session.totalQuestions;
        if (!sessionEnded) {
          setTimeout(() => {
            void this._nextQuestion(session, {
              getUserStats,
              updateStats,
              awardCoins,
              awardXP,
              sendFn,
            });
          }, 4000);
        } else {
          setTimeout(() => {
            void this._endSession(session, sendFn);
          }, 4000);
        }
      })();
    }, QUESTION_TIMEOUT_SECS * 1000);
  }

  private async _nextQuestion(
    session: QuizSession,
    opts: Pick<
      StartQuizOptions,
      'getUserStats' | 'updateStats' | 'awardCoins' | 'awardXP' | 'sendFn'
    >,
  ): Promise<void> {
    session.currentIndex++;
    session.state = QuizSessionState.WAITING_ANSWER;

    for (const player of session.players.values()) {
      player.usedHint = false;
    }

    const usedQuestions = session.questionLog.map(l => l.question);

    const topPlayer = this._getTopPlayer(session);
    const topStats = topPlayer ? await opts.getUserStats(topPlayer.jid) : null;
    const difficulty = difficultyEngine.calculate(
      topStats,
      session.category,
      topPlayer?.streak ?? 0,
    );

    const question = await questionGenerator.getQuestion(
      session.category,
      difficulty,
      usedQuestions,
    );

    if (!question) {
      await opts.sendFn(
        session.groupId,
        '❌ No pude generar la siguiente pregunta. Finalizando quiz.',
      );
      await this._endSession(session, opts.sendFn);
      return;
    }

    session.currentQuestion = question;
    const progress = `${session.currentIndex + 1}/${session.totalQuestions}`;
    const diffEmoji = difficultyEngine.emoji(difficulty);
    const diffLabel = difficultyEngine.label(difficulty);

    await opts.sendFn(
      session.groupId,
      `━━━━━━━━━━━\n` +
        `📚 *Pregunta ${progress}* ${diffEmoji} ${diffLabel}\n` +
        `📂 ${session.category}\n` +
        `━━━━━━━━━━━\n\n` +
        `*${question.question}*\n\n` +
        `_Tienes ${QUESTION_TIMEOUT_SECS} segundos..._`,
    );

    this._startTimers(
      session,
      opts.sendFn,
      opts.getUserStats,
      opts.updateStats,
      opts.awardCoins,
      opts.awardXP,
    );
  }

  private async _endSession(session: QuizSession, sendFn: SendFn, forced = false): Promise<void> {
    this._clearTimers(session);
    session.state = QuizSessionState.FINISHED;

    const duration = Math.round((Date.now() - session.startedAt) / 1000);
    const players = Array.from(session.players.values()).sort((a, b) => b.score - a.score);

    let summary = `*Quiz Finalizado${forced ? ' (detenido)' : ''}*\n`;
    summary += `━━━━━━━━━━━\n`;
    summary += `Categoría: *${session.category}*\n`;
    summary += `Preguntas: ${session.questionLog.length}/${session.totalQuestions}\n`;
    summary += `Duración: ${duration}s\n\n`;

    if (players.length > 0) {
      summary += `*Resultados:*\n`;
      const medals = ['🥇', '🥈', '🥉'];
      players.forEach((p, i) => {
        const medal = medals[i] ?? `${i + 1}.`;
        summary += `${medal} *${p.pushName}* — ${p.score} pts (${p.correct}✅ ${p.wrong}❌)\n`;
      });
    } else {
      summary += `_Nadie respondió ninguna pregunta_ 😔\n`;
    }

    const unanswered = session.questionLog.filter(q => q.noAnswer);
    if (unanswered.length > 0) {
      summary += `\n📖 *Respuestas que nadie supo:*\n`;
      unanswered.forEach(q => {
        summary += `• ${q.question}\n  ↳ *${q.answer}*\n`;
      });
    }

    const footer = session.footer || '> _VaniaBot💝 — Modo Estudio_';
    summary += `\n${footer}`;

    await sendFn(session.groupId, summary);
    this.sessions.delete(session.groupId);
  }

  private async _updateUserStats(
    jid: string,
    correct: boolean,
    difficulty: QuizDifficulty,
    category: string,
    streak: number,
    updateFn: StartQuizOptions['updateStats'],
  ): Promise<void> {
    await updateFn(jid, {
      totalAnswered: 1,
      totalCorrect: correct ? 1 : 0,
      currentStreak: correct ? streak : 0,
      lastPlayed: Date.now(),
    });
  }

  private _getTopPlayer(session: QuizSession): QuizPlayer | null {
    let top: QuizPlayer | null = null;
    for (const p of session.players.values()) {
      if (!top || p.score > top.score) top = p;
    }
    return top;
  }

  formatStatsMessage(stats: UserQuizStats, pushName: string, footer?: string): string {
    const accuracy =
      stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

    const categories = Object.entries(stats.byCategory ?? {})
      .sort(([, a], [, b]) => b.correct - a.correct)
      .slice(0, 5)
      .map(([cat, s]) => {
        const acc = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0;
        return `  • *${cat}*: ${s.correct}/${s.answered} (${acc}%)`;
      })
      .join('\n');

    const defaultFooter = footer || '> _VaniaBot💝 — Modo Estudio_';
    return (
      `*Stats de Quiz — ${pushName}*\n` +
      `━━━━━━━━━━━\n` +
      `Correctas: ${stats.totalCorrect}\n` +
      `Jugadas:   ${stats.totalAnswered}\n` +
      `Precisión: ${accuracy}%\n` +
      `Mejor racha: ${stats.bestStreak}\n` +
      `Sesiones:  ${stats.sessionsPlayed}\n` +
      (categories ? `\n *Por categoría:*\n${categories}\n` : '') +
      `\n${defaultFooter}`
    );
  }
}

export const quizService = new QuizService();
