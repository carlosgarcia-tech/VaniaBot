/**
 * LicenseService.ts
 *
 * Per-group licensing: activation, expiry, renewal and pricing display.
 *
 * Permanent licences never expire; monthly ones carry an `expiresAt`. Validity
 * checks are cached for CACHE_TTL because they run on the hot command path,
 * and `disableExpiredLicenses` is called by CleanupService so an expired group
 * is actually switched off rather than merely reported as invalid.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { GroupService } from '@/services/database/GroupService.js';
import { logger } from '@/utils/logger.js';

export type PlanType = 'permanent' | 'monthly';
export type PaymentType = 'single' | 'subscription';
/** Identifier of the licensed bot: the main session or a sub-bot slot. */
export type BotId = 'main' | `subbot_${number}`;

export interface LicenseInfo {
  planType: PlanType;
  paymentType: PaymentType;
  activatedAt: number;
  /** null for permanent plans. */
  expiresAt: number | null;
  /** When auto-renew is next due; null when not subscribed. */
  renewAt: number | null;
  lastRenewAt: number | null;
  autoRenew: boolean;
  pricePaid: string;
}

export class LicenseService {
  private static instance: LicenseService;
  /** Injected by ServiceManager. */
  private groupService!: GroupService;
  /** Cached verdicts keyed by group, to keep checks off the database path. */
  private licenseCache = new Map<string, { valid: boolean; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  /** Days before expiry at which the owner is warned. */
  private readonly EXPIRY_WARNING_DAYS = 7;

  private constructor() {}

  static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  /** Injects the group service used to read and write licence state. */
  setGroupService(groupService: GroupService): void {
    this.groupService = groupService;
  }

  /**
   * Whether a licence has lapsed.
   * Permanent plans never expire; a monthly plan with no `expiresAt` is treated
   * as expired rather than valid, so malformed data cannot grant access.
   */
  private isExpired(license: LicenseInfo): boolean {
    if (license.planType === 'permanent') return false;
    if (!license.expiresAt) return true;
    return Date.now() > license.expiresAt;
  }

  /**
   * Whole days until expiry.
   * @returns -1 for permanent plans (sentinel for "never expires"), else 0+.
   */
  private getDaysRemaining(license: LicenseInfo): number {
    if (license.planType === 'permanent') return -1;
    if (!license.expiresAt) return 0;
    return Math.max(0, Math.floor((license.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  /**
   * Activates a licence for a group, writing it to the group's settings.
   * @param months Term length for monthly plans; ignored for permanent ones.
   * @returns True when the licence was stored.
   */
  async activateLicense(
    groupJid: string,
    planType: PlanType,
    paymentType: PaymentType,
    pricePaid: string,
    months: number = 1,
  ): Promise<boolean> {
    try {
      const _group = await this.groupService.getGroup(groupJid);
      const now = Date.now();
      const monthMs = 30 * 24 * 60 * 60 * 1000;

      const newLicense: LicenseInfo = {
        planType,
        paymentType,
        activatedAt: now,
        expiresAt: planType === 'monthly' ? now + months * monthMs : null,
        renewAt: planType === 'monthly' ? now + months * monthMs : null,
        lastRenewAt: null,
        autoRenew: false,
        pricePaid,
      };

      await this.groupService.updateGroup(groupJid, {
        license: newLicense,
        isActive: true,
      });

      this.licenseCache.set(groupJid, { valid: true, timestamp: Date.now() });
      logger.info(`[License] Activada para ${groupJid}: ${planType} - $${pricePaid}`);
      return true;
    } catch (error) {
      logger.error('[License] Error activando licencia:', error);
      return false;
    }
  }

  /**
   * Extends a monthly licence by `months` from its current expiry (or from now
   * if it had already lapsed).
   */
  async renewLicense(groupJid: string, months: number = 1, pricePaid?: string): Promise<boolean> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      if (group.license.planType !== 'monthly') {
        logger.warn(`[License] No se puede renovar licencia permanente: ${groupJid}`);
        return false;
      }

      const now = Date.now();
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const currentExpires = group.license.expiresAt || now;
      const newExpires =
        currentExpires < now ? now + months * monthMs : currentExpires + months * monthMs;

      const updatedLicense: LicenseInfo = {
        ...group.license,
        expiresAt: newExpires,
        renewAt: newExpires,
        lastRenewAt: now,
        pricePaid: pricePaid || group.license.pricePaid,
      };

      await this.groupService.updateGroup(groupJid, { license: updatedLicense });
      this.licenseCache.set(groupJid, { valid: true, timestamp: Date.now() });
      logger.info(`[License] Renovada para ${groupJid}: +${months} mes(es)`);
      return true;
    } catch (error) {
      logger.error('[License] Error renovando:', error);
      return false;
    }
  }

  /** Removes the licence entirely, returning the group to unlicensed. */
  async cancelLicense(groupJid: string): Promise<boolean> {
    try {
      await this.groupService.updateGroup(groupJid, { isActive: false });
      this.licenseCache.set(groupJid, { valid: false, timestamp: Date.now() });
      logger.info(`[License] Cancelada para ${groupJid}`);
      return true;
    } catch (error) {
      logger.error('[License] Error cancelando:', error);
      return false;
    }
  }

  /**
   * Whether the group currently holds a valid licence.
   * Served from the short-lived cache when possible; the cache is invalidated on
   * every write so activation and renewal take effect immediately.
   */
  async isLicenseValid(groupJid: string): Promise<boolean> {
    const cached = this.licenseCache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.valid;
    }

    try {
      const group = await this.groupService.getGroup(groupJid);
      const isValid = group.isActive && !this.isExpired(group.license);
      this.licenseCache.set(groupJid, { valid: isValid, timestamp: Date.now() });
      return isValid;
    } catch {
      return false;
    }
  }

  /** Human-readable licence summary for the owner-facing commands. */
  async getLicenseInfo(groupJid: string): Promise<string> {
    try {
      const group = await this.groupService.getGroup(groupJid);
      const lic = group.license;

      const plan = lic.planType === 'permanent' ? '💎 Permanente' : '📅 Mensual';
      const status = this.isExpired(lic)
        ? '❌ VENCIDA'
        : lic.planType === 'permanent'
          ? '✅ Activa'
          : `⏳ ${this.getDaysRemaining(lic)} días restantes`;

      let info = `*Plan:* ${plan}\n*Estado:* ${status}\n*Precio:* $${lic.pricePaid}`;

      if (lic.planType === 'monthly' && lic.lastRenewAt) {
        info += `\n*Última renovación:* ${new Date(lic.lastRenewAt).toLocaleDateString('es-MX')}`;
      }

      return info;
    } catch {
      return '❌ Error al obtener información';
    }
  }

  /**
   * Licences within EXPIRY_WARNING_DAYS of expiring.
   * Used by the owner to surface renewals before access is lost.
   */
  async checkExpiringLicenses(): Promise<{ groupJid: string; daysRemaining: number }[]> {
    const expiring: { groupJid: string; daysRemaining: number }[] = [];

    try {
      const groups = await this.groupService.getAllGroups();
      for (const group of groups) {
        if (!group.license || group.license.planType === 'permanent') continue;
        const days = this.getDaysRemaining(group.license);
        if (days > 0 && days <= this.EXPIRY_WARNING_DAYS) {
          expiring.push({ groupJid: group.jid, daysRemaining: days });
        }
      }
    } catch (error) {
      logger.error('[License] Error verificando licencias por vencer:', error);
    }

    return expiring;
  }

  /**
   * Disables every group whose licence has lapsed.
   * @returns Number of groups switched off.
   */
  async disableExpiredLicenses(): Promise<number> {
    let disabled = 0;
    try {
      const groups = await this.groupService.getAllGroups();
      const expiredGroups = groups.filter(
        group => group.isActive && group.license && this.isExpired(group.license),
      );
      await Promise.all(
        expiredGroups.map(group =>
          this.groupService.updateGroup(group.jid, { isActive: false }).then(() => {
            this.licenseCache.set(group.jid, { valid: false, timestamp: Date.now() });
            logger.info(`[License] Deshabilitada licencia vencida: ${group.jid}`);
            disabled++;
          }),
        ),
      );
    } catch (error) {
      logger.error('[License] Error deshabilitando vencidas:', error);
    }
    return disabled;
  }

  getPlanPrices(): {
    monthly: { 1: number; 3: number; 5: number };
    permanent: { 1: number; 3: number; 5: number };
  } {
    return {
      monthly: { 1: 60, 3: 150, 5: 250 },
      permanent: { 1: 100, 3: 250, 5: 400 },
    };
  }

  formatPricingTable(): string {
    const prices = this.getPlanPrices();
    const usdRate = 20;

    let table = `*💎 LICENCIA PERMANENTE*\n`;
    table += `▸ 1 bot  — $${prices.permanent[1]} MXN / $${Math.round(prices.permanent[1] / usdRate)} USD\n`;
    table += `▸ 3 bots — $${prices.permanent[3]} MXN / $${Math.round(prices.permanent[3] / usdRate)} USD\n`;
    table += `▸ 5 bots — $${prices.permanent[5]} MXN / $${Math.round(prices.permanent[5] / usdRate)} USD ⭐\n\n`;

    table += `*📅 PLAN MENSUAL*\n`;
    table += `▸ 1 bot  — $${prices.monthly[1]} MXN / $${Math.round(prices.monthly[1] / usdRate)} USD\n`;
    table += `▸ 3 bots — $${prices.monthly[3]} MXN / $${Math.round(prices.monthly[3] / usdRate)} USD\n`;
    table += `▸ 5 bots — $${prices.monthly[5]} MXN / $${Math.round(prices.monthly[5] / usdRate)} USD ⭐`;

    return table;
  }
}

export const licenseService = LicenseService.getInstance();
