/**
 * AITypes.ts
 *
 * VaniaBot services module exposing `AIMessage`, `ConversationSession`, `GroqError`, `GROQ_MODELS`.
 *
 * @author **Carlos G**
 */

import type { Either } from '@/utils/either.js';
import type { VBotError, ValidationError, ServiceUnavailableError } from '@/utils/errors.js';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export type AIError = VBotError | ServiceUnavailableError | ValidationError;

export type AIResponse = Either<AIError, string>;

export interface ConversationSession {
  chatJid: string;
  senderJid: string;
  history: AIMessage[];
  createdAt: number;
  lastActivity: number;
}

export const GROQ_MODELS = {
  chat: 'llama-3.3-70b-versatile',
  fast: 'llama-3.1-8b-instant',
  transcribe: 'whisper-large-v3-turbo',
} as const;

export const MAX_HISTORY_MESSAGES = 20;
export const SESSION_TTL_MS = 30 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
export const PERSIST_INTERVAL_MS = 2 * 60 * 1000;
export const AI_SESSIONS_COLLECTION = 'ai_sessions';
export const TEMP_DIR = './data/temp/audio';

export enum UserTier {
  CREATOR = 'creator',
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
}

export interface GroqError {
  message?: string;
  status?: number;
  error?: {
    message?: string;
    code?: string;
  };
}
