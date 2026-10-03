/**
 * validators.test.ts
 *
 * Unit tests for validation utility functions.
 * Tests WhatsApp number validation, email, URL, and other validators.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect } from 'vitest';
import {
  isValidWhatsAppNumber,
  isGroupJid,
  isUserJid,
  cleanPhoneNumber,
  isValidEmail,
  isValidUrl,
  isNumeric,
  isAlphanumeric,
  minLength,
  maxLength,
  inRange,
  hasRequiredProps,
  isValidDate,
  isValidTime,
  sanitizeInput,
  isNonEmptyArray,
  isOneOf,
  isAlpha,
  isValidHex,
  isInteger,
  isPositive,
  hasSpecialChars,
  isValidUsername,
  isPlainObject,
  isValidJSON,
  isStrongPassword,
  containsProfanity,
  isWhatsAppLink,
  isDomainLink,
  validateBetAmount,
  validateTransferAmount,
  validateWorkCooldown,
  validateDailyCooldown,
  validateWeeklyCooldown,
  sanitizeTextInput,
} from '../../src/utils/validators.js';

describe('Validators', () => {
  describe('isValidWhatsAppNumber', () => {
    it('should validate correct WhatsApp numbers', () => {
      expect(isValidWhatsAppNumber('+529514639799')).toBe(true);
      expect(isValidWhatsAppNumber('529514639799')).toBe(true);
      expect(isValidWhatsAppNumber('9514639799')).toBe(true);
    });

    it('should reject invalid numbers', () => {
      expect(isValidWhatsAppNumber('123')).toBe(false);
      expect(isValidWhatsAppNumber('abc')).toBe(false);
      expect(isValidWhatsAppNumber('')).toBe(false);
    });
  });

  describe('isGroupJid', () => {
    it('should identify group JIDs', () => {
      expect(isGroupJid('123456789@g.us')).toBe(true);
      expect(isGroupJid('test@g.us')).toBe(true);
    });

    it('should reject non-group JIDs', () => {
      expect(isGroupJid('123456789@s.whatsapp.net')).toBe(false);
      expect(isGroupJid('user@lid')).toBe(false);
    });
  });

  describe('isUserJid', () => {
    it('should identify user JIDs', () => {
      expect(isUserJid('123456789@s.whatsapp.net')).toBe(true);
    });

    it('should reject non-user JIDs', () => {
      expect(isUserJid('123456789@g.us')).toBe(false);
    });
  });

  describe('cleanPhoneNumber', () => {
    it('should clean phone numbers', () => {
      expect(cleanPhoneNumber('+52 951 463 9799')).toBe('+529514639799');
      expect(cleanPhoneNumber('(951) 463-9799')).toBe('9514639799');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isNumeric', () => {
    it('should identify numeric strings', () => {
      expect(isNumeric('12345')).toBe(true);
      expect(isNumeric('0')).toBe(true);
    });

    it('should reject non-numeric strings', () => {
      expect(isNumeric('123a')).toBe(false);
      expect(isNumeric('abc')).toBe(false);
    });
  });

  describe('isAlphanumeric', () => {
    it('should identify alphanumeric strings', () => {
      expect(isAlphanumeric('abc123')).toBe(true);
      expect(isAlphanumeric('ABC')).toBe(true);
    });

    it('should reject non-alphanumeric strings', () => {
      expect(isAlphanumeric('abc-123')).toBe(false);
      expect(isAlphanumeric('abc def')).toBe(false);
    });
  });

  describe('minLength', () => {
    it('should validate minimum length', () => {
      expect(minLength('hello', 3)).toBe(true);
      expect(minLength('hi', 3)).toBe(false);
    });
  });

  describe('maxLength', () => {
    it('should validate maximum length', () => {
      expect(maxLength('hello', 10)).toBe(true);
      expect(maxLength('hello', 3)).toBe(false);
    });
  });

  describe('inRange', () => {
    it('should check if number is in range', () => {
      expect(inRange(5, 1, 10)).toBe(true);
      expect(inRange(1, 1, 10)).toBe(true);
      expect(inRange(10, 1, 10)).toBe(true);
      expect(inRange(0, 1, 10)).toBe(false);
      expect(inRange(11, 1, 10)).toBe(false);
    });
  });

  describe('hasRequiredProps', () => {
    it('should validate required properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(hasRequiredProps(obj, ['a', 'b'] as (keyof typeof obj)[])).toBe(true);
      expect(hasRequiredProps(obj, ['a', 'd'] as (keyof typeof obj)[])).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should validate correct dates', () => {
      expect(isValidDate('2024-01-01')).toBe(true);
      expect(isValidDate('2026-12-31')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('2024/01/01')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('2024-13-01')).toBe(false);
    });
  });

  describe('isValidTime', () => {
    it('should validate correct times', () => {
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('12:30')).toBe(true);
    });

    it('should reject invalid times', () => {
      expect(isValidTime('25:00')).toBe(false);
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('invalid')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize dangerous input', () => {
      expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
      expect(sanitizeInput('"quoted"')).toBe('quoted');
      expect(sanitizeInput("'single'")).toBe('single');
    });
  });

  describe('isNonEmptyArray', () => {
    it('should identify non-empty arrays', () => {
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a'])).toBe(true);
    });

    it('should reject empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
      expect(isNonEmptyArray(null as any)).toBe(false);
      expect(isNonEmptyArray(undefined as any)).toBe(false);
    });
  });

  describe('isOneOf', () => {
    it('should check if value is in options', () => {
      expect(isOneOf('a', ['a', 'b', 'c'])).toBe(true);
      expect(isOneOf('x', ['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('isAlpha', () => {
    it('should identify alphabetic strings', () => {
      expect(isAlpha('hello')).toBe(true);
      expect(isAlpha('HELLO')).toBe(true);
    });

    it('should reject non-alpha strings', () => {
      expect(isAlpha('hello1')).toBe(false);
      expect(isAlpha('hello world')).toBe(false);
    });
  });

  describe('isValidHex', () => {
    it('should validate 6-digit hex colors', () => {
      expect(isValidHex('#ff0000')).toBe(true);
      expect(isValidHex('ff0000')).toBe(true);
    });

    it('should reject invalid hex', () => {
      expect(isValidHex('#FFF')).toBe(false);
      expect(isValidHex('nothex')).toBe(false);
      expect(isValidHex('#gggggg')).toBe(false);
    });
  });

  describe('isInteger', () => {
    it('should identify integers', () => {
      expect(isInteger(42)).toBe(true);
      expect(isInteger(0)).toBe(true);
      expect(isInteger(-5)).toBe(true);
    });

    it('should reject non-integers', () => {
      expect(isInteger(3.14)).toBe(false);
      expect(isInteger(NaN)).toBe(false);
    });
  });

  describe('isPositive', () => {
    it('should identify positive numbers', () => {
      expect(isPositive(1)).toBe(true);
      expect(isPositive(0.1)).toBe(true);
    });

    it('should reject non-positive numbers', () => {
      expect(isPositive(0)).toBe(false);
      expect(isPositive(-1)).toBe(false);
    });
  });

  describe('hasSpecialChars', () => {
    it('should identify special characters', () => {
      expect(hasSpecialChars('hello!')).toBe(true);
      expect(hasSpecialChars('test@#')).toBe(true);
    });

    it('should reject plain text', () => {
      expect(hasSpecialChars('hello')).toBe(false);
      expect(hasSpecialChars('abc123')).toBe(false);
    });
  });

  describe('isValidUsername', () => {
    it('should validate correct usernames', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test-user')).toBe(true);
      expect(isValidUsername('test_user')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false);
      expect(isValidUsername('verylongusernamethatexceedslimit')).toBe(false);
      expect(isValidUsername('user name')).toBe(false);
    });
  });

  describe('isPlainObject', () => {
    it('should identify plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('should reject non-plain objects', () => {
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject('string')).toBe(false);
    });
  });

  describe('isValidJSON', () => {
    it('should validate JSON strings', () => {
      expect(isValidJSON('{"key": "value"}')).toBe(true);
      expect(isValidJSON('[1, 2, 3]')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(isValidJSON('not json')).toBe(false);
      expect(isValidJSON('{invalid}')).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    it('should identify strong passwords', () => {
      expect(isStrongPassword('Password1')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isStrongPassword('weak')).toBe(false);
      expect(isStrongPassword('alllowercase1')).toBe(false);
      expect(isStrongPassword('ALLUPPERCASE1')).toBe(false);
      expect(isStrongPassword('NoNumbers')).toBe(false);
    });
  });

  describe('containsProfanity', () => {
    it('should detect profanity', () => {
      const badWords = ['bad', 'ugly'];
      expect(containsProfanity('This is bad', badWords)).toBe(true);
      expect(containsProfanity('Very ugly text', badWords)).toBe(true);
    });

    it('should return false for clean text', () => {
      const badWords = ['bad', 'ugly'];
      expect(containsProfanity('This is good', badWords)).toBe(false);
    });
  });

  describe('isWhatsAppLink', () => {
    it('should identify WhatsApp group links', () => {
      expect(isWhatsAppLink('https://chat.whatsapp.com/ABC123')).toBe(true);
    });

    it('should reject non-WhatsApp links', () => {
      expect(isWhatsAppLink('https://example.com')).toBe(false);
    });
  });

  describe('isDomainLink', () => {
    it('should validate domain links', () => {
      expect(isDomainLink('https://example.com/page', 'example.com')).toBe(true);
      expect(isDomainLink('https://sub.example.com/page', 'example.com')).toBe(true);
    });

    it('should reject links from other domains', () => {
      expect(isDomainLink('https://other.com/page', 'example.com')).toBe(false);
    });
  });

  describe('validateBetAmount', () => {
    it('should accept valid bet', () => {
      const result = validateBetAmount(100, 1000);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid amount', () => {
      const result = validateBetAmount(0, 1000);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inválido');
    });

    it('should reject below minimum', () => {
      const result = validateBetAmount(5, 1000, { minBet: 10, maxBet: 1000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mínima');
    });

    it('should reject above maximum', () => {
      const result = validateBetAmount(20000, 100000, { minBet: 10, maxBet: 10000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('máxima');
    });

    it('should reject if insufficient funds', () => {
      const result = validateBetAmount(500, 100);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('insuficiente');
    });
  });

  describe('validateTransferAmount', () => {
    it('should accept valid transfer', () => {
      const result = validateTransferAmount(100, 1000, 'recipient@test.com', 'sender@test.com');
      expect(result.valid).toBe(true);
    });

    it('should reject transfer to self', () => {
      const result = validateTransferAmount(100, 1000, 'sender@test.com', 'sender@test.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ti mismo');
    });

    it('should reject below minimum', () => {
      const result = validateTransferAmount(0, 1000, 'recipient@test.com', 'sender@test.com');
      expect(result.valid).toBe(false);
    });

    it('should reject above maximum', () => {
      const result = validateTransferAmount(
        2000000,
        1000000,
        'recipient@test.com',
        'sender@test.com',
      );
      expect(result.valid).toBe(false);
    });

    it('should reject if insufficient funds', () => {
      const result = validateTransferAmount(500, 100, 'recipient@test.com', 'sender@test.com');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateWorkCooldown', () => {
    it('should allow if no previous work', () => {
      const result = validateWorkCooldown(undefined);
      expect(result.allowed).toBe(true);
    });

    it('should allow if cooldown passed', () => {
      const oldWork = Date.now() - 2 * 60 * 60 * 1000;
      const result = validateWorkCooldown(oldWork);
      expect(result.allowed).toBe(true);
    });

    it('should block if on cooldown', () => {
      const recentWork = Date.now() - 30 * 60 * 1000;
      const result = validateWorkCooldown(recentWork, 60 * 60 * 1000);
      expect(result.allowed).toBe(false);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });

  describe('validateDailyCooldown', () => {
    it('should allow if no previous claim', () => {
      const result = validateDailyCooldown(undefined);
      expect(result.allowed).toBe(true);
    });

    it('should allow if 24h passed', () => {
      const oldClaim = Date.now() - 25 * 60 * 60 * 1000;
      const result = validateDailyCooldown(oldClaim);
      expect(result.allowed).toBe(true);
    });

    it('should block if on cooldown', () => {
      const recentClaim = Date.now() - 12 * 60 * 60 * 1000;
      const result = validateDailyCooldown(recentClaim);
      expect(result.allowed).toBe(false);
    });
  });

  describe('sanitizeTextInput', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeTextInput('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should trim whitespace', () => {
      const result = sanitizeTextInput('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should respect max length', () => {
      const longText = 'a'.repeat(1000);
      const result = sanitizeTextInput(longText, 100);
      expect(result.length).toBe(100);
    });
  });
});
