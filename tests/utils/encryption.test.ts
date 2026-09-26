/**
 * encryption.test.ts
 *
 * Unit tests for AES-256-GCM session encryption helpers.
 * Covers round-trip, tampering detection, format validation,
 * and file encrypt/decrypt behavior.
 *
 * @author **Carlos G** ⭐
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('@/utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { encrypt, decrypt, encryptFile, decryptFile, isEncryptionEnabled } from '../../src/utils/encryption.js';

const TEST_KEY =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // 32 salt + 32 password chars

describe('encryption', () => {
  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEY = TEST_KEY;
    // Reset the cached key between key configurations.
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.SESSION_ENCRYPTION_KEY;
  });

  describe('encrypt/decrypt round-trip', () => {
    it('decrypts what encrypt produces', () => {
      const plaintext = '{"creds":{"noiseKey":"abc"}}';
      const cipher = encrypt(plaintext);
      expect(decrypt(cipher)).toBe(plaintext);
    });

    it('handles empty strings', () => {
      expect(decrypt(encrypt(''))).toBe('');
    });

    it('handles unicode content', () => {
      const text = 'ñandú 🦋 日本語';
      expect(decrypt(encrypt(text))).toBe(text);
    });

    it('handles large payloads', () => {
      const text = 'x'.repeat(100_000);
      expect(decrypt(encrypt(text))).toBe(text);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', () => {
      const a = encrypt('same text');
      const b = encrypt('same text');
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe('same text');
      expect(decrypt(b)).toBe('same text');
    });

    it('outputs iv:authTag:ciphertext hex format', () => {
      const cipher = encrypt('test');
      const parts = cipher.split(':');
      expect(parts).toHaveLength(3);
      for (const part of parts) {
        expect(part).toMatch(/^[0-9a-f]+$/);
      }
      // 16-byte IV and 16-byte GCM auth tag = 32 hex chars each.
      expect(parts[0]).toHaveLength(32);
      expect(parts[1]).toHaveLength(32);
    });
  });

  describe('decrypt validation', () => {
    it('throws on malformed data (missing segments)', () => {
      expect(() => decrypt('not-encrypted')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('ivonly:tagonly')).toThrow('Invalid encrypted data format');
    });

    it('throws when the auth tag does not match (tampering)', () => {
      const cipher = encrypt('sensitive');
      const [iv, , payload] = cipher.split(':');
      const tampered = `${iv}:${'0'.repeat(32)}:${payload}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when ciphertext is modified', () => {
      const cipher = encrypt('sensitive');
      const [iv, tag] = cipher.split(':');
      const tampered = `${iv}:${tag}:deadbeef`;
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('isEncryptionEnabled', () => {
    it('returns true when the key is set', () => {
      process.env.SESSION_ENCRYPTION_KEY = TEST_KEY;
      expect(isEncryptionEnabled()).toBe(true);
    });

    it('returns false when the key is missing', () => {
      delete process.env.SESSION_ENCRYPTION_KEY;
      expect(isEncryptionEnabled()).toBe(false);
    });
  });

  describe('file helpers', () => {
    let tempDir: string;
    let filePath: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'vania-enc-test-'));
      filePath = join(tempDir, 'nested', 'creds.json');
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('encrypts to file and decrypts back, creating parent dirs', () => {
      const data = '{"secret": true}';
      encryptFile(filePath, data);
      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath, 'utf8')).not.toContain('secret');
      expect(decryptFile(filePath)).toBe(data);
    });

    it('returns null for missing files', () => {
      expect(decryptFile(join(tempDir, 'nope.json'))).toBeNull();
    });

    it('returns plaintext content unchanged for unencrypted files', () => {
      const plainPath = join(tempDir, 'plain.json');
      writeFileSync(plainPath, 'raw-plaintext', 'utf8');
      expect(decryptFile(plainPath)).toBe('raw-plaintext');
    });

    it('returns null when decryption fails on a corrupted encrypted file', () => {
      encryptFile(filePath, 'data');
      writeFileSync(filePath, 'aa:bb:cc', 'utf8'); // valid format, invalid content
      expect(decryptFile(filePath)).toBeNull();
    });
  });
});
