import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '@/utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;

let encryptionKey: Buffer | null = null;

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

export function encrypt(data: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

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

export function encryptFile(filePath: string, data: string): void {
  const encrypted = encrypt(data);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, encrypted, 'utf8');
}

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

export function isEncryptionEnabled(): boolean {
  return !!process.env.SESSION_ENCRYPTION_KEY;
}
