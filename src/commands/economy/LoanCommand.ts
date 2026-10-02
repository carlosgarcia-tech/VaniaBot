/**
 * LoanCommand.ts
 *
 * economy command `prestamo` — Sistema de préstamos entre usuarios
 * Usage: !prestamo [dar|aceptar|rechazar|pagar|estado]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { loanService } from '@/services/economy/LoanService.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!prestamo`: Sistema de préstamos entre usuarios. */
export class LoanCommand extends Command {
  name = 'prestamo';
  description = 'Sistema de préstamos entre usuarios';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['loan', 'deuda'];
  usage = '!prestamo [dar|aceptar|rechazar|pagar|estado]';
  examples = [
    '!prestamo dar @user 10000',
    '!prestamo aceptar PR-0001',
    '!prestamo rechazar PR-0001',
    '!prestamo pagar PR-0001',
    '!prestamo estado',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args;
    const action = args[0]?.toLowerCase();

    switch (action) {
      case 'dar':
      case 'give':
        await this.giveLoan(ctx);
        break;
      case 'aceptar':
      case 'accept':
        await this.acceptLoan(ctx);
        break;
      case 'rechazar':
      case 'reject':
        await this.rejectLoan(ctx);
        break;
      case 'pagar':
      case 'pay':
        await this.repayLoan(ctx);
        break;
      case 'estado':
      case 'status':
        await this.showStatus(ctx);
        break;
      case 'mis':
      case 'my':
        await this.showMyLoans(ctx);
        break;
      default:
        await this.showHelp(ctx);
    }
  }

  private async giveLoan(ctx: MessageContext): Promise<void> {
    const mentionedJid = ctx.mentionedJid;
    const amountStr = ctx.args[2];
    const amount = parseInt(amountStr);

    if (!mentionedJid) {
      await ctx.reply(
        `💰 *PRÉSTAMOS*\n\n` +
          `✿ *Cómo dar un préstamo:*\n` +
          `!prestamo dar @usuario [cantidad]\n\n` +
          `📋 *Detalles:*\n` +
          `• Mínimo: $1,000\n` +
          `• Máximo: $100,000\n` +
          `• Interés: 10%\n` +
          `• El usuario debe aceptar el préstamo\n\n` +
          `📝 *Ejemplo:*\n!prestamo dar @user 10000`,
      );
      return;
    }

    if (!amountStr || isNaN(amount)) {
      await ctx.reply(`❌ Especifica la cantidad\n\n💡 !prestamo dar @user 10000`);
      return;
    }

    if (mentionedJid === ctx.sender.jid) {
      await ctx.reply(`❌ No puedes darte un préstamo a ti mismo`);
      return;
    }

    const result = await loanService.requestLoan(ctx.sender.jid, mentionedJid, amount);

    if (result.success) {
      await ctx.reply(result.message);
    } else {
      await ctx.reply(result.message);
    }
  }

