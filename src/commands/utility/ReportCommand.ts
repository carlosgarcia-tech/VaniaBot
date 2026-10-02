/**
 * ReportCommand.ts
 *
 * utility command `report` — Enviar un reporte al owner del bot
 * Usage: !report <mensaje>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, CommandContext, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { env } from '@/config/env.js';
import { logError } from '@/utils/logger.js';
import type { Report } from '@/services/system/ReportService.js';

/** Command handler for `!report`: Enviar un reporte al owner del bot. */
export class ReportCommand extends Command {
  name = 'report';
  description = 'Enviar un reporte al owner del bot';
  category = CommandCategory.UTILITY;
  aliases = ['reportar'];
  usage = '!report <mensaje>';
  examples = ['!report El bot no responde correctamente'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const content = ctx.args.join(' ').trim();

    if (!content) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *reporte* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ describe tu problema ✿\n\n` +
          `\`!report <mensaje>\`\n\n` +
          `✩ ejemplo:\n` +
          `  ﹒!report El comando .ai no funciona`,
      );
      return;
    }

    if (content.length < 5) {
      await ctx.reply('❌ El mensaje es muy corto. Describe el problema con más detalle.');
      return;
    }

    if (content.length > 2000) {
      await ctx.reply('❌ El mensaje es muy largo. Máximo 2000 caracteres.');
      return;
    }

    try {
      const fromGroup = ctx.chat.isGroup ? ctx.chat.jid : undefined;
      const fromGroupName = ctx.chat.isGroup
        ? (await serviceManager.groupService.getGroup(ctx.chat.jid))?.name
        : undefined;

      const report = await serviceManager.reportService.createReport(
        'report',
        ctx.sender.jid,
        ctx.sender.pushName || 'Unknown',
        content,
        fromGroup,
        fromGroupName,
      );

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *enviado* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ tu reporte fue enviado al owner ✿\n\n` +
          `📋 ID: \`${report.id}\`\n` +
          `🕐 Recibirás respuesta pronto`,
      );

      await this.notifyOwner(ctx, report);
    } catch (error) {
      logError('[ReportCommand] Error', error);
      await ctx.reply('❌ Error al enviar el reporte. Intenta de nuevo más tarde.');
    }
  }

  private async notifyOwner(ctx: MessageContext, report: Report): Promise<void> {
    try {
      const message = serviceManager.reportService.formatReportForOwner(report);

      await ctx.sock.sendMessage(env.OWNER_JID, {
        text: message,
        mentions: [ctx.sender.jid],
      });
    } catch (error) {
      logError('[ReportCommand] Error notifying owner', error);
    }
  }
}

export class BugReportCommand extends Command {
  name = 'bugreport';
  description = 'Reportar un bug o error del bot';
  category = CommandCategory.UTILITY;
  aliases = ['bug', 'bugreport', 'errorreport'];
  usage = '!bugreport <descripción del bug>';
  examples = ['!bugreport El comando falla al usar stickers'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const content = ctx.args.join(' ').trim();

    if (!content) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *bug report* ˚₊· ͟͟͞͞➳\n\n` +
          `🐛 describe el bug que encontraste ✿\n\n` +
          `\`!bugreport <descripción>\`\n\n` +
          `✩ *tips para un buen reporte:*\n` +
          `  ﹒qué comando falló\n` +
          `  ﹒qué esperabas que pasara\n` +
          `  ﹒qué realmente pasó\n` +
          `  ﹒pasos para reproducirlo`,
      );
      return;
    }

    if (content.length < 10) {
      await ctx.reply('❌ Describe el bug con más detalle para poder solucionarlo.');
      return;
    }

    if (content.length > 2000) {
      await ctx.reply('❌ La descripción es muy larga. Máximo 2000 caracteres.');
      return;
    }

    try {
      const fromGroup = ctx.chat.isGroup ? ctx.chat.jid : undefined;
      const fromGroupName = ctx.chat.isGroup
        ? (await serviceManager.groupService.getGroup(ctx.chat.jid))?.name
        : undefined;

      const report = await serviceManager.reportService.createReport(
        'bugreport',
        ctx.sender.jid,
        ctx.sender.pushName || 'Unknown',
        content,
        fromGroup,
        fromGroupName,
      );

      await ctx.reply(
        `🐛 *bug reportado*\n\n` +
          `✿ gracias por ayudar a mejorar ✿\n\n` +
          `📋 ID: \`${report.id}\``,
      );

      await this.notifyOwner(ctx, report);
    } catch (error) {
      logError('[BugReportCommand] Error', error);
      await ctx.reply('❌ Error al enviar el reporte. Intenta de nuevo más tarde.');
    }
  }

  private async notifyOwner(ctx: MessageContext, report: Report): Promise<void> {
    try {
      const message = serviceManager.reportService.formatReportForOwner(report);

      await ctx.sock.sendMessage(env.OWNER_JID, {
        text: message,
        mentions: [ctx.sender.jid],
      });
    } catch (error) {
      logError('[BugReportCommand] Error notifying owner', error);
    }
  }
}

