/**
 * helpers.test.ts
 *
 * Unit tests for utility helper functions.
 * Tests formatting, parsing, array manipulation, and utility functions.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatNumber,
  formatTime,
  capitalize,
  truncate,
  sleep,
  randomElement,
  randomInt,
  shuffle,
  groupBy,
  unique,
  chunk,
  extractMentions,
  sanitize,
  parseKeyValueArgs,
  formatBytes,
  isValidUrl,
  stripMarkdown,
  createProgressBar,
  secondsToHMS,
  parseDuration,
} from '../../src/utils/helpers.js';

describe('Helpers', () => {
  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(100)).toBe('100');
    });
  });

  describe('formatTime', () => {
    it('should format milliseconds to human readable time', () => {
      expect(formatTime(1000)).toBe('1s');
      expect(formatTime(60000)).toBe('1m 0s');
      expect(formatTime(3600000)).toBe('1h 0m');
      expect(formatTime(86400000)).toBe('1d 0h');
    });

    it('should format complex durations', () => {
      expect(formatTime(90000)).toBe('1m 30s');
      expect(formatTime(9000000)).toBe('2h 30m');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('h')).toBe('H');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should use custom suffix', () => {
      expect(truncate('hello world', 8, '>>>')).toBe('hello>>>');
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('randomElement', () => {
    it('should return random element from array', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = randomElement(arr);
      expect(arr).toContain(result);
    });
  });

  describe('randomInt', () => {
    it('should return integer in range', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      expect(randomInt(1, 10)).toBe(6);
      expect(randomInt(1, 10)).toBeGreaterThanOrEqual(1);
      expect(randomInt(1, 10)).toBeLessThanOrEqual(10);
    });
  });

  describe('shuffle', () => {
    it('should shuffle array', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled).toHaveLength(5);
      expect(shuffled.sort()).toEqual(arr);
    });

    it('should not mutate original array', () => {
      const arr = [1, 2, 3];
      const original = [...arr];
      shuffle(arr);
      expect(arr).toEqual(original);
    });
  });

  describe('groupBy', () => {
    it('should group objects by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const grouped = groupBy(items, 'type');
      expect(grouped.a).toHaveLength(2);
      expect(grouped.b).toHaveLength(1);
    });
  });

  describe('unique', () => {
    it('should return unique elements', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunk([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    });

    it('should handle array smaller than chunk size', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });
  });

  describe('extractMentions', () => {
    it('should extract WhatsApp mentions', () => {
      expect(extractMentions('Hello @123456789')).toEqual(['123456789@s.whatsapp.net']);
      expect(extractMentions('No mentions')).toEqual([]);
      expect(extractMentions('@111 @222')).toEqual(['111@s.whatsapp.net', '222@s.whatsapp.net']);
    });
  });

  describe('sanitize', () => {
    it('should remove special characters', () => {
      expect(sanitize('hello!@#$%')).toBe('hello');
      expect(sanitize('test 123')).toBe('test 123');
    });
  });

  describe('parseKeyValueArgs', () => {
    it('should parse key=value arguments', () => {
      const result = parseKeyValueArgs(['key=value', 'foo=bar', 'plain']);
      expect(result).toEqual({ key: 'value', foo: 'bar' });
    });
  });

  describe('formatBytes', () => {
    it('should format bytes to human readable', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
    });
  });

  describe('isValidUrl', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org')).toBe(true);
      expect(isValidUrl('not a url')).toBe(false);
    });
  });

  describe('stripMarkdown', () => {
    it('should remove markdown formatting', () => {
      expect(stripMarkdown('**bold**')).toBe('bold');
      expect(stripMarkdown('*italic*')).toBe('italic');
      expect(stripMarkdown('~~strikethrough~~')).toBe('strikethrough');
      expect(stripMarkdown('`code`')).toBe('code');
      expect(stripMarkdown('[link](url)')).toBe('link');
    });

    it('should handle code blocks', () => {
      expect(stripMarkdown('```js\ncode\n```').length).toBeLessThan(20);
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar', () => {
      expect(createProgressBar(50, 100, 10)).toBe('█████░░░░░');
      expect(createProgressBar(0, 100, 10)).toBe('░░░░░░░░░░');
      expect(createProgressBar(100, 100, 10)).toBe('██████████');
    });

    it('should use custom characters', () => {
      const bar = createProgressBar(50, 100, 10, '=', '-');
      expect(bar).toBe('=====-----');
    });
  });

  describe('secondsToHMS', () => {
    it('should convert seconds to HH:MM:SS', () => {
      expect(secondsToHMS(0)).toBe('00:00:00');
      expect(secondsToHMS(60)).toBe('00:01:00');
      expect(secondsToHMS(3661)).toBe('01:01:01');
      expect(secondsToHMS(86399)).toBe('23:59:59');
    });
  });

  describe('parseDuration', () => {
    it('should parse duration strings', () => {
      expect(parseDuration('5s')).toBe(5000);
      expect(parseDuration('5m')).toBe(300000);
      expect(parseDuration('5h')).toBe(18000000);
      expect(parseDuration('5d')).toBe(432000000);
    });

    it('should return 0 for invalid format', () => {
      expect(parseDuration('invalid')).toBe(0);
      expect(parseDuration('5x')).toBe(0);
    });
  });
});