  private async acceptLoan(ctx: MessageContext): Promise<void> {
    const loanId = ctx.args[1];

    if (!loanId) {
      await ctx.reply(
        `❌ Especifica el ID del préstamo\n\n💡 !prestamo aceptar PR-0001\n\n` +
          `Usa !prestamo estado para ver tus préstamos pendientes`,
      );
      return;
    }

    const normalizedId = loanId.toUpperCase().replace(/^PR-?/, 'PR-');
    const result = await loanService.acceptLoan(ctx.sender.jid, normalizedId);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('✅');
    } else {
      await ctx.reply(result.message);
    }
  }

  private async rejectLoan(ctx: MessageContext): Promise<void> {
    const loanId = ctx.args[1];

    if (!loanId) {
      await ctx.reply(`❌ Especifica el ID del préstamo\n\n💡 !prestamo rechazar PR-0001`);
      return;
    }

    const normalizedId = loanId.toUpperCase().replace(/^PR-?/, 'PR-');
    const result = await loanService.rejectLoan(ctx.sender.jid, normalizedId);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('❌');
    } else {
      await ctx.reply(result.message);
    }
  }

  private async repayLoan(ctx: MessageContext): Promise<void> {
    const loanId = ctx.args[1];

    if (!loanId) {
      await ctx.reply(
        `❌ Especifica el ID del préstamo\n\n💡 Usa !prestamo estado para ver tus préstamos`,
      );
      return;
    }

    const normalizedId = loanId.toUpperCase().replace(/^PR-?/, 'PR-');
    const result = await loanService.repayLoan(ctx.sender.jid, normalizedId);

    if (result.success) {
      await ctx.reply(result.message);
      await ctx.react('✅');
    } else {
      await ctx.reply(result.message);
    }
  }

  private async showStatus(ctx: MessageContext): Promise<void> {
    const user = await serviceManager.userService.getUser(ctx.sender.jid);
    const activeLoans = loanService.getActiveLoans(ctx.sender.jid);
    const pendingLoans = loanService.getPendingLoans(ctx.sender.jid);

    let message = `💰 *ESTADO DE PRÉSTAMOS*\n\n`;
    message += `💵 Tu balance: $${formatNumber(user.money)}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (pendingLoans.length > 0) {
      message += `⏳ *Préstamos pendientes de aceptar:*\n\n`;
      pendingLoans.forEach((loan, i) => {
        message += `${i + 1}. 💰 $${formatNumber(loan.amount)}\n`;
        message += `   🆔 \`${loan.id}\`\n`;
        message += `   👤 Prestamista: ${loan.lenderJid.split('@')[0]}\n\n`;
      });
      message += `💡 *Para aceptar:* !prestamo aceptar [id]\n`;
      message += `💡 *Para rechazar:* !prestamo rechazar [id}\n\n`;
    }

    if (activeLoans.length > 0) {
      const asBorrower = activeLoans.filter(l => l.borrowerJid === ctx.sender.jid);
      const asLender = activeLoans.filter(l => l.lenderJid === ctx.sender.jid);

      if (asBorrower.length > 0) {
        message += `📋 *Préstamos que debes:*\n\n`;
        asBorrower.forEach((loan, i) => {
          const daysLeft = Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
          message += `${i + 1}. 💸 $${formatNumber(loan.remaining)}\n`;
          message += `   🆔 \`${loan.id}\`\n`;
          message += `   ⏰ ${daysLeft} días restantes\n\n`;
        });
        message += `💡 *Para pagar:* !prestamo pagar [id]\n\n`;
      }

      if (asLender.length > 0) {
        message += `📋 *Préstamos que diste:*\n\n`;
        asLender.forEach((loan, i) => {
          const daysLeft = Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24));
          message += `${i + 1}. 💰 $${formatNumber(loan.remaining)}\n`;
          message += `   🆔 \`${loan.id}\`\n`;
          message += `   👤 Deudor: ${loan.borrowerJid.split('@')[0]}\n`;
          message += `   ⏰ ${daysLeft} días restantes\n\n`;
        });
      }
    }

    if (pendingLoans.length === 0 && activeLoans.length === 0) {
      message += `✨ No tienes préstamos\n\n`;
    }

    await ctx.reply(message);
  }

  private async showMyLoans(ctx: MessageContext): Promise<void> {
    const pendingLoans = loanService.getPendingLoans(ctx.sender.jid);

    if (pendingLoans.length === 0) {
      await ctx.reply(`✨ No tienes préstamos pendientes`);
      return;
    }

    let message = `📋 *TUS PRÉSTAMOS PENDIENTES*\n\n`;

    pendingLoans.forEach((loan, i) => {
      message += `${i + 1}. 💰 $${formatNumber(loan.amount)}\n`;
      message += `   🆔 \`${loan.id}\`\n`;
      message += `   👤 De: ${loan.lenderJid.split('@')[0]}\n`;
      message += `   📈 Interés: ${loan.interestRate * 100}%\n`;
      message += `   💸 Total: $${formatNumber(loan.amount * 1.1)}\n\n`;
      message += `   ✅ !prestamo aceptar ${loan.id}\n`;
      message += `   ❌ !prestamo rechazar ${loan.id}\n\n`;
    });

    await ctx.reply(message);
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    await ctx.reply(
      `💰 *SISTEMA DE PRÉSTAMOS*\n\n` +
        `✿ *Presta dinero a otros usuarios*\n` +
        `con interés del 10%.\n\n` +
        `📋 *Comandos:*\n\n` +
        `• !prestamo dar @user [cantidad]\n` +
        `   → Solicitar dar un préstamo\n\n` +
        `• !prestamo aceptar [id]\n` +
        `   → Aceptar un préstamo\n\n` +
        `• !prestamo rechazar [id]\n` +
        `   → Rechazar un préstamo\n\n` +
        `• !prestamo pagar [id]\n` +
        `   → Pagar un préstamo\n\n` +
        `• !prestamo estado\n` +
        `   → Ver todos tus préstamos\n\n` +
        `• !prestamo mis\n` +
        `   → Ver préstamos pendientes\n\n` +
        `📊 *Detalles:*\n` +
        `• Mínimo: $1,000\n` +
        `• Máximo: $100,000\n` +
        `• Interés: 10%\n` +
        `• Duración: 7 días\n\n` +
        `💡 *Nota:* El prestatario debe aceptar\n` +
        `el préstamo para que sea efectivo.`,
    );
  }
}
