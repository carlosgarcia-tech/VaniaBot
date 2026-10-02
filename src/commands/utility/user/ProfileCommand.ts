/**
 * ProfileCommand.ts
 *
 * utility command `profile` — Show user profile
 * Usage: !profile [@user]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber, formatTime } from '@/utils/helpers.js';
import type { User } from '@/services/database/UserService.js';
import { findAssetFile } from '@/utils/assetHelper.js';
import { ProfileCardService } from '@services/canvas/ProfileCardService.js';

interface LevelProgress {
  currentXP: number;
  requiredXP: number;
  percentage: number;
}
interface ClientStats {
  messagesReceived: number;
  commandsExecuted: number;
  messagesProcessed: number;
  avgProcessingTime?: number;
  queue?: {
    queued: number;
    processing: number;
  };
}
/** Command handler for `!profile`: Show user profile. */
export class ProfileCommand extends Command {
  name = 'profile';
  description = 'Show user profile';
  category = CommandCategory.UTILITY;
  requiresRegistration = true;
  aliases = ['perfil', 'me'];
  usage = '!profile [@user]';
  examples = ['!profile', '!profile @user', '!me'];
  private static logoBuffer: Buffer | null = null;
  private static logoLoaded = false;
  async execute(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const targetJid = mentionedJid || ctx.sender.jid;
    const isSelf = targetJid === ctx.sender.jid;
    try {
      const botJid = ctx.sock.user?.id;
      const isBotProfile = this.isBotJid(targetJid, botJid);
      if (isBotProfile) {
        await this.sendBotProfile(ctx);
        return;
      }
      const [userData, progress] = await Promise.all([
        serviceManager.userService.getUser(targetJid),
        serviceManager.levelService.getLevelProgress(targetJid),
      ]);
      const displayData = this.prepareDisplayData(userData);
      const message = this.buildProfileCard(userData, displayData, progress, isSelf);
      await this.sendProfileWithImage(ctx, targetJid, message, displayData, progress);
    } catch (error) {
      logError('[ProfileCommand] Error', error);
      await ctx.reply('❌ Error retrieving profile');
    }
  }
  private isBotJid(targetJid: string, botJid?: string): boolean {
    if (!botJid) return false;
    const targetNumber = targetJid.split('@')[0].split(':')[0];
    const botNumber = botJid.split('@')[0].split(':')[0];
    return targetNumber === botNumber;
  }
  private async sendBotProfile(ctx: MessageContext): Promise<void> {
    const uptime = this.formatUptime(process.uptime() * 1000);
    const client = (global as { client?: { getStats: () => ClientStats } }).client;
    const stats = client?.getStats() || {
      messagesReceived: 0,
      commandsExecuted: 0,
      messagesProcessed: 0,
    };

    const message = `
┌───────────────────┐
│   ✦ VANIA BOT ✦    │
└───────────────────┘

◈ INFO
   • name: ${ctx.sock.user?.name || 'VaniaBot'}
   • status: online
   • uptime: ${uptime}

◈ STATISTICS
   • messages: ${formatNumber(stats.messagesReceived)}
   • commands: ${formatNumber(stats.commandsExecuted)}
   • processed: ${formatNumber(stats.messagesProcessed)}

◈ PERFORMANCE
   • avg time: ${stats.avgProcessingTime?.toFixed(0) || 0}ms
   • queue: ${stats.queue?.queued || 0}

◈ FEATURES
   • economy
   • games
   • moderation
   • levels

┌─────────────────────┐
│   !help for commands │
└─────────────────────┘
`.trim();
    const logoBuffer = this.getDefaultProfile();
    if (logoBuffer) {
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: logoBuffer,
        caption: message,
      });
    } else {
      await ctx.reply(message);
    }
  }

  private formatUptime(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Resolves the WhatsApp profile picture URL for a JID.
   * Returns null if unavailable (private account, timeout, etc.).
   */
  private async getProfilePictureUrl(
    ctx: MessageContext,
    targetJid: string,
  ): Promise<string | null> {
    try {
      let normalizedJid = targetJid;
      if (targetJid.includes('@lid')) {
        const phoneNumber = targetJid.split('@')[0];
        normalizedJid = `${phoneNumber}@s.whatsapp.net`;
      }

      const url = await ctx.sock.profilePictureUrl(normalizedJid, 'image');
      return url ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Builds the profile card image via ProfileCardService and sends it.
   * Falls back to plain text reply if card generation fails entirely.
   */
  private async sendProfileWithImage(
    ctx: MessageContext,
    targetJid: string,
    message: string,
    displayData: User,
    progress: LevelProgress,
  ): Promise<void> {
    try {
      const avatarUrl = await Promise.race([
        this.getProfilePictureUrl(ctx, targetJid),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 2000)),
      ]);

      let resolvedAvatarUrl: string;
      if (avatarUrl) {
        resolvedAvatarUrl = avatarUrl;
      } else {
        const fallback = this.getDefaultProfile();
        resolvedAvatarUrl = fallback ? `data:image/png;base64,${fallback.toString('base64')}` : '';
      }

      const cardBuffer = await ProfileCardService.generate({
        avatarUrl: resolvedAvatarUrl,
        username: displayData.name,
        discriminator: targetJid.split('@')[0].slice(-4),
        money: displayData.money,
        xp: progress.currentXP,
        level: displayData.level,
        levelProgress: progress.percentage,
      });

      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: cardBuffer,
        caption: message,
      });
    } catch (error) {
      logError('[ProfileCommand] Card generation failed, falling back to text', error);
      await ctx.reply(message);
    }
  }

  private getDefaultProfile(): Buffer | null {
    if (ProfileCommand.logoLoaded) return ProfileCommand.logoBuffer;

    try {
      const logoBuffer = findAssetFile('profileDefault.png');
      if (logoBuffer) {
        ProfileCommand.logoBuffer = logoBuffer;
        ProfileCommand.logoLoaded = true;
        return ProfileCommand.logoBuffer;
      }
    } catch (error) {
      logError('[ProfileCommand] Could not load default profile logo', error);
    }

    ProfileCommand.logoLoaded = true;
    return null;
  }

  private prepareDisplayData(userData: User): User {
    if (userData.isOwner) {
      return {
        ...userData,
        level: 999,
        xp: 999999,
        money: 999999999,
        warnings: 0,
      };
    }
    return userData;
  }

  private buildProfileCard(
    userData: User,
    displayData: User,
    progress: LevelProgress,
    isSelf: boolean,
  ): string {
    const progressBar = userData.isOwner
      ? '▰'.repeat(10)
      : this.createProgressBar(progress.currentXP, progress.requiredXP, 10);

    const registeredTime = this.getTimeSince(userData.createdAt);
    const canDaily = serviceManager.userService.canClaimDaily(userData);
    const canWeekly = serviceManager.userService.canClaimWeekly(userData);
    const canMonthly = serviceManager.userService.canClaimMonthly(userData);

    let dailyInfo = '';
    if (!canDaily && !userData.isOwner) {
      const remaining = serviceManager.userService.getDailyTimeRemaining(userData);
      if (remaining > 0) dailyInfo = ` (${formatTime(remaining)})`;
    }

    const xpDisplay = userData.isOwner
      ? '∞'
      : `${formatNumber(progress.currentXP)} / ${formatNumber(progress.requiredXP)}`;

    const percentageDisplay = userData.isOwner ? '100%' : `${progress.percentage}%`;

    const userBadges = this.getUserBadges(userData);

    let card = `┌───────────┐
│      ✦ PROFILE ✦              │
└───────────┘

◈ ${userData.name}${userBadges}`;

    if (userData.isBanned) {
      card += `\n   status: banned\n`;
    } else {
      card += `
   role: ${this.getUserRole(displayData)}
   member: ${registeredTime}`;
    }

    const rpgStats = userData.stats || { hp: 100, maxHp: 100, atk: 10, def: 5 };

    card += `

◈ LEVEL ${displayData.level}
   ${progressBar} ${percentageDisplay}
   XP: ${xpDisplay}

◈ RPG
   HP: ${rpgStats.hp}/${rpgStats.maxHp}
   ATK: ${rpgStats.atk} | DEF: ${rpgStats.def}

◈ ECONOMY
   money: $${formatNumber(displayData.money)}
   items: ${displayData.inventory?.length || 0}
   achievements: ${displayData.achievements?.length || 0}
   class: ${userData.currentClass || 'none'}
◈ ACTIVE BUFFS${this.formatActiveBuffs(userData)}
◈ STATS
   commands: ${formatNumber(displayData.totalCommands)}
   warns: ${displayData.warnings}/3
   active: ${this.getTimeSince(userData.updatedAt)}`;
    if (userData.isOwner) {
      card += `
◈ REWARDS
   daily: unlimited
   weekly: unlimited
   monthly: unlimited
┌────────┐
│   ✦ OWNER ✦       │
└────────┘`;
    } else {
      card += `
◈ REWARDS
   daily: ${canDaily ? '✓' : '✗'}${dailyInfo}
   weekly: ${canWeekly ? '✓' : '✗'}
   monthly: ${canMonthly ? '✓' : '✗'}`;
      if (isSelf) {
        card += `
┌─────────────────────┐
│   !daily / !weekly  │
│   !monthly to claim │
└─────────────────────┘`;
      }
    }
    return card.trim();
  }
  private createProgressBar(current: number, total: number, length: number = 10): string {
    if (total <= 0 || current < 0) return '▰'.repeat(length);
    const percentage = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.floor(percentage * length);
    const empty = Math.max(0, length - filled);
    return '▰'.repeat(filled) + '▱'.repeat(empty);
  }
  private getUserRole(user: User): string {
    if (user.isOwner) return 'owner';
    if (user.isBanned) return 'banned';
    if (user.level >= 100) return 'legend';
    if (user.level >= 50) return 'veteran';
    if (user.level >= 25) return 'expert';
    if (user.level >= 10) return 'intermediate';
    return 'novice';
  }
  private getTimeSince(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months}m`;
    }
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'now';
  }
  private getUserBadges(user: User): string {
    const badges: string[] = [];
    if (user.isOwner) badges.push('👑 Owner');
    const allBuffs = user.activeBuffs || [];
    const activeBuffs = allBuffs.filter(b => b.expiresAt === 0 || b.expiresAt > Date.now());
    if (activeBuffs.some(b => b.buffId === 'vip_role')) badges.push('👑 VIP');
    if (activeBuffs.some(b => b.buffId === 'legend_role')) badges.push('💎 Legend');
    if (activeBuffs.some(b => b.buffId === 'premium_pass')) badges.push('💎 VIP Pass');
    if (activeBuffs.some(b => b.buffId === 'badge_rich')) badges.push('🤑 Rich');
    if (activeBuffs.some(b => b.buffId === 'badge_lucky')) badges.push('🍀 Lucky');
    if (activeBuffs.some(b => b.buffId === 'badge_pro')) badges.push('🏆 Pro');
    if (user.level >= 100) badges.push('⭐ Leyenda');
    else if (user.level >= 50) badges.push('🔥 Veterano');
    if (badges.length === 0) return '';
    return '\n   ' + badges.join(' • ');
  }
  private formatActiveBuffs(user: User): string {
    const buffs = user.activeBuffs?.filter(b => b.expiresAt > Date.now()) || [];
    if (buffs.length === 0) {
      return '\n   none';
    }
    const buffEmojis: Record<string, string> = {
      vip_role: '👑',
      legend_role: '💎',
      daily_bonus: '📈',
      xp_boost: '✨',
      lucky_charm: '🍀',
      income_boost: '💰',
      cooldown_bypass: '⚡',
      premium_pass: '💎',
      bank_interest: '🏦',
      badge_rich: '🤑',
      badge_lucky: '🍀',
      badge_pro: '🏆',
    };
    const buffNames: Record<string, string> = {
      vip_role: 'VIP',
      legend_role: 'Legend',
      daily_bonus: 'Daily+',
      xp_boost: 'XP x2',
      lucky_charm: 'Luck+',
      income_boost: 'Income+',
      cooldown_bypass: 'CD-50%',
      premium_pass: 'VIP Pass',
      bank_interest: 'Bank+',
      badge_rich: 'Rich',
      badge_lucky: 'Lucky',
      badge_pro: 'Pro',
    };
    let buffText = '';
    for (const buff of buffs) {
      const emoji = buffEmojis[buff.buffId] || '🎁';
      const name = buffNames[buff.buffId] || buff.buffId;
      let duration = '';
      if (buff.expiresAt === 0) {
        duration = ' ∞';
      } else if (buff.expiresAt > Date.now()) {
        const remaining = buff.expiresAt - Date.now();
        if (remaining > 24 * 60 * 60 * 1000) {
          duration = ` (${Math.floor(remaining / (24 * 60 * 60 * 1000))}d)`;
        } else if (remaining > 60 * 60 * 1000) {
          duration = ` (${Math.floor(remaining / (60 * 60 * 1000))}h)`;
        } else if (remaining > 0) {
          duration = ` (${Math.floor(remaining / (60 * 1000))}m)`;
        }
      }
      buffText += `\n   ${emoji} ${name}${duration}`;
    }
    return buffText;
  }
}