export class FeedbackCommand extends Command {
  name = 'feedback';
  description = 'Enviar feedback o sugerencias al owner';
  category = CommandCategory.UTILITY;
  aliases = ['suggestion', 'sugerencia', 'idea'];
  usage = '!feedback <tu sugerencia>';
  examples = ['!feedback Sería genial tener un comando de weather'];
  cooldown = 60000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const content = ctx.args.join(' ').trim();

    if (!content) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *feedback* ˚₊· ͟͟͞͞➳\n\n` +
          `💡 comparte tu idea o sugerencia ✿\n\n` +
          `\`!feedback <sugerencia>\`\n\n` +
          `✩ ejemplo:\n` +
          `  ﹒!feedback Podrían agregar un comando de tarot`,
      );
      return;
    }

    if (content.length < 5) {
      await ctx.reply('❌ Tu sugerencia es muy corta.');
      return;
    }

    if (content.length > 2000) {
      await ctx.reply('❌ La sugerencia es muy larga. Máximo 2000 caracteres.');
      return;
    }

    try {
      const fromGroup = ctx.chat.isGroup ? ctx.chat.jid : undefined;
      const fromGroupName = ctx.chat.isGroup
        ? (await serviceManager.groupService.getGroup(ctx.chat.jid))?.name
        : undefined;

      const report = await serviceManager.reportService.createReport(
        'feedback',
        ctx.sender.jid,
        ctx.sender.pushName || 'Unknown',
        content,
        fromGroup,
        fromGroupName,
      );

      await ctx.reply(
        `💡 *feedback enviado*\n\n` +
          `✿ gracias por tus sugerencias ✿\n\n` +
          `📋 ID: \`${report.id}\``,
      );

      await this.notifyOwner(ctx, report);
    } catch (error) {
      logError('[FeedbackCommand] Error', error);
      await ctx.reply('❌ Error al enviar el feedback. Intenta de nuevo más tarde.');
    }
  }

  private async notifyOwner(ctx: MessageContext, report: Report): Promise<void> {
    try {
      const message = serviceManager.reportService.formatReportForOwner(report);

      await ctx.sock.sendMessage(env.OWNER_JID, {
        text: message,
        mentions: [ctx.sender.jid],
      });
    } catch (error) {
      logError('[FeedbackCommand] Error notifying owner', error);
    }
  }
}

export class MyReportsCommand extends Command {
  name = 'myreports';
  description = 'Ver tus reportes enviados';
  category = CommandCategory.UTILITY;
  aliases = ['misreportes', 'misreports'];
  usage = '!myreports';
  cooldown = 5000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    try {
      const reports = await serviceManager.reportService.getReportsByUser(ctx.sender.jid);

      if (reports.length === 0) {
        await ctx.reply('📭 No has enviado ningún reporte todavía.');
        return;
      }

      let message = `📋 *Tus Reportes*\n\n`;

      const statusEmoji = {
        pending: '⏳',
        read: '👁️',
        resolved: '✅',
      };

      for (const report of reports.slice(0, 10)) {
        const date = new Date(report.timestamp).toLocaleDateString();
        const typeEmoji =
          report.type === 'bugreport' ? '🐛' : report.type === 'feedback' ? '💡' : '📢';

        message += `${typeEmoji} ${report.id}\n`;
        message += `   ${statusEmoji[report.status]} ${report.status}\n`;
        message += `   📝 ${report.content.substring(0, 50)}${report.content.length > 50 ? '...' : ''}\n`;
        message += `   🕐 ${date}\n\n`;
      }

      if (reports.length > 10) {
        message += `_...y ${reports.length - 10} más_`;
      }

      await ctx.reply(message);
    } catch (error) {
      logError('[MyReportsCommand] Error', error);
      await ctx.reply('❌ Error al obtener tus reportes.');
    }
  }
}

export class ReportsCommand extends Command {
  name = 'reports';
  description = 'Ver y gestionar reportes (solo owner)';
  category = CommandCategory.OWNER;
  aliases = ['reportes', 'tickets'];
  usage = '!reports [pending|read|resolved|all] [page]';
  examples = ['!reports pending', '!reports resolved 2'];
  cooldown = 3000;
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const statusFilter = ctx.args[0]?.toLowerCase();
    const page = parseInt(ctx.args[1]) || 1;

