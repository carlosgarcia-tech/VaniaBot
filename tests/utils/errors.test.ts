/**
 * errors.test.ts
 *
 * Unit tests for custom error classes.
 * Tests error hierarchy, properties, and serialization.
 *
 * @author **Carlos G** ⭐
 * @github carlosgarcia-tech
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { describe, it, expect } from 'vitest';
import {
  BotError,
  PermissionError,
  ValidationError,
  CommandExecutionError,
  PluginLoadError,
} from '../../src/utils/errors.js';

describe('Custom Errors', () => {
  describe('BotError', () => {
    it('should create error with message', () => {
      const error = new BotError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('BotError');
      expect(error instanceof Error).toBe(true);
    });

    it('should include code and details', () => {
      const error = new BotError('Test error', 'ERROR_CODE', { extra: 'data' });

      expect(error.code).toBe('ERROR_CODE');
      expect(error.details).toEqual({ extra: 'data' });
    });

    it('should capture stack trace', () => {
      const error = new BotError('Test error');

      expect(error.stack).toBeDefined();
    });
  });

  describe('PermissionError', () => {
    it('should have PERMISSION_DENIED code', () => {
      const error = new PermissionError('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.name).toBe('PermissionError');
    });

    it('should include details', () => {
      const error = new PermissionError('No access', { userId: '123' });

      expect(error.details).toEqual({ userId: '123' });
    });
  });

  describe('ValidationError', () => {
    it('should have VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('CommandExecutionError', () => {
    it('should include command name in message', () => {
      const error = new CommandExecutionError('ping', new Error('Command failed'));

      expect(error.commandName).toBe('ping');
      expect(error.message).toContain('ping');
      expect(error.message).toContain('Command failed');
      expect(error.code).toBe('COMMAND_ERROR');
    });

    it('should handle string errors', () => {
      const error = new CommandExecutionError('test', 'String error');

      expect(error.message).toContain('String error');
    });

    it('should handle unknown errors', () => {
      const error = new CommandExecutionError('test', null);

      expect(error.message).toContain('test');
    });

    it('should store original error in details', () => {
      const original = new Error('Original');
      const error = new CommandExecutionError('cmd', original);

      expect(error.details).toBe(original);
    });
  });

  describe('PluginLoadError', () => {
    it('should include plugin path in message', () => {
      const error = new PluginLoadError('./plugins/test', new Error('File not found'));

      expect(error.pluginPath).toBe('./plugins/test');
      expect(error.message).toContain('./plugins/test');
      expect(error.message).toContain('File not found');
      expect(error.code).toBe('PLUGIN_LOAD_ERROR');
    });

    it('should handle string errors', () => {
      const error = new PluginLoadError('test.js', 'Module not found');

      expect(error.message).toContain('Module not found');
    });
  });

  describe('Error hierarchy', () => {
    it('PermissionError should extend BotError', () => {
      const error = new PermissionError('test');

      expect(error).toBeInstanceOf(BotError);
      expect(error).toBeInstanceOf(Error);
    });

    it('ValidationError should extend BotError', () => {
      const error = new ValidationError('test');

      expect(error).toBeInstanceOf(BotError);
      expect(error).toBeInstanceOf(Error);
    });

    it('CommandExecutionError should extend BotError', () => {
      const error = new CommandExecutionError('cmd', new Error());

      expect(error).toBeInstanceOf(BotError);
      expect(error).toBeInstanceOf(Error);
    });

    it('PluginLoadError should extend BotError', () => {
      const error = new PluginLoadError('path', new Error());

      expect(error).toBeInstanceOf(BotError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
