/**
 * CasinoCommand.ts
 *
 * economy command `casino` — Juega en el casino
 * Usage: !casino [juego] [apuesta]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { achievementService } from '@/services/rpg/AchievementService.js';

const casinoCooldowns = new Map<string, number>();
const CASINO_COOLDOWN = 30 * 1000;

interface CasinoGame {
  name: string;
  emoji: string;
  minBet: number;
  description: string;
  play: (bet: number, userMoney: number) => { won: boolean; multiplier: number; message: string };
}

const CASINO_GAMES: CasinoGame[] = [
  {
    name: 'Dados',
    emoji: '🎲',
    minBet: 100,
    description: 'Adivina si el resultado es mayor o menor que 7',
    play: (_bet: number) => {
      const roll1 = Math.floor(Math.random() * 6) + 1;
      const roll2 = Math.floor(Math.random() * 6) + 1;
      const total = roll1 + roll2;
      const choice = Math.random() > 0.5 ? 'high' : 'low';
      const result = total > 7 ? 'high' : 'low';
      const won = choice === result;
      return {
        won,
        multiplier: won ? 2 : 0,
        message: `🎲 Dados: ${roll1} + ${roll2} = ${total}\n${won ? '✨¡Ganaste!' : '💔 Perdiste'} - Elegiste: ${choice === 'high' ? 'Mayor' : 'Menor'}`,
      };
    },
  },
  {
    name: 'Ruleta',
    emoji: '🎰',
    minBet: 500,
    description: 'Apuesta a un número (1-10) o color',
    play: (_bet: number) => {
      const number = Math.floor(Math.random() * 10) + 1;
      const color = number <= 5 ? 'rojo' : 'negro';
      const choiceNum = Math.floor(Math.random() * 10) + 1;
      const choiceColor = Math.random() > 0.5 ? 'rojo' : 'negro';

      const numberMatch = number === choiceNum;
      const colorMatch = color === choiceColor;

      let won = false;
      let multiplier = 0;
      let message = `🎰 Ruleta: ${number} (${color})\n`;

      if (numberMatch) {
        won = true;
        multiplier = 10;
        message += '✨¡Número exacto! ¡Ganaste 10x!\n';
      } else if (colorMatch) {
        won = true;
        multiplier = 2;
        message += '✨¡Color correcto! ¡Ganaste 2x!\n';
      } else {
        message += '💔 No acertaste\n';
      }

      return { won, multiplier, message };
    },
  },
  {
    name: 'Carrera',
    emoji: '🏎️',
    minBet: 1000,
    description: 'Elige un auto y compite',
    play: (_bet: number) => {
      const cars = ['🔴 Rojo', '🔵 Azul', '🟢 Verde', '🟡 Amarillo'];
      const winnerIndex = Math.floor(Math.random() * 4);

      const userChoice = Math.floor(Math.random() * 4);
      const won = userChoice === winnerIndex;

      let message = `🏎️ *CARRERA DE AUTOS*\n\n`;
      cars.forEach((car, i) => {
        const finish = i === winnerIndex ? '🏁' : '  ';
        message += `${car} ${finish}\n`;
      });
      message += `\nElegiste: ${cars[userChoice]}\n`;
      message += `Ganador: ${cars[winnerIndex]}\n`;
      message += won ? '✨¡Ganaste!' : '💔 Perdiste';

      return { won, multiplier: won ? 3 : 0, message };
    },
  },
  {
    name: 'Boxeo',
    emoji: '🥊',
    minBet: 2000,
    description: 'Lucha contra la IA',
    play: (_bet: number) => {
      const playerPower = Math.floor(Math.random() * 50) + 50;
      const enemyPower = Math.floor(Math.random() * 50) + 50;

      const playerKO = Math.random() > 0.5;
      const won = playerPower > enemyPower || (playerPower === enemyPower && playerKO);

      let message = `🥊 *BOXEO*\n\n`;
      message += `👊 Tu poder: ${playerPower}\n`;
      message += `👹 Enemigo: ${enemyPower}\n\n`;
      message += won ? '✨¡GANASTE POR KO!' : '💔 Fuiste noqueado';

      return { won, multiplier: won ? 2.5 : 0, message };
    },
  },
];

/** Command handler for `!casino`: Juega en el casino. */
export class CasinoCommand extends Command {
  name = 'casino';
  description = 'Juega en el casino';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['jugar', 'gamble'];
  usage = '!casino [juego] [apuesta]';
  examples = ['!casino', '!casino dados 1000'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const gameArg = ctx.args[0]?.toLowerCase();
    const betArg = ctx.args[1];
    const bet = parseInt(betArg);

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (user.isOwner) {
      await ctx.reply(
        `🎰 *CASINO VANIA* 🎰\n\n` +
          `👑 *Dueño del Casino*\n\n` +
          `✿ Como owner, tienes acceso\n` +
          `   especial al casino.\n\n` +
          `🎮 *Juegos disponibles:*\n\n` +
          CASINO_GAMES.map(
            (g, i) =>
              `${i + 1}. ${g.emoji} *${g.name}*\n` +
              `   Apuesta mínima: $${g.minBet.toLocaleString()}\n` +
              `   ${g.description}\n`,
          ).join('\n') +
          `\n📝 *Ejemplo:*\n` +
          `!casino dados 5000`,
      );
      return;
    }

    if (!gameArg || !betArg) {
      await ctx.reply(
        `🎰 *CASINO VANIA* 🎰\n\n` +
          `✿ *Cómo jugar:*\n` +
          `Elige un juego y apuesta.\n` +
          `Si ganas, duplicas (o más).\n` +
          `Si pierdes, pierdes la apuesta.\n\n` +
          `🎮 *Juegos disponibles:*\n\n` +
          CASINO_GAMES.map(
            (g, i) =>
              `${i + 1}. ${g.emoji} *${g.name}*\n` +
              `   Apuesta mínima: $${g.minBet.toLocaleString()}\n` +
              `   ${g.description}\n`,
          ).join('\n') +
          `\n💰 *Tu dinero:* $${formatNumber(user.money)}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!casino dados 1000`,
      );
      return;
    }

    const gameIndex = parseInt(gameArg) - 1;
    const gameByName = CASINO_GAMES.find(
      g => g.name.toLowerCase() === gameArg || g.name.toLowerCase().startsWith(gameArg),
    );
    const game =
      gameByName ||
      (gameIndex >= 0 && gameIndex < CASINO_GAMES.length ? CASINO_GAMES[gameIndex] : null);

    if (!game) {
      await ctx.reply(
        `❌ *Juego no encontrado*\n\n` +
          `🎮 *Juegos disponibles:*\n\n` +
          CASINO_GAMES.map((g, i) => `${i + 1}. ${g.emoji} ${g.name}`).join('\n'),
      );
      return;
    }

    if (isNaN(bet) || bet < game.minBet) {
      await ctx.reply(
        `❌ *Apuesta inválida*\n\n` +
          `Mínimo: $${game.minBet.toLocaleString()}\n` +
          `Tu apuesta: ${betArg || 'inválida'}`,
      );
      return;
    }

    if (user.money < bet) {
      await ctx.reply(
        `❌ *No tienes suficiente dinero*\n\n` +
          `💵 Tienes: $${formatNumber(user.money)}\n` +
          `💸 Necesitas: $${formatNumber(bet)}`,
      );
      return;
    }

    const now = Date.now();
    const lastPlay = casinoCooldowns.get(ctx.sender.jid);
    if (lastPlay && now - lastPlay < CASINO_COOLDOWN) {
      const remaining = Math.ceil((CASINO_COOLDOWN - (now - lastPlay)) / 1000);
      await ctx.reply(`⏳ Espera ${remaining}s antes de jugar de nuevo`);
      return;
    }

    await serviceManager.userService.removeMoney(ctx.sender.jid, bet);

    const luckBuff = user.activeBuffs?.find(
      b => b.buffId === 'lucky_charm' && b.expiresAt > Date.now(),
    );
    const luckBonus = luckBuff ? luckBuff.value : 0;

    let result = game.play(bet, user.money);

    if (!result.won && luckBonus > 0 && Math.random() * 100 < luckBonus) {
      result = {
        won: true,
        multiplier: result.multiplier > 0 ? result.multiplier : 2,
        message: result.message + '\n🍀 ¡Suerte extra! Revirtieron el resultado',
      };
    }

    casinoCooldowns.set(ctx.sender.jid, now);

    let bonusText = '';
    if (luckBuff) {
      bonusText = `\n🍀 *BONUS:* +${luckBuff.value}% suerte`;
    }

    if (result.won) {
      const reward = Math.floor(bet * result.multiplier);
      await serviceManager.userService.addMoney(ctx.sender.jid, reward);
      const profit = reward - bet;

      await achievementService.trackCasino(ctx.sender.jid, true);
      await achievementService.checkMoneyAchievements(ctx.sender.jid);

      await ctx.reply(
        `🎰 *${game.emoji} ${game.name.toUpperCase()}* 🎰\n\n` +
          `${result.message}\n\n` +
          `💰 *APUESTA:* $${formatNumber(bet)}\n` +
          `✨ *GANANCIA:* $${formatNumber(profit)}${bonusText}\n` +
          `💵 *NUEVO BALANCE:* $${formatNumber((await serviceManager.userService.getUser(ctx.sender.jid)).money)}`,
      );
      await ctx.react('🎉');
    } else {
      await achievementService.trackCasino(ctx.sender.jid, false);

      await ctx.reply(
        `🎰 *${game.emoji} ${game.name.toUpperCase()}* 🎰\n\n` +
          `${result.message}\n\n` +
          `💸 *PERDIDA:* $${formatNumber(bet)}\n` +
          `💵 *BALANCE:* $${formatNumber((await serviceManager.userService.getUser(ctx.sender.jid)).money)}${bonusText}`,
      );
      await ctx.react('💔');
    }
  }
}
