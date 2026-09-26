import { redisCache } from './RedisCacheService.js';
import { logger } from '@/utils/logger.js';
import type { WASocket } from 'baileys';

export interface PendingVerification {
  command: string;
  args: string;
  pin: string;
  createdAt: number;
}

const PIN_TTL_SECONDS = 60;
const _PIN_LENGTH = 6;

/** Commands that may be executed through PIN confirmation. */
export const PIN_ALLOWED_COMMANDS: readonly string[] = [
  'eval',
  'exec',
  'grant',
  'setowner',
  'restart',
];

export class PinVerificationService {
  private static instance: PinVerificationService;

  private constructor() {}

  static getInstance(): PinVerificationService {
    if (!PinVerificationService.instance) {
      PinVerificationService.instance = new PinVerificationService();
    }
    return PinVerificationService.instance;
  }

  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getKey(ownerJid: string): string {
    return `pin:${ownerJid}`;
  }

  async createPendingVerification(
    ownerJid: string,
    command: string,
    args: string,
  ): Promise<string> {
    const pin = this.generatePin();
    const pending: PendingVerification = {
      command,
      args,
      pin,
      createdAt: Date.now(),
    };

    await redisCache.set(this.getKey(ownerJid), pending, PIN_TTL_SECONDS);

    logger.info(`[PinVerification] Created pending for ${ownerJid}, command: ${command}`);

    return pin;
  }

  async verifyPin(
    ownerJid: string,
    pin: string,
  ): Promise<{ valid: boolean; command?: string; args?: string }> {
    const key = this.getKey(ownerJid);
    const pending = await redisCache.get<PendingVerification>(key);

    if (!pending) {
      logger.info(`[PinVerification] No pending verification for ${ownerJid}`);
      return { valid: false };
    }

    if (pending.pin !== pin) {
      logger.warn(`[PinVerification] Invalid PIN for ${ownerJid}`);
      return { valid: false };
    }

    await this.cancelPendingVerification(ownerJid);

    logger.info(
      `[PinVerification] PIN verified successfully for ${ownerJid}, command: ${pending.command}`,
    );

    return {
      valid: true,
      command: pending.command,
      args: pending.args,
    };
  }

  /**
   * Validates a PIN-confirmed command and splits its stored args. Returns
   * null for commands outside the PIN whitelist — the confirmation flow must
   * never become a way to execute arbitrary registry entries.
   */
  buildPendingCommandContext(
    command: string,
    args: string,
  ): { command: string; args: string[] } | null {
    const normalized = command.toLowerCase();
    if (!PIN_ALLOWED_COMMANDS.includes(normalized)) return null;
    return { command: normalized, args: args.split(/\s+/).filter(arg => arg.length > 0) };
  }

  async cancelPendingVerification(ownerJid: string): Promise<void> {
    await redisCache.delete(this.getKey(ownerJid));
    logger.info(`[PinVerification] Cancelled pending for ${ownerJid}`);
  }

  async hasPendingVerification(ownerJid: string): Promise<boolean> {
    const pending = await redisCache.get<PendingVerification>(this.getKey(ownerJid));
    return pending !== null;
  }

  async sendPinDm(ownerJid: string, pin: string, command: string, sock: WASocket): Promise<void> {
    try {
      const message =
        `🔐 *PIN de verificación*\n\n` +
        `*Código:* ${pin}\n` +
        `*Expira en:* ${PIN_TTL_SECONDS} segundos\n\n` +
        `Responde con el código para confirmar el comando *${command}*.`;

      await sock.sendMessage(ownerJid, { text: message });
    } catch (error) {
      logger.error('[PinVerification] Failed to send PIN DM', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }
}

export const pinVerificationService = PinVerificationService.getInstance();
