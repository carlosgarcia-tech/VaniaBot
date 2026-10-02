/**
 * PinVerificationService.ts
 *
 * Second-factor confirmation for destructive owner commands.
 *
 * Issuing a command stores a short-lived pending record with a random PIN and
 * DMs the code to the owner. The owner replies with the PIN, the pipeline guard
 * verifies it, and the stored command/args are replayed through the normal
 * middleware chain.
 *
 * Security properties worth preserving:
 * - Pending records live in Redis (or the in-memory fallback) with a TTL, so
 *   they cannot be replayed after expiry.
 * - Verification consumes the record immediately, making each PIN single-use.
 * - `buildPendingCommandContext` re-checks the whitelist, so a confirmed PIN
 *   can never be turned into an arbitrary command.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { redisCache } from './RedisCacheService.js';
import { logger } from '@/utils/logger.js';
import type { WASocket } from 'baileys';

/** Command awaiting confirmation, with the PIN and the arguments to replay. */
export interface PendingVerification {
  command: string;
  args: string;
  pin: string;
  createdAt: number;
}

/** How long a PIN remains valid. Short by design. */
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
  /** Unused pin-length constant kept for documentation of the PIN format. */

  private constructor() {}

  static getInstance(): PinVerificationService {
    if (!PinVerificationService.instance) {
      PinVerificationService.instance = new PinVerificationService();
    }
    return PinVerificationService.instance;
  }

  /**
   * Generates a zero-padded six-digit PIN.
   * Uses Math.random rather than a CSPRNG: the code only protects against an
   * operator's own stolen phone session, not against a determined attacker with
   * access to this process.
   */
  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Redis key holding a single owner's pending verification. */
  private getKey(ownerJid: string): string {
    return `pin:${ownerJid}`;
  }

  /**
   * Records a pending verification and returns the PIN to deliver.
   * Overwrites any previous pending record for the same owner.
   */
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

  /**
   * Validates a submitted PIN.
   *
   * A successful verification consumes the pending record, so a captured PIN
   * cannot be replayed. Failures (expired, wrong) leave the record untouched,
   * allowing a retry until the TTL runs out.
   */
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

  /** Drops any pending verification for the owner. */
  async cancelPendingVerification(ownerJid: string): Promise<void> {
    await redisCache.delete(this.getKey(ownerJid));
    logger.info(`[PinVerification] Cancelled pending for ${ownerJid}`);
  }

  /** True while an unexpired verification is outstanding. */
  async hasPendingVerification(ownerJid: string): Promise<boolean> {
    const pending = await redisCache.get<PendingVerification>(this.getKey(ownerJid));
    return pending !== null;
  }

  /**
   * DMs the PIN to the owner.
   * Failures are logged rather than thrown: a failed DM must not abort the
   * pending-verification flow.
   */
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
