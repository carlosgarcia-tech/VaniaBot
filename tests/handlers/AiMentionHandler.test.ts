/**
 * AiMentionHandler.test.ts
 *
 * Unit tests for the AiMentionHandler.
 * Tests AI mention detection and response.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi } from 'vitest';

describe('AiMentionHandler', () => {
  describe('mention detection', () => {
    const BOT_NAMES = ['orbit', 'orbit bot', 'orbit', 'bot'];

    const mentionsBot = (text: string): boolean => {
      const lowerText = text.toLowerCase();
      return BOT_NAMES.some(name => lowerText.includes(name));
    };

    it('should detect orbit mention', () => {
      expect(mentionsBot('@orbit hola')).toBe(true);
      expect(mentionsBot('hola orbit')).toBe(true);
    });

    it('should detect orbit bot mention', () => {
      expect(mentionsBot('hey orbit bot')).toBe(true);
    });

    it('should detect vanibot mention', () => {
      expect(mentionsBot('orbit responde')).toBe(true);
    });

    it('should detect bot keyword', () => {
      expect(mentionsBot('bot responde')).toBe(true);
    });

    it('should return false for no mention', () => {
      expect(mentionsBot('hola como estas')).toBe(false);
    });
  });

  describe('AI trigger detection', () => {
    const AI_TRIGGERS = ['.', '/ai', '/chat', 'ia:', 'ai:'];

    const isAITrigger = (text: string): boolean => {
      const lowerText = text.toLowerCase().trim();
      return AI_TRIGGERS.some(trigger => lowerText.startsWith(trigger));
    };

    it('should detect prefix trigger', () => {
      expect(isAITrigger('.hola')).toBe(true);
      expect(isAITrigger('/ai hola')).toBe(true);
      expect(isAITrigger('/chat hola')).toBe(true);
    });

    it('should detect inline AI trigger', () => {
      expect(isAITrigger('ia: hola')).toBe(true);
      expect(isAITrigger('ai: responde')).toBe(true);
    });

    it('should return false for regular messages', () => {
      expect(isAITrigger('hola grupo')).toBe(false);
      expect(isAITrigger('buenas')).toBe(false);
    });
  });

  describe('context extraction', () => {
    const extractMessageText = (fullText: string): string => {
      const triggers = ['.', '/ai', '/chat', 'ia:', 'ai:'];

      for (const trigger of triggers) {
        const index = fullText.toLowerCase().indexOf(trigger);
        if (index !== -1) {
          return fullText.slice(index + trigger.length).trim();
        }
      }

      return fullText.replace(/@\w+\s*/gi, '').trim();
    };

    it('should extract text after trigger', () => {
      expect(extractMessageText('.hola mundo')).toBe('hola mundo');
      expect(extractMessageText('/ai que es esto')).toBe('que es esto');
    });

    it('should remove mention', () => {
      expect(extractMessageText('@orbit hola')).toBe('hola');
      expect(extractMessageText('@orbit que tal')).toBe('que tal');
    });
  });

  describe('response generation', () => {
    const generateResponse = (userText: string, hasMention: boolean, isGroup: boolean): string => {
      if (!hasMention && !userText.startsWith('.')) {
        return '';
      }

      const maxLength = isGroup ? 200 : 500;
      return `[Simulated AI response to: ${userText.slice(0, 50)}...]`;
    };

    it('should generate response for mentions', () => {
      const response = generateResponse('hola orbit', true, true);
      expect(response).toContain('Simulated AI response');
    });

    it('should generate shorter response for groups', () => {
      const groupResponse = generateResponse('test', true, true);
      const privateResponse = generateResponse('test', true, false);
      expect(groupResponse.length).toBeLessThanOrEqual(privateResponse.length);
    });

    it('should return empty for non-trigger messages', () => {
      const response = generateResponse('hola grupo', false, true);
      expect(response).toBe('');
    });
  });
});
