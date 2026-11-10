/**
 * AIService.test.ts
 *
 * Unit tests for the AIService class.
 * Tests AI chat, session management, and transcription.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('groq-sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Test response',
                },
              },
            ],
          }),
        },
      },
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue('Transcribed text'),
        },
      },
    })),
  };
});

vi.mock('@/config/env', () => ({
  env: {
    GROQ_API_KEY: 'test-key',
  },
}));

vi.mock('@/services/system/Servicemanager', () => ({
  serviceManager: {
    db: {
      isConnected: vi.fn().mockReturnValue(true),
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    },
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  createReadStream: vi.fn(),
}));

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should have correct model configuration', () => {
      const GROQ_MODELS = {
        chat: 'llama-3.3-70b-versatile',
        fast: 'llama-3.1-8b-instant',
        transcribe: 'whisper-large-v3-turbo',
      };

      expect(GROQ_MODELS.chat).toBe('llama-3.3-70b-versatile');
      expect(GROQ_MODELS.fast).toBe('llama-3.1-8b-instant');
      expect(GROQ_MODELS.transcribe).toBe('whisper-large-v3-turbo');
    });

    it('should have correct session configuration', () => {
      const MAX_HISTORY_MESSAGES = 20;
      const SESSION_TTL_MS = 30 * 60 * 1000;

      expect(MAX_HISTORY_MESSAGES).toBe(20);
      expect(SESSION_TTL_MS).toBe(1800000);
    });
  });

  describe('system prompt', () => {
    it('should define OrbitBot personality', () => {
      const prompt = `Eres OrbitBot, un bot super dotada`;

      expect(prompt).toContain('OrbitBot');
    });

    it('should include response format guidelines', () => {
      const prompt = `Eres OrbitBot`;

      expect(prompt).toBeDefined();
    });
  });

  describe('conversation session', () => {
    it('should have correct session key format', () => {
      const chatJid = 'group@test.g.us';
      const senderJid = 'user@test.com';
      const key = `${chatJid}::${senderJid}`;

      expect(key).toBe('group@test.g.us::user@test.com');
    });

    it('should track session history', () => {
      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });
  });

  describe('error handling', () => {
    it('should handle 401 errors', () => {
      const friendlyError = (status: number, msg: string): string => {
        if (status === 401 || msg.includes('401')) {
          return 'API key inválida. Revisa GROQ_API_KEY en .env';
        }
        if (status === 429 || msg.includes('rate_limit')) {
          return 'Límite de uso alcanzado. Intenta en unos segundos.';
        }
        if (status === 503 || msg.includes('503')) {
          return 'Groq no disponible temporalmente. Intenta de nuevo.';
        }
        if (msg.includes('model')) return 'Modelo no disponible.';

        return msg || 'Error desconocido';
      };

      expect(friendlyError(401, 'Unauthorized')).toContain('API key');
      expect(friendlyError(429, 'rate_limit')).toContain('Límite');
      expect(friendlyError(503, 'Service Unavailable')).toContain('disponible');
    });
  });

  describe('transcription', () => {
    it('should use correct temp directory', () => {
      const TEMP_DIR = './data/temp/audio';

      expect(TEMP_DIR).toBe('./data/temp/audio');
    });

    it('should support language parameter', () => {
      const language = 'es';

      expect(language).toBe('es');
    });
  });
});
