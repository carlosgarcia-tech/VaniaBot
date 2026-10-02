/**
 * ReminderCommand.ts
 *
 * utility command `recordatorio` — Programa recordatorios y alarmas personales.
 * Usage: !recordatorio <tiempo> <mensaje>
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { persistenceService } from '@/services/system/PersistenceService.js';
import { formatTime } from '@/utils/helpers.js';

/** Command handler for `!recordatorio`: Programa recordatorios y alarmas personales. */
export class ReminderCommand extends Command {
  name = 'recordatorio';
  description = 'Programa recordatorios y alarmas personales.';
  category = CommandCategory.UTILITY;
  aliases = ['remind', 'alarma', 'recordar', 'timer'];
  usage = '!recordatorio <tiempo> <mensaje>';
  examples = [
    '!recordatorio 10m Revisar el horno',
    '!recordatorio 2h Llamar al doctor',
    '!recordatorio 1d Pagar la renta',
    '!recordatorio lista',
    '!recordatorio cancelar <id>',
  ];
  cooldown = 2000;
  contexts = [CommandContext.BOTH];

  private readonly MAX_REMINDERS_PER_USER = 5;

  private parseTime(input: string): number | null {
    const regex = /^(\d+)(s|seg|m|min|h|hr|d|dia|dias)$/i;
    const match = input.match(regex);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      s: 1000,
      seg: 1000,
      m: 60 * 1000,
      min: 60 * 1000,
      h: 60 * 60 * 1000,
      hr: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      dia: 24 * 60 * 60 * 1000,
      dias: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] || 0);
  }

  async execute(ctx: MessageContext): Promise<void> {
    const sub = ctx.args[0]?.toLowerCase();

    if (sub === 'lista' || sub === 'list') {
      const userReminders = persistenceService.getUserReminders(ctx.sender.jid);

      if (!userReminders.length) {
        await ctx.reply('📭 No tienes recordatorios activos.');
        return;
      }

      const lines = userReminders.map(r => {
        const left = formatTime(r.triggerAt - Date.now());
        return `🔔 *[${r.id}]* — ${r.message}\n   ⏳ En: ${left}`;
      });

      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *tus recordatorios* ˚₊· ͟͟͞͞➳\n` +
          `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
          lines.join('\n\n') +
          `\n﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
          `♡ si quieres cancelar: *!recordatorio cancelar* <ID> ♡`,
      );
      return;
    }

    if (sub === 'cancelar' || sub === 'cancel') {
      const id = ctx.args[1]?.toUpperCase();
      if (!id) {
        await ctx.reply('❌ Uso: !recordatorio cancelar <ID>');
        return;
      }

      const reminder = persistenceService.getReminder(id);
      if (!reminder) {
        await ctx.reply(`❌ Recordatorio *${id}* no encontrado.`);
        return;
      }

      if (reminder.userJid !== ctx.sender.jid && !ctx.sender.isOwner) {
        await ctx.reply('❌ Solo puedes cancelar tus propios recordatorios.');
        return;
      }

      persistenceService.removeReminder(id);

      await ctx.reply(`✅ Recordatorio *[${id}]* cancelado.`);
      return;
    }

    if (ctx.args.length < 2) {
      await ctx.reply(
        `⏰ *Recordatorios*\n\n` +
          `*Uso:* !recordatorio <tiempo> <mensaje>\n\n` +
          `*Tiempos:*\n` +
          `  30s → 30 segundos\n` +
          `  10m → 10 minutos\n` +
          `  2h  → 2 horas\n` +
          `  1d  → 1 día\n\n` +
          `*Subcomandos:*\n` +
          `  !recordatorio lista\n` +
          `  !recordatorio cancelar <ID>`,
      );
      return;
    }

    const timeStr = ctx.args[0];
    const messageText = ctx.args.slice(1).join(' ');

    const delayMs = this.parseTime(timeStr);
    if (!delayMs || delayMs <= 0) {
      await ctx.reply(`❌ Tiempo inválido: *${timeStr}*\n` + `Ejemplos válidos: 30s, 10m, 2h, 1d`);
      return;
    }

    const maxMs = 7 * 24 * 60 * 60 * 1000;
    if (delayMs > maxMs) {
      await ctx.reply('❌ El tiempo máximo para un recordatorio es *7 días*.');
      return;
    }

    const userReminders = persistenceService.getUserReminders(ctx.sender.jid);
    if (userReminders.length >= this.MAX_REMINDERS_PER_USER) {
      await ctx.reply(
        `❌ Límite alcanzado (máx. ${this.MAX_REMINDERS_PER_USER} recordatorios).\n` +
          `Cancela uno con: !recordatorio cancelar <ID>`,
      );
      return;
    }

    const id = persistenceService.generateId();
    const triggerAt = Date.now() + delayMs;

    persistenceService.addReminder({
      id,
      userJid: ctx.sender.jid,
      chatJid: ctx.chat.jid,
      message: messageText,
      triggerAt,
      createdAt: Date.now(),
    });

    await ctx.react('✅');
    await ctx.reply(
      `˚₊· ͟͟͞͞➳ *recordatorio listo* ˚₊· ͟͟͞͞➳\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
        `✩ ID: *${id}*\n` +
        `✿ mensaje: ${messageText}\n` +
        `⏳ te aviso en: *${formatTime(delayMs)}*\n` +
        `🕐 será a las: ${new Date(triggerAt).toLocaleTimeString('es-MX')}\n` +
        `﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒﹒\n` +
        `♡ si quieres cancelar: *!recordatorio cancelar ${id}* ♡`,
    );
  }
}
