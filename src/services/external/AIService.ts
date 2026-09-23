import type { WASocket } from 'baileys';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { left, right } from '@/utils/either.js';
import { env } from '@/config/env.js';
import {
  circuitBreakerManager,
  CircuitOpenError,
} from '@/services/system/CircuitBreakerService.js';
import { withRetry } from '@/services/system/RetryService.js';
import { unifiedCache } from '@/services/system/UnifiedCacheService.js';
import { logError, logger } from '@/utils/logger.js';
import { ServiceUnavailableError, NetworkError, ValidationError } from '@/utils/errors.js';
import type { AIMessage, AIResponse, GroqError } from './AITypes.js';
import { GROQ_MODELS, TEMP_DIR } from './AITypes.js';
import { getUserTier, formatSystemPrompt } from './AIPrompts.js';
import { AISessionStore } from './AISessionStore.js';

const MAX_HISTORY_MESSAGES = 20;

export class AIService {
  private client: Groq | null;
  private sessionStore: AISessionStore;

  constructor() {
    if (!env.GROQ_API_KEY) {
      logger.warn(
        'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional',
      );
      this.client = null;
    } else {
      this.client = new Groq({ apiKey: env.GROQ_API_KEY });
    }

    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    this.sessionStore = new AISessionStore();

    logger.debug(`[AI] AIService iniciado con Groq`);
    logger.debug(`   Chat:   ${GROQ_MODELS.chat}`);
    logger.debug(`   Fast:   ${GROQ_MODELS.fast}`);
    logger.debug(`   Voice:  ${GROQ_MODELS.transcribe}`);
  }

  async initialize(): Promise<void> {
    await this.sessionStore.initialize();
  }

  private generateCacheKey(prompt: string, chatJid: string, fast: boolean): string {
    const hash = createHash('sha256');
    hash.update(`${chatJid}:${fast}:${prompt.slice(0, 100)}`);
    return `ai:chat:${hash.digest('hex').slice(0, 16)}`;
  }

  private async getCachedResponse(key: string): Promise<AIResponse | null> {
    try {
      return await unifiedCache.get<AIResponse>(key);
    } catch (error) {
      logError('[AI]', error);
      return null;
    }
  }

  private async cacheResponse(key: string, value: AIResponse, ttl = 300): Promise<void> {
    try {
      await unifiedCache.set(key, value, ttl);
    } catch (error) {
      logError('[AI]', error);
    }
  }

  getSession(chatJid: string, senderJid: string) {
    return this.sessionStore.getSession(chatJid, senderJid);
  }

  async clearSession(chatJid: string, senderJid: string): Promise<void> {
    await this.sessionStore.clearSession(chatJid, senderJid);
  }

  async clearGroupSessions(chatJid: string): Promise<void> {
    await this.sessionStore.clearGroupSessions(chatJid);
  }

  getSessionCount(): number {
    return this.sessionStore.getSessionCount();
  }

  getStats() {
    const sessionStats = this.sessionStore.getStats();
    return {
      ...sessionStats,
      cache: unifiedCache.getMemoryStats(),
    };
  }

  async chat(
    chatJid: string,
    senderJid: string,
    userMessage: string,
    fast = false,
  ): Promise<AIResponse> {
    if (!this.client) {
      return left(
        new ServiceUnavailableError(
          'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional',
        ),
      );
    }
    const client = this.client;
    if (!userMessage.trim()) {
      return left(new ValidationError('El mensaje no puede estar vacío'));
    }

    const session = this.sessionStore.getSession(chatJid, senderJid);

    const cacheKey = this.generateCacheKey(userMessage, chatJid, fast);
    const cached = await this.getCachedResponse(cacheKey);

    if (cached && session.history.length === 0) {
      return cached;
    }

    session.lastActivity = Date.now();

    const userTier = getUserTier(senderJid, env.OWNERS, env.OWNER_JID);
    const systemPrompt = await formatSystemPrompt({} as WASocket, chatJid, userTier);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...session.history,
      { role: 'user', content: userMessage },
    ];

