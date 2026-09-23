import {
  useMultiFileAuthState,
  type AuthenticationState,
  type AuthenticationCreds,
  type SignalDataTypeMap,
  type SignalKeyStore,
} from 'baileys';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { encrypt, decrypt, isEncryptionEnabled } from '@/utils/encryption.js';
import { logger } from '@/utils/logger.js';
import { createCacheableKeyStore } from '@/core/WASocketFactory.js';

interface AuthResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}

function encryptData(data: string): string {
  if (!isEncryptionEnabled()) return data;
  return encrypt(data);
}

function decryptData(data: string): string {
  if (!isEncryptionEnabled()) return data;
  try {
    return decrypt(data);
  } catch {
    return data;
  }
}

async function useEncryptedAuthState(sessionPath: string): Promise<AuthResult> {
  mkdirSync(sessionPath, { recursive: true });

  const credsFile = join(sessionPath, 'creds.json');
  let credsContent: string;

  if (existsSync(credsFile)) {
    credsContent = decryptData(readFileSync(credsFile, 'utf8'));
  } else {
    credsContent = '{}';
  }

  const keysData: Record<string, Record<string, string>> = {};
  const keyFiles = readdirSync(sessionPath).filter(f => f.endsWith('.json') && f !== 'creds.json');

  for (const keyFile of keyFiles) {
    const filePath = join(sessionPath, keyFile);
    const keyType = keyFile.replace('.json', '');
    try {
      const content = decryptData(readFileSync(filePath, 'utf8'));
      keysData[keyType] = JSON.parse(content);
    } catch {
      keysData[keyType] = {};
    }
  }

  const state: AuthenticationState = {
    creds: JSON.parse(credsContent) as AuthenticationCreds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {} as {
          [id: string]: SignalDataTypeMap[T];
        };
        const keyData = keysData[type] || {};

        for (const id of ids) {
          if (keyData[id]) {
            try {
              result[id] = JSON.parse(keyData[id]);
            } catch {
              result[id] = keyData[id] as unknown as SignalDataTypeMap[T];
            }
          }
        }

        return result;
      },
      set: async data => {
        for (const [type, pairs] of Object.entries(data)) {
          const keyData = keysData[type] || {};

          for (const [id, value] of Object.entries(pairs)) {
            keyData[id] = typeof value === 'string' ? value : JSON.stringify(value);
          }

          keysData[type] = keyData;
          const filePath = join(sessionPath, `${type}.json`);
          writeFileSync(filePath, encryptData(JSON.stringify(keyData)), 'utf8');
        }
      },
    },
  };

  const saveCreds = async () => {
    try {
      writeFileSync(credsFile, encryptData(JSON.stringify(state.creds)), 'utf8');
    } catch (error) {
      logger.error('Failed to save encrypted creds:', error);
    }
  };

  return { state, saveCreds };
}

export async function useEncryptedMultiFileAuthState(sessionPath: string): Promise<AuthResult> {
  if (!isEncryptionEnabled()) {
    logger.info(`[Auth] Encryption disabled, using standard storage`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    return { state, saveCreds };
  }

  logger.info(`[Auth] Using encrypted storage for ${sessionPath}`);
  const result = await useEncryptedAuthState(sessionPath);

  const cacheableKeys = createCacheableKeyStore(result.state.keys);

  return {
    state: {
      creds: result.state.creds,
      keys: cacheableKeys as SignalKeyStore,
    },
    saveCreds: result.saveCreds,
  };
}

export function clearSession(sessionPath: string): void {
  try {
    if (existsSync(sessionPath)) {
      for (const file of readdirSync(sessionPath)) {
        try {
          unlinkSync(join(sessionPath, file));
        } catch {}
      }
    }
  } catch {}
}
