/**
 * env.test.ts
 *
 * Unit tests for environment configuration validation.
 * Tests Zod schema validation and default values.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const testSchema = z.object({
  BOT_NAME: z.string().default('VaniaBot'),
  BOT_PREFIX: z.string().default('.'),
  OWNERS: z
    .string()
    .default('')
    .transform(val => val.split(',').filter(Boolean)),
  DB_TYPE: z.enum(['json', 'mongodb']).default('json'),
  MAX_RECONNECT_ATTEMPTS: z
    .string()
    .transform(val => parseInt(val) || 10)
    .default('10'),
  AUTO_RECONNECT: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  CACHE_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

describe('Environment Schema Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should use default values when env is empty', () => {
    process.env = {};

    const result = testSchema.parse(process.env);

    expect(result.BOT_NAME).toBe('VaniaBot');
    expect(result.BOT_PREFIX).toBe('.');
    expect(result.DB_TYPE).toBe('json');
    expect(result.MAX_RECONNECT_ATTEMPTS).toBe(10);
    expect(result.AUTO_RECONNECT).toBe(true);
    expect(result.CACHE_ENABLED).toBe(true);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('should override defaults with env values', () => {
    process.env = {
      BOT_NAME: 'CustomBot',
      BOT_PREFIX: '!',
      DB_TYPE: 'mongodb',
      MAX_RECONNECT_ATTEMPTS: '20',
      AUTO_RECONNECT: 'false',
      CACHE_ENABLED: 'false',
      LOG_LEVEL: 'debug',
    };

    const result = testSchema.parse(process.env);

    expect(result.BOT_NAME).toBe('CustomBot');
    expect(result.BOT_PREFIX).toBe('!');
    expect(result.DB_TYPE).toBe('mongodb');
    expect(result.MAX_RECONNECT_ATTEMPTS).toBe(20);
    expect(result.AUTO_RECONNECT).toBe(false);
    expect(result.CACHE_ENABLED).toBe(false);
    expect(result.LOG_LEVEL).toBe('debug');
  });

  it('should transform OWNERS comma-separated string to array', () => {
    process.env = {
      OWNERS: '123456789,987654321,111222333',
    };

    const result = testSchema.parse(process.env);

    expect(result.OWNERS).toEqual(['123456789', '987654321', '111222333']);
  });

  it('should handle empty OWNERS string', () => {
    process.env = {
      OWNERS: '',
    };

    const result = testSchema.parse(process.env);

    expect(result.OWNERS).toEqual([]);
  });

  it('should handle boolean string transformations', () => {
    process.env = {
      AUTO_RECONNECT: 'true',
      CACHE_ENABLED: 'false',
    };

    const result = testSchema.parse(process.env);

    expect(result.AUTO_RECONNECT).toBe(true);
    expect(result.CACHE_ENABLED).toBe(false);
  });

  it('should parse integer values correctly', () => {
    process.env = {
      MAX_RECONNECT_ATTEMPTS: '50',
    };

    const result = testSchema.parse(process.env);

    expect(result.MAX_RECONNECT_ATTEMPTS).toBe(50);
  });

  it('should use default for invalid integer', () => {
    process.env = {
      MAX_RECONNECT_ATTEMPTS: 'invalid',
    };

    const result = testSchema.parse(process.env);

    expect(result.MAX_RECONNECT_ATTEMPTS).toBe(10);
  });

  it('should validate enum values', () => {
    process.env = {
      DB_TYPE: 'mongodb',
      LOG_LEVEL: 'warn',
    };

    const result = testSchema.parse(process.env);

    expect(result.DB_TYPE).toBe('mongodb');
    expect(result.LOG_LEVEL).toBe('warn');
  });

  it('should throw on invalid enum value', () => {
    process.env = {
      DB_TYPE: 'invalid',
    };

    expect(() => testSchema.parse(process.env)).toThrow();
  });

  it('should throw on invalid LOG_LEVEL', () => {
    process.env = {
      LOG_LEVEL: 'invalid',
    };

    expect(() => testSchema.parse(process.env)).toThrow();
  });
});
