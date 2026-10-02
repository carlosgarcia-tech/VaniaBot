/**
 * LidResolver.ts
 *
 * VaniaBot services module exposing `LidResolver`.
 *
 * @author **Carlos G**
 */

import type { WASocket } from 'baileys';
import { extractPhone } from './JidService.js';
import { logger } from '@/utils/logger.js';

interface LidPhoneCache {
  get(jid: string): string | undefined;
  set(jid: string, phone: string): void;
  delete(jid: string): void;
  clear(): void;
}

export class LidResolver {
  private static lidPhoneCache: LidPhoneCache = new Map<string, string>();

  static async resolve(sock: WASocket, lidJid: string): Promise<string | null> {
    const cached = this.lidPhoneCache.get(lidJid);
    if (cached) return cached;

    try {
      const onWhatsApp = (
        sock as unknown as { onWhatsApp?: (jid: string) => Promise<Array<{ jid?: string }>> }
      ).onWhatsApp;
      if (!onWhatsApp) {
        logger.warn({ context: 'LidResolver', message: 'onWhatsApp no disponible', lidJid });
        return null;
      }

      const result = await onWhatsApp.call(sock, lidJid);

      if (result && result[0]?.jid) {
        const phone = extractPhone(result[0].jid);
        this.lidPhoneCache.set(lidJid, phone);
        return phone;
      }
      logger.warn({ context: 'LidResolver', message: 'No se encontró teléfono para LID', lidJid });
    } catch (error) {
      logger.warn({ context: 'LidResolver', message: 'Error resolviendo LID', lidJid, error });
    }
    return null;
  }

  static clearCache(): void {
    this.lidPhoneCache.clear();
  }

  static invalidate(jid: string): void {
    this.lidPhoneCache.delete(jid);
  }
}
