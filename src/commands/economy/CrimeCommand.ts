/**
 * CrimeCommand.ts
 *
 * economy command `crime` — Comete delitos para ganar dinero
 * Usage: !crime [tipo] [@user]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { achievementService } from '@/services/rpg/AchievementService.js';

const crimeCooldowns = new Map<string, number>();
const CRIME_COOLDOWN = 3 * 60 * 1000;
const CARDING_COOLDOWN = 10 * 60 * 1000;
const HACK_BANK_COOLDOWN = 30 * 60 * 1000;

interface CrimeType {
  name: string;
  minLevel: number;
  minMoney: number;
  min: number;
  max: number;
  emoji: string;
  success: number;
  jailChance: number;
  fineMultiplier: number;
}

const CRIMES: CrimeType[] = [
  {
    name: 'carterista',
    minLevel: 1,
    minMoney: 0,
    min: 500,
    max: 2000,
    emoji: '👜',
    success: 0.6,
    jailChance: 0.05,
    fineMultiplier: 0.5,
  },
  {
    name: 'asaltante',
    minLevel: 5,
    minMoney: 1000,
    min: 2000,
    max: 5000,
    emoji: '🔫',
    success: 0.45,
    jailChance: 0.1,
    fineMultiplier: 0.7,
  },
  {
    name: 'hacker',
    minLevel: 10,
    minMoney: 5000,
    min: 5000,
    max: 15000,
    emoji: '💻',
    success: 0.35,
    jailChance: 0.15,
    fineMultiplier: 1.0,
  },
  {
    name: 'secuestrador',
    minLevel: 20,
    minMoney: 15000,
    min: 15000,
    max: 30000,
    emoji: '👺',
    success: 0.25,
    jailChance: 0.25,
    fineMultiplier: 1.5,
  },
  {
    name: 'cartel',
    minLevel: 30,
    minMoney: 30000,
    min: 30000,
    max: 100000,
    emoji: '💊',
    success: 0.15,
    jailChance: 0.35,
    fineMultiplier: 2.0,
  },
];

const CARDING: CrimeType = {
  name: 'carding',
  minLevel: 15,
  minMoney: 10000,
  min: 10000,
  max: 50000,
  emoji: '💳',
  success: 0.25,
  jailChance: 0.4,
  fineMultiplier: 2.5,
};

const HACK_BANK: CrimeType = {
  name: 'hack_banco',
  minLevel: 25,
  minMoney: 25000,
  min: 50000,
  max: 500000,
  emoji: '🏦',
  success: 0.1,
  jailChance: 0.5,
  fineMultiplier: 3.0,
};

/** Command handler for `!crime`: Comete delitos para ganar dinero. */
export class CrimeCommand extends Command {
  name = 'crime';
  description = 'Comete delitos para ganar dinero';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['robar', 'steal', 'delito'];
  usage = '!crime [tipo] [@user]';
  examples = ['!crime', '!crime carding', '!crime hack'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const typeArg = ctx.args[0]?.toLowerCase();
    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!typeArg || typeArg === 'lista' || typeArg === 'info') {
      await this.showCrimeList(ctx, user);
      return;
    }

