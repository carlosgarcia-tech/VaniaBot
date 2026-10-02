/**
 * BlackjackCommand.ts
 *
 * game command `blackjack` — Juega blackjack contra el bot
 * Usage: !blackjack <cantidad> [hit|stand]
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { validateBetAmount } from '@/utils/validators.js';
import { config } from '@/config/index.js';
import { logError } from '@/utils/logger.js';

interface BlackjackGame {
  playerCards: number[];
  dealerCards: number[];
  bet: number;
  status: 'playing' | 'won' | 'lost' | 'push' | 'blackjack';
}

const activeGames = new Map<string, BlackjackGame>();

/** Command handler for `!blackjack`: Juega blackjack contra el bot. */
export class BlackjackCommand extends Command {
  name = 'blackjack';
  description = 'Juega blackjack contra el bot';
  category = CommandCategory.GAME;
  requiresRegistration = true;
  aliases = ['bj', 'blackjack'];
  usage = '!blackjack <cantidad> [hit|stand]';
  examples = ['!blackjack 500', '!blackjack 500 hit', '!blackjack 500 stand'];
  cooldown = 5000;
  parallelizable = true;

  private readonly SUITS = ['♠️', '♥️', '♦️', '♣️'];
  private readonly VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  private getCardValue(cardIndex: number): number {
    const value = cardIndex % 13;
    if (value >= 9) return 10;
    return value + 1;
  }

  private getCardDisplay(cardIndex: number): string {
    const suit = this.SUITS[Math.floor(cardIndex / 13)];
    const value = this.VALUES[cardIndex % 13];
    return `${value}${suit}`;
  }

  private calculateScore(cards: number[]): { score: number; isSoft: boolean } {
    let score = 0;
    let aces = 0;

    for (const card of cards) {
      const value = this.getCardValue(card);
      score += value;
      if (value === 1) aces++;
    }

    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }

