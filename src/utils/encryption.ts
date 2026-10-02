/**
 * encryption.ts
 *
 * AES-256-GCM encryption for persisted sub-bot session files.
 *
 * GCM is used rather than CBC because it authenticates the ciphertext: a
 * tampered session file fails to decrypt instead of silently yielding garbage
 * credentials. The output format is `iv:authTag:ciphertext`, all hex.
 *
 * The key is derived once with scrypt from SESSION_ENCRYPTION_KEY (first half
 * salt, second half password) and cached for the process lifetime.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '@/utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

/** Derived key cache; deriving it per call would be needlessly expensive. */
let encryptionKey: Buffer | null = null;

/**
 * Derives (once) the 32-byte encryption key.
 *
 * When SESSION_ENCRYPTION_KEY is unset it falls back to an all-zero key and
 * warns, so the bot still runs unencrypted rather than failing to start.
 */
function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;

  const envKey = process.env.SESSION_ENCRYPTION_KEY;
  if (!envKey) {
    logger.warn('SESSION_ENCRYPTION_KEY not set, sessions will not be encrypted');
    return Buffer.alloc(32, '0');
  }

  const salt = envKey.slice(0, SALT_LENGTH);
  const password = envKey.slice(SALT_LENGTH);
  encryptionKey = scryptSync(password, salt, 32);
  return encryptionKey;
}

/**
 * Encrypts a string.
 * @returns `iv:authTag:ciphertext`, all hex-encoded.
 */
export function encrypt(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string produced by `encrypt`.
 * @throws If the format is malformed or the auth tag does not verify.
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

  // The ciphertext segment may legitimately be empty (encrypting an empty
  // string), so only reject when segments are actually missing.
  if (ivHex === undefined || authTagHex === undefined || encrypted === undefined) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/** Encrypts `data` and writes it to `filePath`, creating parent directories. */
export function encryptFile(filePath: string, data: string): void {
  const encrypted = encrypt(data);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, encrypted, 'utf8');
}

/**
 * Reads and decrypts a file written by `encryptFile`.
 *
 * Legacy plaintext files (no `iv:tag:data` separators) are returned as-is so
 * sessions encrypted before this feature keep working.
 *
 * @returns Decrypted contents, or null when the file is missing or undecryptable.
 */
export function decryptFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  const encrypted = readFileSync(filePath, 'utf8');
  if (!encrypted.includes(':')) {
    return encrypted;
  }

  try {
    return decrypt(encrypted);
  } catch (error) {
    logger.error(`Failed to decrypt file ${filePath}:`, error);
    return null;
  }
}

/** True when a real encryption key is configured. */
export function isEncryptionEnabled(): boolean {
  return !!process.env.SESSION_ENCRYPTION_KEY;
}