    const circuitBreaker = circuitBreakerManager.getOrCreate('ai-groq', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      name: 'ai-groq',
    });

    try {
      const completion = await circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            return await client.chat.completions.create({
              model: fast ? GROQ_MODELS.fast : GROQ_MODELS.chat,
              messages,
              max_tokens: 1024,
              temperature: 0.7,
            });
          },
          {
            maxAttempts: 2,
            baseDelay: 1000,
            maxDelay: 5000,
          },
        );
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';

      session.history.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: text },
      );

      if (session.history.length > MAX_HISTORY_MESSAGES) {
        session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
      }

      this.sessionStore.markDirty(chatJid, senderJid);

      const response = right(text);
      await this.cacheResponse(cacheKey, response, 600);
      return response;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return left(new ServiceUnavailableError('AI Service'));
      }
      const groqError = error as GroqError;
      logger.error('❌ [AI] chat error:', groqError.message);
      return left(new NetworkError(this.friendlyError(groqError), { groqError }));
    }
  }

  async generate(prompt: string, maxTokens = 512): Promise<AIResponse> {
    if (!this.client) {
      return left(
        new ServiceUnavailableError(
          'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional',
        ),
      );
    }
    const client = this.client;
    const cacheKey = this.generateCacheKey(prompt, 'generate', false);
    const cached = await this.getCachedResponse(cacheKey);

    if (cached) {
      return cached;
    }

    const circuitBreaker = circuitBreakerManager.getOrCreate('ai-groq', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      name: 'ai-groq',
    });

    try {
      const completion = await circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            return await client.chat.completions.create({
              model: GROQ_MODELS.chat,
              messages: [
                { role: 'system', content: 'Eres VaniaBot, el bot más perfecto e inteligente.' },
                { role: 'user', content: prompt },
              ],
              max_tokens: maxTokens,
              temperature: 0.7,
            });
          },
          {
            maxAttempts: 2,
            baseDelay: 1000,
            maxDelay: 5000,
          },
        );
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      const response = right(text);
      await this.cacheResponse(cacheKey, response, 600);
      return response;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return left(new ServiceUnavailableError('AI Service'));
      }
      const groqError = error as GroqError;
      logger.error('❌ [AI] generate error:', groqError.message);
      return left(new NetworkError(this.friendlyError(groqError), { groqError }));
    }
  }

  async chatWithCustomPrompt(
    senderJid: string,
    userMessage: string,
    customSystemPrompt: string,
    _storeName?: string,
  ): Promise<string> {
    if (!this.client) {
      return 'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional';
    }
    const client = this.client;
    try {
      const circuitBreaker = circuitBreakerManager.getOrCreate('ai-store', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000,
        name: 'ai-store',
      });

      const completion = await circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            return await client.chat.completions.create({
              model: GROQ_MODELS.chat,
              messages: [
                { role: 'system', content: customSystemPrompt },
                { role: 'user', content: userMessage },
              ],
              max_tokens: 1024,
              temperature: 0.7,
            });
          },
          {
            maxAttempts: 2,
            baseDelay: 1000,
            maxDelay: 5000,
          },
        );
      });

      return completion.choices[0]?.message?.content?.trim() ?? '';
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return 'Servicio de IA temporalmente no disponible. Intenta más tarde.';
      }
      const groqError = error as GroqError;
      logger.error('❌ [AI] store chat error:', groqError.message);
      return this.friendlyError(groqError);
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    extension: string = 'ogg',
    language?: string,
  ): Promise<AIResponse> {
    if (!this.client) {
      return left(
        new ServiceUnavailableError(
          'API KEY no establecida, esta función se encuentra temporalmente inhabilitada hasta que se agregue una api key funcional',
        ),
      );
    }
    const client = this.client;
    const tmpPath = path.join(TEMP_DIR, `voice_${Date.now()}.${extension}`);

    try {
      fs.writeFileSync(tmpPath, audioBuffer);

      const transcription = await client.audio.transcriptions.create({
        file: fs.createReadStream(tmpPath),
        model: GROQ_MODELS.transcribe,
        ...(language ? { language } : {}),
        response_format: 'text',
      });

      return right(String(transcription).trim());
    } catch (error) {
      const groqError = error as GroqError;
      logger.error('❌ [AI] transcribeAudio error:', groqError.message);
      return left(new NetworkError(this.friendlyError(groqError), { groqError }));
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch (error) {
        logError('[AI]', error);
      }
    }
  }

  private friendlyError(error: GroqError): string {
    const msg: string = error?.message ?? '';
    const status: number = error?.status ?? 0;

    if (status === 401 || msg.includes('401'))
      return 'API key inválida. Revisa GROQ_API_KEY en .env';
    if (status === 429 || msg.includes('rate_limit'))
      return 'Límite de uso alcanzado. Intenta en unos segundos.';
    if (status === 503 || msg.includes('503'))
      return 'Groq no disponible temporalmente. Intenta de nuevo.';
    if (msg.includes('model')) return 'Modelo no disponible.';

    return msg || 'Error desconocido';
  }

  async shutdown(): Promise<void> {
    await this.sessionStore.shutdown();
    logger.debug('[AI] AIService shutdown complete');
  }
}

export const aiService = new AIService();
