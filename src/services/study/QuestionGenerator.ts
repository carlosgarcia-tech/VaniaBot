/**
 * QuestionGenerator.ts
 *
 * VaniaBot services module exposing `QuestionGenerator`, `questionGenerator`.
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview Generates quiz questions via AIService (Groq) with in-memory cache.
 *
 * Each question is a structured JSON object validated before returning.
 * Questions are cached per (category + difficulty) to reduce API calls
 * and are rotated to avoid repeats within a session.
 *
 * @module QuestionGenerator
 */

import { aiService } from '@/services/external/AIService.js';
import { isRight } from '@/utils/either.js';
import type { QuizDifficulty } from './QuizTypes.js';
import { logError } from '@/utils/logger.js';
import type { QuizQuestion } from './QuizTypes.js';

const CACHE_TTL = 2 * 60 * 60 * 1000;

interface CacheEntry {
  questions: QuizQuestion[];
  createdAt: number;
}

interface RawQuestion {
  question: string;
  answer: string;
  acceptableAnswers: string[];
  explanation: string;
  hint: string;
  difficulty?: string;
  category?: string;
}

export class QuestionGenerator {
  private cache = new Map<string, CacheEntry>();

  /**
   * Obtiene la siguiente pregunta para una sesión.
   * Primero busca en caché, si no genera una nueva.
   *
   * @param category    - Tema del quiz
   * @param difficulty  - Dificultad calculada por DifficultyEngine
   * @param usedQuestions - Preguntas ya hechas en esta sesión (para evitar repetir)
   */
  async getQuestion(
    category: string,
    difficulty: QuizDifficulty,
    usedQuestions: string[],
  ): Promise<QuizQuestion | null> {
    const key = `${category}::${difficulty}`;
    const entry = this.cache.get(key);

    if (entry && Date.now() - entry.createdAt < CACHE_TTL) {
      const fresh = entry.questions.find(q => !usedQuestions.includes(q.question));
      if (fresh) return fresh;
    }

    const batch = await this.generateBatch(category, difficulty, usedQuestions);
    if (!batch.length) return null;

    this.cache.set(key, { questions: batch, createdAt: Date.now() });

    return batch.find(q => !usedQuestions.includes(q.question)) ?? batch[0];
  }

  /** Genera un lote de N preguntas en una sola llamada a la IA */
  private async generateBatch(
    category: string,
    difficulty: QuizDifficulty,
    avoid: string[],
  ): Promise<QuizQuestion[]> {
    const diffLabel = { easy: 'fácil', medium: 'intermedia', hard: 'difícil' }[difficulty];
    const avoidStr = avoid
      .slice(-10)
      .map(q => `- ${q}`)
      .join('\n');

    const prompt = `Eres un generador de preguntas de trivia/quiz educativo.

Categoría: ${category}
Dificultad: ${diffLabel}
${avoid.length ? `\nNO repitas estas preguntas:\n${avoidStr}` : ''}

Genera EXACTAMENTE 5 preguntas diferentes. Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON.

Formato requerido:
[
  {
    "question": "¿Pregunta clara y directa?",
    "answer": "respuesta exacta en minúsculas",
    "acceptableAnswers": ["variante1", "variante2"],
    "explanation": "Explicación breve de 1-2 oraciones de por qué esta es la respuesta.",
    "hint": "Pista que ayude sin revelar la respuesta directamente.",
    "difficulty": "${difficulty}",
    "category": "${category}"
  }
]

Reglas:
- Las preguntas deben ser precisas y tener UNA respuesta correcta indiscutible.
- "answer" siempre en minúsculas, sin tildes en acceptableAnswers para facilitar matching.
- "hint" no debe contener la respuesta directamente.
- Para dificultad "hard": preguntas específicas, técnicas o con trampa.
- Para dificultad "easy": conceptos fundamentales y ampliamente conocidos.`;

    const res = await aiService.generate(prompt, 1500);
    if (!isRight(res)) return [];

    return this.parseAndValidate(res.right, category, difficulty);
  }

  private parseAndValidate(
    raw: string,
    category: string,
    difficulty: QuizDifficulty,
  ): QuizQuestion[] {
    try {
      const clean = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      const match = clean.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No se encontró array JSON');

      const parsed = JSON.parse(match[0]) as unknown[];
      if (!Array.isArray(parsed)) throw new Error('Respuesta no es array');

      return parsed
        .filter((q): q is RawQuestion => {
          if (typeof q !== 'object' || q === null) return false;
          const obj = q as Record<string, unknown>;
          return (
            typeof obj.question === 'string' &&
            typeof obj.answer === 'string' &&
            typeof obj.explanation === 'string' &&
            typeof obj.hint === 'string' &&
            Array.isArray(obj.acceptableAnswers) &&
            obj.acceptableAnswers.every((a: unknown) => typeof a === 'string')
          );
        })
        .map((q): QuizQuestion => ({
          question: q.question.trim(),
          answer: q.answer.toLowerCase().trim(),
          acceptableAnswers: q.acceptableAnswers.map(a => a.toLowerCase().trim()),
          explanation: q.explanation.trim(),
          hint: q.hint.trim(),
          difficulty,
          category,
        }));
    } catch (err) {
      logError('[QuizGen] Error parseando preguntas', err);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  cacheStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [key, entry] of this.cache.entries()) {
      stats[key] = entry.questions.length;
    }
    return stats;
  }
}

export const questionGenerator = new QuestionGenerator();
