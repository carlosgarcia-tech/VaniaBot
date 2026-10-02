/**
 * AntispamCommand.ts
 *
 * Command to manage rate limiting and anti-spam settings.
 * Allows admins to view stats, whitelist users/groups, and reset limits.
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { rateLimitService } from '@/services/system/RateLimitService.js';
import { config } from '@/config/index.js';

export class AntispamCommand extends Command {
  name = 'antispam';
  description = 'Manage anti-spam and rate limiting settings';
  category = CommandCategory.ADMIN;
  aliases = ['ratelimit', 'spam'];
  usage = '!antispam <on|off|stats|whitelist|reset> [user|group]';
  examples = ['!antispam stats', '!antispam whitelist add @user', '!antispam reset group'];
  cooldown = 3000;

  permissions = {
    user: [PermissionLevel.ADMIN],
    bot: [],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const subcommand = ctx.args[0]?.toLowerCase();
    const action = ctx.args[1]?.toLowerCase();
    const target = ctx.args[2];

    if (!subcommand || subcommand === 'stats') {
      await this.showStats(ctx);
      return;
    }

    if (subcommand === 'whitelist') {
      await this.handleWhitelist(ctx, action, target);
      return;
    }

    if (subcommand === 'reset') {
      await this.handleReset(ctx, action, target);
      return;
    }

    if (subcommand === 'config') {
      await this.showConfig(ctx);
      return;
    }

    await ctx.reply(
      `*: ̗̀➛ anti-spam ̖́-*\n\n` +
        `✿ stats ﹒ver estadísticas\n` +
        `✿ whitelist ﹒gestionar lista blanca\n` +
        `✿ reset ﹒reiniciar contadores\n` +
        `✿ config ﹒ver configuración\n\n` +
        `*๑ ˖ ejemplo ˖ ๑* \`!antispam stats\``,
    );
  }

  private async showStats(ctx: MessageContext): Promise<void> {
    const stats = rateLimitService.getStats();

    let message = `*ANTI-SPAM STATS*\n\n`;
    message += `📊 *Grupos rastreados:* ${stats.trackedGroups}\n`;
    message += `👤 *Usuarios rastreados:* ${stats.trackedUsers}\n`;
    message += `✅ *Grupos whitelist:* ${stats.whitelistGroups}\n`;
    message += `✅ *Usuarios whitelist:* ${stats.whitelistUsers}\n\n`;

    if (ctx.chat.isGroup) {
      const groupStats = rateLimitService.getGroupStats(ctx.chat.jid);
      message += `📌 *Este grupo:*\n`;
      message += `   Mensajes: ${groupStats.messageCount}/${config.rateLimit.maxMessagesPerGroup}\n`;
      message += `   Advertencias: ${groupStats.warnings}`;
    }

    await ctx.reply(message);
  }

  private async handleWhitelist(
    ctx: MessageContext,
    action: string,
    target: string,
  ): Promise<void> {
    if (!action) {
      await ctx.reply(
        `*˚₊· ͟͟͞͞➳ whitelist ˚₊· ͟͟͞͞➳*\n\n` +
          `✩ agregar ﹒\`!antispam whitelist add <user|group>\`\n` +
          `✩ eliminar ﹒\`!antispam whitelist remove <user|group>\`\n` +
          `✩ listar ﹒\`!antispam whitelist list\``,
      );
      return;
    }

    if (action === 'list') {
      const stats = rateLimitService.getStats();
      let message = `*WHITELIST*\n\n`;

      if (stats.whitelistGroups > 0) {
        message += `📌 *Grupos:*\n`;
        config.rateLimit.whitelistGroups.forEach(g => {
          message += `   • ${g}\n`;
        });
      }

      if (stats.whitelistUsers > 0) {
        message += `\n👤 *Usuarios:*\n`;
        config.rateLimit.whitelistUsers.forEach(u => {
          message += `   • ${u}\n`;
        });
      }

      if (stats.whitelistGroups === 0 && stats.whitelistUsers === 0) {
        message += `No hay elementos en whitelist`;
      }

      await ctx.reply(message);
      return;
    }

    if (!target) {
      await ctx.reply('❌ Especifica el usuario o grupo');
      return;
    }

    if (action === 'add' || action === 'enable') {
      if (target.includes('@g.us')) {
        rateLimitService.addGroupToWhitelist(target);
        await ctx.reply(`✅ Grupo añadido a whitelist`);
      } else {
        if (!target.includes('@s.whatsapp.net')) {
          target = `${target}@s.whatsapp.net`;
        }
        rateLimitService.addUserToWhitelist(target);
        await ctx.reply(`✅ Usuario añadido a whitelist`);
      }
      return;
    }

    if (action === 'remove' || action === 'delete' || action === 'disable') {
      if (target.includes('@g.us')) {
        rateLimitService.removeGroupFromWhitelist(target);
        await ctx.reply(`✅ Grupo eliminado de whitelist`);
      } else {
        if (!target.includes('@s.whatsapp.net')) {
          target = `${target}@s.whatsapp.net`;
        }
        rateLimitService.removeUserFromWhitelist(target);
        await ctx.reply(`✅ Usuario eliminado de whitelist`);
      }
      return;
    }

    await ctx.reply('❌ Acción desconocida. Usa: add, remove, list');
  }

  private async handleReset(ctx: MessageContext, action: string, target: string): Promise<void> {
    if (action === 'group' || action === 'grupo') {
      if (ctx.chat.isGroup) {
        rateLimitService.resetGroup(ctx.chat.jid);
        await ctx.reply('✅ Contadores del grupo reiniciados');
      } else {
        await ctx.reply('❌ Este comando solo funciona en grupos');
      }
      return;
    }

    if (action === 'user' || action === 'usuario') {
      const userJid = target ? `${target}@s.whatsapp.net` : ctx.sender.jid;
      rateLimitService.resetUser(userJid);
      await ctx.reply(`✅ Contadores del usuario reiniciados`);
      return;
    }

    await ctx.reply(
      `*˚₊· ͟͟͞͞➳ reiniciar ˚₊· ͟͟͞͞➳*\n\n` +
        `✩ \`!antispam reset group\` ﹒limpiar este grupo\n` +
        `✩ \`!antispam reset user\` ﹒limpiar mi perfil`,
    );
  }

  private async showConfig(ctx: MessageContext): Promise<void> {
    const cfg = config.rateLimit;

    await ctx.reply(
      `*: ̗̀➛ mis reglas ̖́-*\n\n` +
        `✿ grupo ﹒${cfg.maxMessagesPerGroup} msgs/min\n` +
        `✿ tiempo ﹒${cfg.windowMs / 1000}s\n` +
        `✿ ráfaga ﹒${cfg.floodMaxPerSecond} msgs/s\n` +
        `✿ ventana ﹒${cfg.floodWindowMs}ms`,
    );
  }
}
