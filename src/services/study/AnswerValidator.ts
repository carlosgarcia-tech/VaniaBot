/**
 * AnswerValidator.ts
 *
 * VaniaBot services module exposing `AnswerValidator`, `answerValidator`.
 *
 * @author **Carlos G**
 */

import type { AnswerValidation, QuizQuestion } from './QuizTypes.js';

export class AnswerValidator {
  normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  levenshtein(a: string, b: string): number {
    const m = a.length,
      n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  validate(userInput: string, question: QuizQuestion): AnswerValidation {
    const normalized = this.normalize(userInput);

    const candidates = [question.answer, ...question.acceptableAnswers].map(a => this.normalize(a));

    const STOPWORDS = new Set([
      'el',
      'la',
      'los',
      'las',
      'un',
      'una',
      'unos',
      'unas',
      'de',
      'del',
      'al',
      'en',
      'es',
      'son',
      'se',
      'su',
      'sus',
      'que',
      'por',
      'con',
      'para',
      'tipo',
      'valor',
      'nombre',
      'metodo',
      'clase',
      'variable',
      'funcion',
      'dato',
      'datos',
      'the',
      'a',
      'an',
      'of',
      'is',
      'are',
      'type',
      'value',
    ]);
    const userWords = normalized.split(/\s+/).filter(w => w.length >= 2 && !STOPWORDS.has(w));

    for (const candidate of candidates) {
      const candidateWords = candidate.split(/\s+/);

      if (normalized === candidate) {
        return { isCorrect: true, normalized, matchedWith: candidate };
      }

      for (const word of userWords) {
        if (word === candidate) {
          return { isCorrect: true, normalized, matchedWith: candidate };
        }
        if (candidate.length >= 3 && word.length >= 3) {
          const dist = this.levenshtein(word, candidate);
          const threshold = candidate.length <= 5 ? 1 : 2;
          if (dist <= threshold) {
            return { isCorrect: true, normalized, matchedWith: candidate };
          }
        }
      }

      if (normalized.includes(candidate)) {
        const idx = normalized.indexOf(candidate);
        const before = idx === 0 ? ' ' : normalized[idx - 1];
        const after =
          idx + candidate.length >= normalized.length ? ' ' : normalized[idx + candidate.length];
        const isBoundary = /[\s,.]/.test(before) && /[\s,.]/.test(after);
        if (isBoundary) {
          return { isCorrect: true, normalized, matchedWith: candidate };
        }
      }

      if (candidate.includes(normalized) && normalized.length >= 3) {
        const lenRatio = normalized.length / candidate.length;
        if (lenRatio >= 0.4) {
          return { isCorrect: true, normalized, matchedWith: candidate };
        }
      }

      if (candidate.length >= 3 && normalized.length >= 2) {
        const dist = this.levenshtein(normalized, candidate);
        const threshold = candidate.length <= 5 ? 1 : candidate.length <= 9 ? 2 : 3;
        if (dist <= threshold) {
          return { isCorrect: true, normalized, matchedWith: candidate };
        }
      }

      if (userWords.length >= 2 && candidateWords.length >= 2) {
        const allMatch = candidateWords.every(cw =>
          userWords.some(uw => uw === cw || this.levenshtein(uw, cw) <= 1),
        );
        if (allMatch) {
          return { isCorrect: true, normalized, matchedWith: candidate };
        }
      }
    }
    return { isCorrect: false, normalized, matchedWith: '' };
  }

  looksLikeAnswer(text: string): boolean {
    if (text.startsWith('!') || text.startsWith('/')) return false;
    if (text.length > 120) return false;
    if (text.length < 1) return false;
    return true;
  }
}

export const answerValidator = new AnswerValidator();
