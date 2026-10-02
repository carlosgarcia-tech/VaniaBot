/**
 * SubBotCommand.ts
 *
 * Commands for managing subbots with slot system.
 * Supports: register, delete, status, reconnect, and list subbots.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';
import type { SubBotSlot } from '@/types/subbot.js';
import { subBotManager } from '@/services/subbot/SubBotManager.js';
import { subBotDatabase } from '@/services/subbot/SubBotDatabase.js';

const SUBBOT_COOLDOWN_MS = 60000;
const userLastAttempt = new Map<string, number>();

function canRegisterSubBot(userJid: string): { allowed: boolean; remaining: number } {
  const lastAttempt = userLastAttempt.get(userJid) ?? 0;
  const now = Date.now();
  const remaining = Math.ceil((lastAttempt + SUBBOT_COOLDOWN_MS - now) / 1000);

  if (now - lastAttempt >= SUBBOT_COOLDOWN_MS) {
    return { allowed: true, remaining: 0 };
  }
  return { allowed: false, remaining };
}

function formatSlotStatus(status: string): { emoji: string; label: string } {
  const statuses: Record<string, { emoji: string; label: string }> = {
    free: { emoji: '🟢', label: 'LIBRE' },
    reserved: { emoji: '🟡', label: 'RESERVADO' },
    pending: { emoji: '⏳', label: 'PENDIENTE' },
    linking: { emoji: '🔗', label: 'VINCULANDO' },
    connected: { emoji: '✅', label: 'CONECTADO' },
    disconnected: { emoji: '❌', label: 'DESCONECTADO' },
  };
  return statuses[status] || { emoji: '❓', label: status.toUpperCase() };
}

export class SubBotCommand extends Command {
  name = 'subbot';
  description = 'Request or manage a subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['serbot', 'addbot'];
  usage = '.subbot <number>';
  examples = ['.subbot 529514639799', '.subbot 5 529514639799'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const isOwner = ctx.sender.isOwner;
    const args = ctx.args;

    if (args.length === 0) {
      await this.showHelp(ctx);
      return;
    }

    const action = args[0].toLowerCase();

    if (['info', 'reconectar', 'liberar', 'reset'].includes(action)) {
      await this.handleSlotAction(ctx, action, args.slice(1), isOwner);
      return;
    }

    if (args.length === 1 && /^\d+$/.test(args[0])) {
      await this.requestSubBot(ctx, parseInt(args[0]), isOwner);
      return;
    }

    const slotArg = args[0];
    const isSlotNumber = /^\d+$/.test(slotArg) && parseInt(slotArg) >= 1 && parseInt(slotArg) <= 50;

    if (isSlotNumber && args.length >= 2) {
      const slot = parseInt(slotArg);
      if (!isOwner) {
        await ctx.reply('⚠️ Solo el owner puede especificar un slot.');
        return;
      }
      await this.requestSubBotWithSlot(ctx, slot, args.slice(1), isOwner);
      return;
    }

    await this.requestSubBot(ctx, undefined, isOwner);
  }

  private async showHelp(ctx: MessageContext): Promise<void> {
    const isOwner = ctx.sender.isOwner;
    const publicEnabled = subBotDatabase.isPublicRequestsEnabled();
    const usedSlots = subBotDatabase.getUsedSlotCount();
    const maxSlots = subBotDatabase.getMaxSlots();

    let helpText =
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
      `   *Sistema de SubBots*\n` +
      `   ${usedSlots}/${maxSlots} slots en uso\n` +
      `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    if (isOwner) {
      helpText += `*Slots disponibles:* ${maxSlots - usedSlots}\n`;
      helpText += `*Solicitudes públicas:* ${publicEnabled ? '✅' : '❌'}\n\n`;
    }

    helpText += `*Comandos disponibles:*\n\n`;

    if (isOwner) {
      helpText += `*Gestión de slots:*\n`;
      helpText += `• \`.subbot <numero>\` - Pedir slot libre\n`;
      helpText += `• \`.subbot <slot> <numero>\` - Pedir slot específico\n`;
      helpText += `• \`.subbot info <slot>\` - Info del slot\n`;
      helpText += `• \`.subbot reconectar <slot>\` - Reconectar\n`;
      helpText += `• \`.subbot liberar <slot>\` - Liberar slot\n`;
      helpText += `• \`.subbot reset <slot>\` - Reset sesión\n`;
      helpText += `• \`.subbots\` - Ver todos los slots\n`;
      helpText += `• \`.subboton\` / \`.subbotoff\` - Toggle público\n\n`;
    } else {
      helpText += `• \`.subbot <numero>\` - Solicitar tu SubBot\n`;
      helpText += `• \`.subbots\` - Ver slots disponibles\n\n`;
    }

    helpText += `*Ejemplo:*\n`;
    helpText += `• \`.subbot 529514639799\``;

    await ctx.reply(helpText);
  }

  private async requestSubBot(
    ctx: MessageContext,
    phoneArg: string | number | undefined,
    isOwner: boolean,
  ): Promise<void> {
    if (!isOwner && !subBotDatabase.isPublicRequestsEnabled()) {
      await ctx.reply('⚠️ Las solicitudes de subbot están desactivadas.');
      return;
    }

    const phone = typeof phoneArg === 'number' ? phoneArg.toString() : phoneArg;

    if (!phone) {
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Solicitar SubBot*\n` +
          `\n` +
          `💝 Vincula tu número\n` +
          `   para crear tu propia\n` +
          `   *SubBot*.\n` +
          `\n` +
          `*Uso:*\n` +
          `• \`.subbot <numero>\`\n` +
          `\n` +
          `*Ejemplo:*\n` +
          `• \`.subbot 529514639799\`\n` +
          `\n` +
          `🌍 Incluye el código\n` +
          `   de país sin el +\n` +
          `\n` +
          `   Estaré lista 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      return;
    }

    const cooldownCheck = canRegisterSubBot(ctx.sender.jid);
    if (!cooldownCheck.allowed) {
      await ctx.reply(
        `⏳ Espera *${cooldownCheck.remaining} segundos*\n` + `   antes de intentar de nuevo.`,
      );
      return;
    }

    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\d{10,15}$/.test(cleaned)) {
      await ctx.reply('❌ Número inválido. Formato: `.subbot 529514639799`');
      return;
    }

    await ctx.react('⏳');

    try {
      userLastAttempt.set(ctx.sender.jid, Date.now());
      const result = await subBotManager.requestSubBot(
        ctx.sender.jid,
        ctx.sender.pushName,
        cleaned,
        undefined,
        isOwner,
      );

      const { slot } = result;

      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Slot #${slot.slot} reservado*\n` +
          `\n` +
          `💝 Tu *pairing code*\n` +
          `   está siendo generado...\n` +
          `\n` +
          `Enviaremos el código\n` +
          `   a este chat pronto.\n` +
          `\n` +
          `   Estaré aquí 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }

  private async requestSubBotWithSlot(
    ctx: MessageContext,
    slotNumber: number,
    remainingArgs: string[],
    isOwner: boolean,
  ): Promise<void> {
    if (!isOwner) {
      await ctx.reply('⚠️ Solo el owner puede especificar slots.');
      return;
    }

    if (!subBotDatabase.isPublicRequestsEnabled() && !isOwner) {
      await ctx.reply('⚠️ Las solicitudes de subbot están desactivadas.');
      return;
    }

    const phone = remainingArgs[0];
    if (!phone) {
      await ctx.reply(`Uso: \`.subbot ${slotNumber} <numero>\``);
      return;
    }

    const cooldownCheck = canRegisterSubBot(ctx.sender.jid);
    if (!cooldownCheck.allowed) {
      await ctx.reply(`⏳ Espera *${cooldownCheck.remaining} segundos*.`);
      return;
    }

    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\d{10,15}$/.test(cleaned)) {
      await ctx.reply('❌ Número inválido.');
      return;
    }

    await ctx.react('⏳');

    try {
      userLastAttempt.set(ctx.sender.jid, Date.now());
      const result = await subBotManager.requestSubBot(
        ctx.sender.jid,
        ctx.sender.pushName,
        cleaned,
        slotNumber,
        true,
      );

      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *Slot #${result.slot.slot} reservado*\n` +
          `\n` +
          `💝 Tu *pairing code*\n` +
          `   está siendo generado...\n` +
          `\n` +
          `   Estaré aquí 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }

  private async handleSlotAction(
    ctx: MessageContext,
    action: string,
    args: string[],
    isOwner: boolean,
  ): Promise<void> {
    if (!isOwner) {
      await ctx.reply('⚠️ Solo el owner puede gestionar slots.');
      return;
    }

    const slotArg = args[0];
    if (!slotArg || !/^\d+$/.test(slotArg)) {
      await ctx.reply(`Uso: \`.subbot ${action} <slot>\``);
      return;
    }

    const slotNumber = parseInt(slotArg);
    const slot = subBotDatabase.getSlot(slotNumber);

    if (!slot) {
      await ctx.reply(`❌ Slot ${slotNumber} no existe.`);
      return;
    }

    switch (action) {
      case 'info':
        await this.showSlotInfo(ctx, slot);
        break;
      case 'reconectar':
        await this.reconnectSlot(ctx, slot);
        break;
      case 'liberar':
        await this.releaseSlot(ctx, slot, args[1]);
        break;
      case 'reset':
        await this.resetSlot(ctx, slotNumber);
        break;
    }
  }

  private async showSlotInfo(ctx: MessageContext, slot: SubBotSlot): Promise<void> {
    const { emoji, label } = formatSlotStatus(slot.status);

    let info =
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` + `   *Slot #${slot.slot}*\n` + `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    info += `${emoji} Estado: *${label}*\n\n`;

    if (slot.ownerName) {
      info += `👤 Owner: *${slot.ownerName}*\n`;
    }
    if (slot.phoneNumber) {
      info += `📱 Número: *+${slot.phoneNumber}*\n`;
    }
    if (slot.name) {
      info += `🏷️ Nombre: *${slot.name}*\n`;
    }
    if (slot.connectedAt) {
      info += `🕐 Conectado: *${new Date(slot.connectedAt).toLocaleString()}*\n`;
    }
    if (slot.requestedAt && slot.status !== 'free') {
      info += `📅 Solicitado: *${new Date(slot.requestedAt).toLocaleString()}*\n`;
    }

    await ctx.reply(info);
  }

  private async reconnectSlot(ctx: MessageContext, slot: SubBotSlot): Promise<void> {
    if (!slot.ownerJid) {
      await ctx.reply('❌ Este slot no tiene owner.');
      return;
    }

    await ctx.react('⏳');
    try {
      await subBotManager.reconnectByOwner(slot.ownerJid, slot.slot);
      await ctx.reply(`🔄 Slot #${slot.slot} reconectando...`);
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      await ctx.reply(`❌ ${msg}`);
      await ctx.react('❌');
    }
  }

  private async releaseSlot(
    ctx: MessageContext,
    slot: SubBotSlot,
    confirmNumber?: string,
  ): Promise<void> {
    if (!slot.ownerJid) {
      await ctx.reply('❌ Este slot está libre.');
      return;
    }

    if (confirmNumber !== slot.phoneNumber) {
      await ctx.reply(
        `⚠️ Confirma con el número:\n` + `   \`.subbot liberar ${slot.slot} ${slot.phoneNumber}\``,
      );
      return;
    }

    await ctx.react('⏳');
    try {
      await subBotManager.deleteSubBot(slot.ownerJid, slot.slot);
      await ctx.reply(`✅ Slot #${slot.slot} liberado.`);
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      await ctx.reply(`❌ ${msg}`);
      await ctx.react('❌');
    }
  }

  private async resetSlot(ctx: MessageContext, slotNumber: number): Promise<void> {
    await ctx.react('⏳');
    try {
      await subBotManager.resetSlot(slotNumber);
      await ctx.reply(`✅ Slot #${slotNumber} reseteado.`);
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      await ctx.reply(`❌ ${msg}`);
      await ctx.react('❌');
    }
  }
}

export class SubBotsCommand extends Command {
  name = 'subbots';
  description = 'View all subbot slots';
  category = CommandCategory.SUBBOT;
  usage = '.subbots';
  examples = ['.subbots'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const slots = subBotDatabase.getAllSlots();
    const maxSlots = subBotDatabase.getMaxSlots();
    const usedSlots = slots.filter(s => s.status !== 'free').length;

    let text =
      `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
      `   *Slots SubBot*\n` +
      `   ${usedSlots}/${maxSlots} en uso\n` +
      `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    const activeSlots = slots.filter(s => s.status !== 'free' && s.slot <= maxSlots);
    const freeSlots = slots.filter(s => s.status === 'free' && s.slot <= maxSlots);

    for (const slot of activeSlots) {
      const { emoji, label } = formatSlotStatus(slot.status);
      text += `${emoji} [${slot.slot}] ${slot.ownerName || 'N/A'} - *${label}*\n`;
      if (slot.phoneNumber) {
        text += `   📱 +${slot.phoneNumber.slice(0, 6)}****${slot.phoneNumber.slice(-4)}\n`;
      }
    }

    if (freeSlots.length > 0) {
      const freeCount = freeSlots.length;
      const firstFree = freeSlots[0].slot;
      const lastFree = freeSlots[freeSlots.length - 1].slot;
      text += `\n🟢 [${firstFree}-${lastFree}] ${freeCount} slots *LIBRES*\n`;
    }

    await ctx.reply(text);
  }
}

export class SubBotOnCommand extends Command {
  name = 'subboton';
  description = 'Enable public subbot requests';
  category = CommandCategory.SUBBOT;
  usage = '.subboton';
  examples = ['.subboton'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    subBotDatabase.setPublicRequests(true);
    await ctx.reply('✅ Solicitudes de subbot *activadas*.\n\nAhora todos pueden pedir un subbot.');
  }
}

export class SubBotOffCommand extends Command {
  name = 'subbotoff';
  description = 'Disable public subbot requests';
  category = CommandCategory.SUBBOT;
  usage = '.subbotoff';
  examples = ['.subbotoff'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.OWNER] };

  async execute(ctx: MessageContext): Promise<void> {
    subBotDatabase.setPublicRequests(false);
    await ctx.reply('❌ Solicitudes de subbot *desactivadas*.\n\nSolo tú puedes crear subbots.');
  }
}

export class DelBotCommand extends Command {
  name = 'delbot';
  description = 'Delete your VaniaBot subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['removebot', 'unserbot'];
  usage = '.delbot';
  examples = ['.delbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const slots = subBotDatabase.getOwnerSlots(ctx.sender.jid);

    if (slots.length === 0) {
      await ctx.reply(
        '❌ No tienes subbots registradas.\n\nUsa `.subbot <numero>` para crear una.',
      );
      return;
    }

    if (slots.length > 1) {
      let text = `╭━━━ 🌸 *VaniaBot* ━━━╮\n` + `   *Tus SubBots*\n` + `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

      for (const slot of slots) {
        const { emoji, label } = formatSlotStatus(slot.status);
        text += `${emoji} Slot #${slot.slot} - *${label}*\n`;
      }

      text += `\nUsa: \`.subbot liberar <slot> ${slots[0].phoneNumber}\``;
      await ctx.reply(text);
      return;
    }

    const slot = slots[0];
    await ctx.react('⏳');
    try {
      await subBotManager.deleteSubBot(ctx.sender.jid, slot.slot);
      await ctx.reply(
        `╭━━━ 🌸 *VaniaBot* ━━━╮\n` +
          `   *SubBot eliminada*\n` +
          `\n` +
          `Tu subbot del slot #${slot.slot}\n` +
          `   fue eliminada.\n` +
          `\n` +
          `   Estoy aquí 💗\n` +
          `╰━━━━━━━━━━━━━━━━━━━━╯`,
      );
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}

export class StatusBotCommand extends Command {
  name = 'statusbot';
  description = 'View your subbot status';
  category = CommandCategory.SUBBOT;
  aliases = ['mibot', 'mybot'];
  usage = '.statusbot';
  examples = ['.statusbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const slots = subBotDatabase.getOwnerSlots(ctx.sender.jid);

    if (slots.length === 0) {
      await ctx.reply('❌ No tienes subbots.\n\nUsa `.subbot <numero>` para crear una.');
      return;
    }

    let text = `╭━━━ 🌸 *VaniaBot* ━━━╮\n` + `   *Tus SubBots*\n` + `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    for (const slot of slots) {
      const { emoji, label } = formatSlotStatus(slot.status);
      text += `${emoji} Slot #${slot.slot} - *${label}*\n`;
      if (slot.name) text += `   🏷️ ${slot.name}\n`;
      if (slot.phoneNumber) text += `   📱 +${slot.phoneNumber}\n`;
      if (slot.connectedAt) {
        text += `   🕐 Desde: ${new Date(slot.connectedAt).toLocaleString()}\n`;
      }
      text += '\n';
    }

    await ctx.reply(text);
  }
}

export class ReconBotCommand extends Command {
  name = 'reconbot';
  description = 'Reconnect your subbot';
  category = CommandCategory.SUBBOT;
  aliases = ['restartbot'];
  usage = '.reconbot';
  examples = ['.reconbot'];
  contexts = [CommandContext.BOTH];
  permissions = { user: [PermissionLevel.USER] };

  async execute(ctx: MessageContext): Promise<void> {
    const slots = subBotDatabase.getOwnerSlots(ctx.sender.jid);

    if (slots.length === 0) {
      await ctx.reply('❌ No tienes subbots.\n\nUsa `.subbot <numero>` para crear una.');
      return;
    }

    const slot = slots[0];
    await ctx.react('⏳');
    try {
      await subBotManager.reconnectByOwner(ctx.sender.jid, slot.slot);
      await ctx.reply(`🔄 Slot #${slot.slot} reconectando...\n\nRecibirás el código en breve.`);
      await ctx.react('✅');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error';
      await ctx.reply(`❌ *Error:* ${msg}`);
      await ctx.react('❌');
    }
  }
}
