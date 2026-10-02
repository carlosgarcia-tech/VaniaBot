/**
 * QuizTypes.ts
 *
 * VaniaBot services module exposing `QuizQuestion`, `QuizPlayer`, `QuizSession`, `QuestionLogEntry`.
 *
 * @author **Carlos G**
 */

export enum QuizDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum QuizCategory {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  HISTORIA = 'historia',
  CIENCIA = 'ciencia',
  MATEMATICAS = 'matematicas',
  ANIME = 'anime',
  CULTURA = 'cultura general',
  GEOGRAFIA = 'geografia',
  PERSONALIZADO = 'personalizado',
}

export enum QuizSessionState {
  WAITING_ANSWER = 'waiting_answer',
  SHOWING_RESULT = 'showing_result',
  FINISHED = 'finished',
  PAUSED = 'paused',
}

export interface QuizQuestion {
  question: string;
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  hint: string;
  difficulty: QuizDifficulty;
  category: string;
}

export interface QuizPlayer {
  jid: string;
  pushName: string;
  score: number;
  streak: number;
  correct: number;
  wrong: number;
  usedHint: boolean;
  answeredAt?: number;
}

export interface QuizSession {
  groupId: string;
  startedBy: string;
  category: string;
  totalQuestions: number;
  currentIndex: number;
  currentQuestion: QuizQuestion | null;
  players: Map<string, QuizPlayer>;
  state: QuizSessionState;
  startedAt: number;
  timer: NodeJS.Timeout | null;
  hintTimer: NodeJS.Timeout | null;
  questionLog: QuestionLogEntry[];
  footer?: string;
}

export interface QuestionLogEntry {
  question: string;
  answer: string;
  winner?: string;
  winnerName?: string;
  timeMs?: number;
  noAnswer: boolean;
}

export interface UserQuizStats {
  totalCorrect: number;
  totalAnswered: number;
  totalScore: number;
  bestStreak: number;
  currentStreak: number;
  byCategory: Record<string, CategoryStats>;
  lastPlayed: number;
  sessionsPlayed: number;
}

export interface CategoryStats {
  correct: number;
  answered: number;
  bestStreak: number;
}

export interface AnswerValidation {
  isCorrect: boolean;
  normalized: string;
  matchedWith: string;
}

export interface AnswerResult {
  isCorrect: boolean;
  isFirst: boolean;
  player: QuizPlayer;
  coinsAwarded: number;
  xpAwarded: number;
  newStreak: number;
  sessionEnded: boolean;
}
