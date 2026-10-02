/**
 * BegCommand.ts
 *
 * economy command `beg` — Pide limosna (sin cooldown)
 * Usage: !beg
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';

/** Command handler for `!beg`: Pide limosna (sin cooldown). */
export class BegCommand extends Command {
  name = 'beg';
  description = 'Pide limosna (sin cooldown)';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['limosna', 'pide'];
  usage = '!beg';
  cooldown = 0;

  private readonly RESPONSES = [
    { text: 'te da unas monedas', min: 10, max: 50, emoji: '💕' },
    { text: 'te mira mal y te da nada', min: 0, max: 0, emoji: '😒' },
    { text: 'te da una moneda', min: 1, max: 5, emoji: '🪙' },
    { text: 'te da все', min: 50, max: 100, emoji: '🥺' },
    { text: 'te ignora', min: 0, max: 0, emoji: '🚶' },
    { text: 'te da una按摩', min: 20, max: 80, emoji: '💆' },
    { text: 'te da un abrazo', min: 5, max: 25, emoji: '🤗' },
    { text: 'te da monedas de oro', min: 100, max: 200, emoji: '✨' },
    { text: 'te da poco', min: 1, max: 10, emoji: '😐' },
    { text: 'se compadece de ti', min: 25, max: 75, emoji: '🥹' },
  ];

  private readonly PEOPLE = [
    'Un random',
    'Tu mama',
    'El vecino',
    'Un rico',
    'Bill Gates',
    'El presidente',
    'Un extraterrestre',
    'Tu ex',
    'El casino',
    'El banco',
    'Santa Claus',
    'Un ninja',
    'El lechero',
    'Spiderman',
    'Batman',
    'Iron Man',
    'Thor',
    'Hulk',
    'El abuelo',
    'La abuela',
    'El mercader',
    'Un goblin',
    'El rey',
    'La reina',
    'El dragon',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const response = this.RESPONSES[Math.floor(Math.random() * this.RESPONSES.length)];
    const person = this.PEOPLE[Math.floor(Math.random() * this.PEOPLE.length)];

    let earned = 0;

    if (response.min > 0) {
      earned = Math.floor(Math.random() * (response.max - response.min + 1)) + response.min;
      await serviceManager.userService.addMoney(ctx.sender.jid, earned);
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);

    let message = `🙇 *PIDIENDO LIMOSNA* 🙇\n\n`;
    message += `${person} ${response.text}...\n\n`;

    if (earned > 0) {
      message += `✨ *GANASTE!*\n`;
      message += `💰 +$${formatNumber(earned)}\n\n`;
    } else {
      message += `💔 *No ganaste nada...*\n\n`;
    }

    message += `💵 Balance: $${formatNumber(user.money)}`;

    await ctx.reply(message);
    await ctx.react(response.emoji);
  }
}