    switch (typeArg) {
      case 'carding':
      case 'card':
        await this.doCarding(ctx, user);
        break;
      case 'hack':
      case 'hackbanco':
      case 'banco':
        await this.doHackBank(ctx, user);
        break;
      default:
        await this.doNormalCrime(ctx, user);
    }
  }

  private async showCrimeList(
    ctx: MessageContext,
    user: { level: number; money: number },
  ): Promise<void> {
    let message = `🚨 *ZONA DE DELITOS* 🚨\n\n`;
    message += `📊 *Tu nivel:* ${user.level} | *Tu dinero:* $${formatNumber(user.money)}\n\n`;
    message += `📋 *Delitos disponibles:*\n\n`;

    const availableCrimes = CRIMES.filter(
      c => c.minLevel <= user.level && c.minMoney <= user.money,
    );
    const lockedCrimes = CRIMES.filter(c => c.minLevel > user.level || c.minMoney > user.money);

    availableCrimes.forEach((crime, i) => {
      message += `${i + 1}. ${crime.emoji} *${crime.name.toUpperCase()}*\n`;
      message += `   💰 Ganancia: $${crime.min.toLocaleString()} - $${crime.max.toLocaleString()}\n`;
      message += `   📈 Éxito: ${Math.round(crime.success * 100)}%\n`;
      message += `   🏚️ Cárcel: ${Math.round(crime.jailChance * 100)}%\n\n`;
    });

    if (CARDING.minLevel <= user.level && CARDING.minMoney <= user.money) {
      message += `💳 *CARDING*\n`;
      message += `   💰 Ganancia: $${CARDING.min.toLocaleString()} - $${CARDING.max.toLocaleString()}\n`;
      message += `   📈 Éxito: ${Math.round(CARDING.success * 100)}%\n`;
      message += `   🏚️ Cárcel: ${Math.round(CARDING.jailChance * 100)}%\n\n`;
    } else {
      message += `💳 🔒 Carding (Nivel ${CARDING.minLevel}+)\n\n`;
    }

    if (HACK_BANK.minLevel <= user.level && HACK_BANK.minMoney <= user.money) {
      message += `🏦 *HACK AL BANCO*\n`;
      message += `   💰 Ganancia: $${HACK_BANK.min.toLocaleString()} - $${HACK_BANK.max.toLocaleString()}\n`;
      message += `   📈 Éxito: ${Math.round(HACK_BANK.success * 100)}%\n`;
      message += `   🏚️ Cárcel: ${Math.round(HACK_BANK.jailChance * 100)}%\n\n`;
    } else {
      message += `🏦 🔒 Hack Banco (Nivel ${HACK_BANK.minLevel}+)\n\n`;
    }

    if (lockedCrimes.length > 0) {
      message += `🔒 *Delitos bloqueados:*\n`;
      lockedCrimes.forEach(c => {
        const reason = c.minLevel > user.level ? `Nivel ${c.minLevel}` : `$${c.minMoney}`;
        message += `• ${c.emoji} ${c.name} (${reason})\n`;
      });
    }

    message += `\n📝 *Usa:* !crime [@usuario] para robar\n`;
    message += `💡 *Tip:* Guarda dinero en el banco para no ser robado`;

    await ctx.reply(message);
  }

  private async doNormalCrime(
    ctx: MessageContext,
    user: { level: number; money: number; jid: string },
  ): Promise<void> {
    const now = Date.now();
    const lastCrime = crimeCooldowns.get(user.jid);

    if (lastCrime && now - lastCrime < CRIME_COOLDOWN) {
      const remaining = Math.ceil((CRIME_COOLDOWN - (now - lastCrime)) / 60000);
      await ctx.reply(
        `🚨 *EN COOLDOWN*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a robar.`,
      );
      return;
    }

    const mentionedJid = ctx.mentionedJid;

    if (!mentionedJid) {
      await ctx.reply(
        `🚨 *ROBAR* 🚨\n\n` +
          `✿ *Cómo usar:*\n` +
          `!crime @usuario\n\n` +
          `📊 *Información:*\n` +
          `• Los owners no pueden ser robados\n` +
          `• El dinero en el banco está seguro\n` +
          `• Cooldown: 3 minutos\n\n` +
          `📝 *Ejemplo:*\n` +
          `!crime @usuario`,
      );
      return;
    }

    const attacker = await serviceManager.userService.getUser(user.jid);
    const victim = await serviceManager.userService.getUser(mentionedJid);

    if (attacker.jid === mentionedJid) {
      await ctx.reply(`❌ No puedes robarte a ti mismo`);
      return;
    }

    if (victim.isOwner) {
      await ctx.reply(
        `🚨 *PROTEGIDO*\n\n` +
          `❌ No puedes robar a un *OWNER*\n\n` +
          `🛡️ Los owners están protegidos`,
      );
      return;
    }

    if (victim.isBanned) {
      await ctx.reply(`❌ El usuario está baneado`);
      return;
    }

    const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
    const success = Math.random() < crime.success;

    const victimMoney = victim.money;
    const victimBank = victim.bank || 0;

    if (success && victimMoney > 0) {
      const maxSteal = Math.min(crime.max, victimMoney);
      const earned = Math.floor(Math.random() * (maxSteal - crime.min + 1)) + crime.min;
      const actualSteal = Math.min(earned, victimMoney);

      await serviceManager.userService.removeMoney(mentionedJid, actualSteal);
      await serviceManager.userService.addMoney(attacker.jid, actualSteal);

      crimeCooldowns.set(attacker.jid, now);

      const newAchievements = await achievementService.trackCrime(attacker.jid, true, actualSteal);
      if (newAchievements.length > 0) {
        await achievementService.checkLevelAchievements(attacker.jid);
        await achievementService.checkMoneyAchievements(attacker.jid);
      }

      await ctx.reply(
        `🚨 *ROBO EXITOSO* 🚨\n\n` +
          `${crime.emoji} *${crime.name.toUpperCase()}*\n\n` +
          `🎯 *Robaste a:* ${victim.name}\n` +
          `✨ *GANASTE!*\n` +
          `💰 +$${formatNumber(actualSteal)}\n\n` +
          `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n` +
          `💵 Tu balance: $${formatNumber((await serviceManager.userService.getUser(attacker.jid)).money)}`,
      );
      await ctx.react('🎉');
    } else {
      crimeCooldowns.set(attacker.jid, now);

      let msg = `🚨 *ROBO FALLIDO* 🚨\n\n`;
      msg += `${crime.emoji} *${crime.name.toUpperCase()}*\n\n`;

      if (victimMoney <= 0 && victimBank <= 0) {
        msg += `💔 *La víctima no tiene dinero*\n`;
        msg += `(Todo está en el banco)\n\n`;
      } else {
        msg += `💔 *Te atraparon!*\n\n`;
      }

      msg += `📊 Éxito: ${Math.round(crime.success * 100)}%\n\n`;
      msg += `💡 *Tip:* Guarda dinero en el banco con !deposit`;

      await achievementService.trackCrime(attacker.jid, false);

      await ctx.reply(msg);
      await ctx.react('🚨');
    }
  }

  private async doCarding(
    ctx: MessageContext,
    user: { level: number; money: number; jid: string },
  ): Promise<void> {
    const now = Date.now();
    const lastCarding = crimeCooldowns.get(user.jid + '_carding');

    if (lastCarding && now - lastCarding < CARDING_COOLDOWN) {
      const remaining = Math.ceil((CARDING_COOLDOWN - (now - lastCarding)) / 60000);
      await ctx.reply(
        `💳 *CARDING EN COOLDOWN*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de volver a usar tarjetas.`,
      );
      return;
    }

    if (user.level < CARDING.minLevel) {
      await ctx.reply(
        `💳 *CARDING BLOQUEADO*\n\n` +
          `Necesitas nivel *${CARDING.minLevel}*\n` +
          `Tu nivel: ${user.level}`,
      );
      return;
    }

    if (user.money < CARDING.minMoney) {
      await ctx.reply(
        `💳 *FONDOS INSUFICIENTES*\n\n` +
          `Necesitas $${formatNumber(CARDING.minMoney)}\n` +
          `para operar con tarjetas.\n\n` +
          `Tu dinero: $${formatNumber(user.money)}`,
      );
      return;
    }

    const success = Math.random() < CARDING.success;
    const jail = Math.random() < CARDING.jailChance;

    if (success) {
      const earned = Math.floor(Math.random() * (CARDING.max - CARDING.min + 1)) + CARDING.min;

      await serviceManager.userService.addMoney(user.jid, earned);
      crimeCooldowns.set(user.jid + '_carding', now);

      await ctx.reply(
        `💳 *CARDING EXITOSO* 💳\n\n` +
          `✨ *Operación exitosa!*\n\n` +
          `💰 *GANASTE:* $${formatNumber(earned)}\n\n` +
          `📊 Éxito: ${Math.round(CARDING.success * 100)}%\n` +
          `🏚️ Riesgo de cárcel: ${Math.round(CARDING.jailChance * 100)}%\n\n` +
          `💵 Balance: $${formatNumber((await serviceManager.userService.getUser(user.jid)).money)}`,
      );
      await ctx.react('💳');
    } else {
      crimeCooldowns.set(user.jid + '_carding', now);

      if (jail) {
        const fine = Math.floor(user.money * CARDING.fineMultiplier);
        await serviceManager.userService.removeMoney(user.jid, Math.min(fine, user.money));

        await ctx.reply(
          `💳 *CARDING FALLIDO* 💳\n\n` +
            `🚨 *FUESTE ATRAPADO!*\n\n` +
            `🏚️ *Te envían a la cárcel*\n\n` +
            `💸 *Multa:* $${formatNumber(fine)}\n\n` +
            `📊 Éxito: ${Math.round(CARDING.success * 100)}%\n\n` +
            `💡 *Tip:* Usa métodos más seguros`,
        );
        await ctx.react('🚨');
      } else {
        await ctx.reply(
          `💳 *CARDING FALLIDO* 💳\n\n` +
            `💔 *La transacción fue rechazada*\n\n` +
            `📊 Éxito: ${Math.round(CARDING.success * 100)}%\n` +
            `🏚️ Riesgo de cárcel: ${Math.round(CARDING.jailChance * 100)}%\n\n` +
            `Intenta de nuevo en 10 minutos`,
        );
        await ctx.react('💔');
      }
    }
  }

  private async doHackBank(
    ctx: MessageContext,
    user: { level: number; money: number; jid: string },
  ): Promise<void> {
    const now = Date.now();
    const lastHack = crimeCooldowns.get(user.jid + '_hack');

    if (lastHack && now - lastHack < HACK_BANK_COOLDOWN) {
      const remaining = Math.ceil((HACK_BANK_COOLDOWN - (now - lastHack)) / 60000);
      await ctx.reply(
        `🏦 *HACK EN COOLDOWN*\n\n` +
          `Debes esperar *${remaining} minutos*\n` +
          `antes de intentar otro hack.`,
      );
      return;
    }

    if (user.level < HACK_BANK.minLevel) {
      await ctx.reply(
        `🏦 *HACK BLOQUEADO*\n\n` +
          `Necesitas nivel *${HACK_BANK.minLevel}*\n` +
          `Tu nivel: ${user.level}`,
      );
      return;
    }

    if (user.money < HACK_BANK.minMoney) {
      await ctx.reply(
        `🏦 *FONDOS INSUFICIENTES*\n\n` +
          `Necesitas $${formatNumber(HACK_BANK.minMoney)}\n` +
          `para planificar el hack.\n\n` +
          `Tu dinero: $${formatNumber(user.money)}`,
      );
      return;
    }

    const success = Math.random() < HACK_BANK.success;
    const jail = Math.random() < HACK_BANK.jailChance;

    if (success) {
      const earned =
        Math.floor(Math.random() * (HACK_BANK.max - HACK_BANK.min + 1)) + HACK_BANK.min;

      await serviceManager.userService.addMoney(user.jid, earned);
      crimeCooldowns.set(user.jid + '_hack', now);

      await ctx.reply(
        `🏦 *HACK EXITOSO!* 🏦\n\n` +
          `🎉 *¡ROBATES EL BANCO!*\n\n` +
          `💰 *GANASTE:* $${formatNumber(earned)}\n\n` +
          `📊 Éxito: ${Math.round(HACK_BANK.success * 100)}%\n` +
          `🏚️ Riesgo de cárcel: ${Math.round(HACK_BANK.jailChance * 100)}%\n\n` +
          `💵 Balance: $${formatNumber((await serviceManager.userService.getUser(user.jid)).money)}`,
      );
      await ctx.react('🏦');
    } else {
      crimeCooldowns.set(user.jid + '_hack', now);

      if (jail) {
        const fine = Math.floor(user.money * HACK_BANK.fineMultiplier);
        await serviceManager.userService.removeMoney(user.jid, Math.min(fine, user.money));

        await ctx.reply(
          `🏦 *HACK FALLIDO* 🏦\n\n` +
            `🚨 *FUESTE ATRAPADO!*\n\n` +
            `🏚️ *TE ATRAPARON LAS AUTORIDADES!*\n\n` +
            `💸 *Multa:* $${formatNumber(fine)}\n\n` +
            `📊 Éxito: ${Math.round(HACK_BANK.success * 100)}%\n\n` +
            `💡 *La próxima vez sé más cuidadoso...*`,
        );
        await ctx.react('🚨');
      } else {
        await ctx.reply(
          `🏦 *HACK FALLIDO* 🏦\n\n` +
            `💔 *El sistema te detectó*\n\n` +
            `📊 Éxito: ${Math.round(HACK_BANK.success * 100)}%\n` +
            `🏚️ Riesgo de cárcel: ${Math.round(HACK_BANK.jailChance * 100)}%\n\n` +
            `Intenta de nuevo en 30 minutos`,
        );
        await ctx.react('💔');
      }
    }
  }
}