    return { score, isSoft: aces > 0 && score <= 21 };
  }

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase();
    const amountOrAction = ctx.args[1];
    const amount = parseInt(amountOrAction);

    const existingGame = activeGames.get(ctx.sender.jid);

    if (
      existingGame &&
      action !== 'hit' &&
      action !== 'stand' &&
      action !== 'hit' &&
      action !== 'stand' &&
      isNaN(amount)
    ) {
      await ctx.reply(
        `🃏 *BLACKJACK*\n\n` +
          `Ya tienes un juego activo!\n\n` +
          `Tus cartas: ${existingGame.playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `Puntaje: ${this.calculateScore(existingGame.playerCards).score}\n\n` +
          `✿ *Acciones:*\n` +
          `!blackjack ${existingGame.bet} hit  - Tomar carta\n` +
          `!blackjack ${existingGame.bet} stand - Quedarse`,
      );
      return;
    }

    if (action === 'hit' && existingGame) {
      const newCard = Math.floor(Math.random() * 52);
      existingGame.playerCards.push(newCard);

      const playerScore = this.calculateScore(existingGame.playerCards);

      if (playerScore.score > 21) {
        existingGame.status = 'lost';

        if (!existingGame.bet || !ctx.sender.jid.startsWith('0')) {
          try {
            await serviceManager.userService.removeMoney(ctx.sender.jid, existingGame.bet);
          } catch (error) {
            logError('[Blackjack]', error);
          }
        }

        activeGames.delete(ctx.sender.jid);

        const dealerScore = this.calculateScore(existingGame.dealerCards);

        await ctx.reply(
          `🃏 *BLACKJACK* 🃏\n\n` +
            `📊 *Resultados:*\n\n` +
            `✿ *Tus cartas:* ${existingGame.playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
            `📈 Tu puntaje: ${playerScore.score}\n\n` +
            `🤖 *Cartas del dealer:* ${existingGame.dealerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
            `📉 Dealer: ${dealerScore.score}\n\n` +
            `💔 *TE PASASTE! PERDISTE*\n` +
            `💰 Perdiste: $${existingGame.bet.toLocaleString()}`,
        );
        await ctx.react('💔');
        return;
      }

      await ctx.reply(
        `🃏 *BLACKJACK* 🃏\n\n` +
          `📊 *Tu mano:* ${existingGame.playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `📈 Puntaje: ${playerScore.score}${playerScore.isSoft ? ' (Soft)' : ''}\n\n` +
          `✿ *Acciones:*\n` +
          `!blackjack ${existingGame.bet} hit  - Tomar carta\n` +
          `!blackjack ${existingGame.bet} stand - Quedarse`,
      );
      return;
    }

    if (action === 'stand' && existingGame) {
      const dealerCards = [...existingGame.dealerCards];

      while (this.calculateScore(dealerCards).score < 17) {
        dealerCards.push(Math.floor(Math.random() * 52));
      }

      const dealerScore = this.calculateScore(dealerCards).score;
      const playerScore = this.calculateScore(existingGame.playerCards).score;

      let won = false;
      let multiplier = 2;
      let resultText = '';

      if (dealerScore > 21) {
        won = true;
        resultText = '💰 *EL DEALER SE PASA! GANASTE!*';
      } else if (playerScore > dealerScore) {
        won = true;
        resultText = '✨ *GANASTE!*';
      } else if (playerScore < dealerScore) {
        won = false;
        resultText = '💔 *PERDISTE*';
      } else {
        multiplier = 1;
        resultText = '🤝 *EMPATE!*';
      }

      const winAmount = won ? Math.floor(existingGame.bet * multiplier) : 0;
      const profit = winAmount - existingGame.bet;

      if (!ctx.sender.jid.startsWith('0')) {
        try {
          if (profit > 0) {
            await serviceManager.userService.addMoney(ctx.sender.jid, profit);
          } else if (profit < 0) {
            await serviceManager.userService.removeMoney(ctx.sender.jid, existingGame.bet);
          }
        } catch (error) {
          logError('[Blackjack]', error);
        }
      }

      activeGames.delete(ctx.sender.jid);

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `🃏 *BLACKJACK* 🃏\n\n` +
          `📊 *Resultados:*\n\n` +
          `✿ *Tus cartas:* ${existingGame.playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `📈 Tu puntaje: ${playerScore}\n\n` +
          `🤖 *Cartas del dealer:* ${dealerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `📉 Dealer: ${dealerScore}\n\n` +
          `${resultText}\n` +
          `💰 Apuesta: $${existingGame.bet.toLocaleString()}\n` +
          (won
            ? `🎉 Ganaste: $${winAmount.toLocaleString()}`
            : multiplier === 1
              ? `💰 Devuelta: $${existingGame.bet.toLocaleString()}`
              : `💸 Perdiste: $${existingGame.bet.toLocaleString()}`) +
          `\n\n💵 Balance: $${updatedUser.money.toLocaleString()}`,
      );
      await ctx.react(won ? '🎉' : multiplier === 1 ? '🤝' : '💔');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(
        `🃏 *BLACKJACK* 🃏\n\n` +
          `✿ *Cómo jugar:*\n` +
          `!blackjack <cantidad>\n\n` +
          `📊 *Reglas:*\n` +
          `• Llega a 21 o más cerca para ganar\n` +
          `• El dealer se planta en 17\n` +
          `• Blackjack (A+10) paga 2.5x\n` +
          `• 21 normal paga 2x\n\n` +
          `💰 Límites: $${config.economy.minBet} - $${config.economy.maxBet.toLocaleString()}\n\n` +
          `📝 *Ejemplo:*\n` +
          `!blackjack 500`,
      );
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    if (!user.isOwner) {
      if (user.money < amount) {
        const bankBalance = user.bank || 0;
        if (bankBalance > 0) {
          await ctx.reply(
            `❌ *No tienes efectivo suficiente*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `🏦 Banco: $${bankBalance.toLocaleString()}\n\n` +
              `✿ *Retira dinero primero:*\n` +
              `!withdraw ${amount - user.money}`,
          );
        } else {
          await ctx.reply(
            `❌ *No tienes suficiente dinero*\n\n` +
              `💵 Efectivo: $${user.money.toLocaleString()}\n` +
              `💸 Necesitas: $${amount.toLocaleString()}`,
          );
        }
        return;
      }

      const validation = validateBetAmount(amount, user.money, {
        minBet: config.economy.minBet,
        maxBet: config.economy.maxBet,
      });

      if (!validation.valid) {
        await ctx.reply(validation.error || '❌ Apuesta inválida');
        return;
      }
    }

    const playerCards = [Math.floor(Math.random() * 52), Math.floor(Math.random() * 52)];
    const dealerCards = [Math.floor(Math.random() * 52), Math.floor(Math.random() * 52)];

    const playerScore = this.calculateScore(playerCards);
    const dealerScore = this.calculateScore(dealerCards);

    const isBlackjack = playerScore.score === 21 && playerCards.length === 2;
    const dealerBlackjack = dealerScore.score === 21 && dealerCards.length === 2;

    if (isBlackjack && dealerBlackjack) {
      const game: BlackjackGame = {
        playerCards,
        dealerCards,
        bet: amount,
        status: 'push',
      };
      activeGames.set(ctx.sender.jid, game);

      await ctx.reply(
        `🃏 *BLACKJACK* 🃏\n\n` +
          `📊 *Resultados:*\n\n` +
          `✿ *Tus cartas:* ${playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `🤖 *Del dealer:* ${dealerCards.map(c => this.getCardDisplay(c)).join(' ')}\n\n` +
          `🤝 *AMBOS TIENEN BLACKJACK! EMPATE!*`,
      );
      await ctx.react('🤝');
      activeGames.delete(ctx.sender.jid);
      return;
    }

    if (isBlackjack) {
      const winAmount = Math.floor(amount * 2.5);

      if (!user.isOwner) {
        await serviceManager.userService.addMoney(ctx.sender.jid, winAmount - amount);
      }

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `🃏 *BLACKJACK!* 🃏\n\n` +
          `📊 *BLACKJACK NATURAL!*\n\n` +
          `✿ *Tus cartas:* ${playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `📈 Puntaje: 21\n\n` +
          `🎉 *GANASTE!*\n` +
          `💰 Apuesta: $${amount.toLocaleString()}\n` +
          `🎊 Payout: $${winAmount.toLocaleString()}\n` +
          `✨ Profit: +$${(winAmount - amount).toLocaleString()}\n\n` +
          `💵 Balance: $${updatedUser.money.toLocaleString()}`,
      );
      await ctx.react('🎉');
      return;
    }

    if (dealerBlackjack) {
      if (!user.isOwner) {
        await serviceManager.userService.removeMoney(ctx.sender.jid, amount);
      }

      const updatedUser = await serviceManager.userService.getUser(ctx.sender.jid);

      await ctx.reply(
        `🃏 *BLACKJACK* 🃏\n\n` +
          `📊 *Resultados:*\n\n` +
          `✿ *Tus cartas:* ${playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
          `🤖 *Del dealer:* ${dealerCards.map(c => this.getCardDisplay(c)).join(' ')}\n\n` +
          `💔 *EL DEALER TIENE BLACKJACK! PERDISTE*\n` +
          `💸 Perdiste: $${amount.toLocaleString()}\n\n` +
          `💵 Balance: $${updatedUser.money.toLocaleString()}`,
      );
      await ctx.react('💔');
      return;
    }

    const game: BlackjackGame = {
      playerCards,
      dealerCards,
      bet: amount,
      status: 'playing',
    };
    activeGames.set(ctx.sender.jid, game);

    await ctx.reply(
      `🃏 *BLACKJACK* 🃏\n\n` +
        `📊 *Tu mano:* ${playerCards.map(c => this.getCardDisplay(c)).join(' ')}\n` +
        `📈 Puntaje: ${playerScore.score}${playerScore.isSoft ? ' (Soft)' : ''}\n\n` +
        `🤖 *Del dealer:* ${this.getCardDisplay(dealerCards[0])} 🔒\n\n` +
        `✿ *Acciones:*\n` +
        `!blackjack ${amount} hit  - Tomar carta\n` +
        `!blackjack ${amount} stand - Quedarte`,
    );
  }
}