    if (statusFilter && !['pending', 'read', 'resolved', 'all'].includes(statusFilter)) {
      await ctx.reply(
        `❌ Filtro inválido.\n\n` +
          `Filtros: pending, read, resolved, all\n` +
          `\`!reports pending\` - Ver pendientes\n` +
          `\`!reports resolved\` - Ver resueltos`,
      );
      return;
    }

    try {
      const filter =
        statusFilter && statusFilter !== 'all' ? (statusFilter as Report['status']) : undefined;
      const { items, total } = await serviceManager.reportService.getReports({
        status: filter,
        page,
        limit: 10,
      });

      if (items.length === 0) {
        await ctx.reply(`📭 No hay reportes${filter ? ` con estado "${filter}"` : ''}.`);
        return;
      }

      let message = `📬 *Reportes`;
      if (filter) {
        message += ` (${filter})`;
      }
      message += `*\n━━━━━━━━━━━━━━━━\n\n`;

      for (const report of items) {
        const date = new Date(report.timestamp).toLocaleDateString();
        const typeEmoji =
          report.type === 'bugreport' ? '🐛' : report.type === 'feedback' ? '💡' : '📢';
        const statusEmoji = {
          pending: '⏳',
          read: '👁️',
          resolved: '✅',
        };

        message += `${typeEmoji} \`${report.id}\` ${statusEmoji[report.status]}\n`;
        message += `   De: ${report.fromName}\n`;
        message += `   📝 ${(report.content || '').substring(0, 60)}${(report.content || '').length > 60 ? '...' : ''}\n`;
        message += `   🕐 ${date}\n\n`;
      }

      const totalPages = Math.ceil(total / 10);
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `📊 Página ${page}/${totalPages} (${total} total)`;

      await ctx.reply(message);
    } catch (error) {
      logError('[ReportsCommand] Error', error);
      await ctx.reply('❌ Error al obtener reportes.');
    }
  }
}

export class ResolveReportCommand extends Command {
  name = 'resolvereport';
  description = 'Marcar un reporte como resuelto';
  category = CommandCategory.OWNER;
  aliases = ['resoverreport', 'fixreport'];
  usage = '!resolvereport <id>';
  examples = ['!resolvereport RPT-123456-0001'];
  cooldown = 3000;
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const reportId = ctx.args[0];

    if (!reportId) {
      await ctx.reply(`❌ Especifica el ID del reporte.\n\n\`!resolvereport <id>\``);
      return;
    }

    try {
      const report = await serviceManager.reportService.getReport(reportId);

      if (!report) {
        await ctx.reply(`❌ Reporte \`${reportId}\` no encontrado.`);
        return;
      }

      await serviceManager.reportService.resolveReport(reportId, ctx.sender.jid);

      await ctx.reply(
        `✅ Reporte \`${reportId}\` marcado como resuelto.\n\n` +
          `De: ${report.fromName}\n` +
          `Tipo: ${report.type}`,
      );

      try {
        const resolvedMsg =
          `✅ *Tu reporte fue resuelto*\n\n` +
          `📋 ID: \`${report.id}\`\n` +
          `📝 ${report.content.substring(0, 100)}...\n\n` +
          `Gracias por tu paciencia ✿`;

        await ctx.sock.sendMessage(report.fromJid, { text: resolvedMsg });
      } catch (error) {
        // El reporte ya se resolvió: fallar el aviso al autor es secundario.
        logError(`[ResolveReportCommand] Could not notify reporter ${report.fromJid}`, error);
      }
    } catch (error) {
      logError('[ResolveReportCommand] Error', error);
      await ctx.reply('❌ Error al resolver el reporte.');
    }
  }
}

export class ViewReportCommand extends Command {
  name = 'viewreport';
  description = 'Ver detalles de un reporte específico';
  category = CommandCategory.OWNER;
  aliases = ['vreport', 'verreporte'];
  usage = '!viewreport <id>';
  examples = ['!viewreport RPT-123456-0001'];
  cooldown = 3000;
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const reportId = ctx.args[0];

    if (!reportId) {
      await ctx.reply(`❌ Especifica el ID del reporte.\n\n\`!viewreport <id>\``);
      return;
    }

    try {
      const report = await serviceManager.reportService.getReport(reportId);

      if (!report) {
        await ctx.reply(`❌ Reporte \`${reportId}\` no encontrado.`);
        return;
      }

      if (report.status === 'pending') {
        await serviceManager.reportService.markAsRead(reportId, ctx.sender.jid);
      }

      const message = serviceManager.reportService.formatReportForOwner(report);

      await ctx.reply(message);
    } catch (error) {
      logError('[ViewReportCommand] Error', error);
      await ctx.reply('❌ Error al ver el reporte.');
    }
  }
}

export default [
  ReportCommand,
  BugReportCommand,
  FeedbackCommand,
  MyReportsCommand,
  ReportsCommand,
  ResolveReportCommand,
  ViewReportCommand,
];
