import path from 'path';
import { Command } from '../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { serviceManager } from '@/services/system/Servicemanager.js';
import { formatNumber } from '@/utils/helpers.js';
import { JsonFileStore } from '@/utils/JsonFileStore.js';

interface LotteryTicket {
  number: string;
  buyerJid: string;
  buyerName: string;
  purchasedAt: number;
}

interface LotteryState {
  tickets: LotteryTicket[];
  prizePool: number;
  lastDraw: number;
  ticketPrice: number;
}

const LOTTERY_CONFIG = {
  ticketPrice: 1000,
  prizeMultiplier: 0.8,
  maxTickets: 100,
  drawInterval: 7 * 24 * 60 * 60 * 1000,
};

function validateLotteryState(data: unknown): LotteryState {
  const raw = (data ?? {}) as Partial<LotteryState>;
  const tickets = Array.isArray(raw.tickets)
    ? raw.tickets.filter(
        (t): t is LotteryTicket =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as LotteryTicket).number === 'string' &&
          typeof (t as LotteryTicket).buyerJid === 'string' &&
          typeof (t as LotteryTicket).buyerName === 'string' &&
          typeof (t as LotteryTicket).purchasedAt === 'number',
      )
    : [];
  return {
    tickets,
    prizePool:
      typeof raw.prizePool === 'number' && Number.isFinite(raw.prizePool) && raw.prizePool >= 0
        ? raw.prizePool
        : 0,
    lastDraw:
      typeof raw.lastDraw === 'number' && Number.isFinite(raw.lastDraw) && raw.lastDraw >= 0
        ? raw.lastDraw
        : 0,
    ticketPrice:
      typeof raw.ticketPrice === 'number' && Number.isFinite(raw.ticketPrice) && raw.ticketPrice > 0
        ? raw.ticketPrice
        : LOTTERY_CONFIG.ticketPrice,
  };
}

const lotteryStore = new JsonFileStore<LotteryState>({
  filePath: path.join(process.cwd(), 'data', 'lottery.json'),
  defaults: () => ({
    tickets: [],
    prizePool: 0,
    lastDraw: 0,
    ticketPrice: LOTTERY_CONFIG.ticketPrice,
  }),
  validate: validateLotteryState,
});

/** Estado persistido: sobrevive reinicios (el sorteo es por wall-clock). */
const lotteryState: LotteryState = lotteryStore.load();

function persistLotteryState(): void {
  try {
    lotteryStore.save(lotteryState);
  } catch {
    // JsonFileStore ya logueó el error: el juego continúa con el estado en memoria.
  }
}

function generateTicketNumber(): string {
  return Math.random().toString().substring(2, 7).toUpperCase();
}

export class LotteryCommand extends Command {
  name = 'loteria';
  description = 'Compra tickets de lotería';
  category = CommandCategory.ECONOMY;
  requiresRegistration = true;
  aliases = ['lottery', 'ticket', 'sorteo'];
  usage = '!loteria [comprar|estado|resultado|reiniciar]';
  examples = ['!loteria comprar 5', '!loteria estado'];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const action = ctx.args[0]?.toLowerCase() || 'estado';
    // Solo el valor omitido defaultea a 1: un '0' explícito se rechaza abajo
    const parsedAmount = parseInt(ctx.args[1]);
    const amount = Number.isNaN(parsedAmount) ? 1 : parsedAmount;

    switch (action) {
      case 'comprar':
      case 'buy':
        await this.buyTickets(ctx, amount);
        break;
      case 'estado':
      case 'status':
      case 'info':
        await this.showStatus(ctx);
        break;
      case 'resultado':
      case 'draw':
        if (ctx.sender.isOwner) {
          await this.drawLottery(ctx);
        }
        break;
      case 'reiniciar':
      case 'reset':
        if (ctx.sender.isOwner) {
          await this.resetLottery(ctx);
        }
        break;
      default:
        await ctx.reply(
          `🎫 *LOTERÍA VANIA* 🎫\n\n` +
            `✿ *Cómo funciona:*\n` +
            `Compra tickets y participa\n` +
            `en el sorteo semanal.\n\n` +
            `💰 *Premio:* 80% del pozo total\n\n` +
            `🎮 *Comandos:*\n\n` +
            `• !loteria comprar [cantidad]\n` +
            `• !loteria estado\n\n` +
            `💵 *Precio por ticket:* $${LOTTERY_CONFIG.ticketPrice.toLocaleString()}`,
        );
    }
  }

  private async buyTickets(ctx: MessageContext, amount: number): Promise<void> {
    if (amount < 1 || amount > 10) {
      await ctx.reply(`❌ *Cantidad inválida*\n\nMáximo 10 tickets por compra`);
      return;
    }

    const user = await serviceManager.userService.getUser(ctx.sender.jid);
    const totalCost = amount * LOTTERY_CONFIG.ticketPrice;

    if (user.money < totalCost) {
      await ctx.reply(
        `❌ *No tienes suficiente dinero*\n\n` +
          `💵 Tienes: $${formatNumber(user.money)}\n` +
          `💸 Costo: $${formatNumber(totalCost)} (${amount} tickets)`,
      );
      return;
    }

    if (lotteryState.tickets.length >= LOTTERY_CONFIG.maxTickets) {
      await ctx.reply(`❌ *Ya no hay tickets disponibles*\n\nEl sorteo está completo`);
      return;
    }

    const availableSlots = LOTTERY_CONFIG.maxTickets - lotteryState.tickets.length;
    const ticketsToBuy = Math.min(amount, availableSlots);

    if (ticketsToBuy < amount) {
      await ctx.reply(
        `⚠️ *Solo hay ${availableSlots} tickets disponibles*\n\n` +
          `Se comprarán ${ticketsToBuy} tickets`,
      );
    }

    // Solo se cobra lo efectivamente comprado: si quedaban menos slots
    // libres que tickets pedidos, cobrar el total perdería dinero del usuario.
    const actualCost = ticketsToBuy * LOTTERY_CONFIG.ticketPrice;
    await serviceManager.userService.removeMoney(ctx.sender.jid, actualCost);

    const purchasedTickets: string[] = [];
    for (let i = 0; i < ticketsToBuy; i++) {
      let ticketNumber = generateTicketNumber();
      while (lotteryState.tickets.some(t => t.number === ticketNumber)) {
        ticketNumber = generateTicketNumber();
      }

      lotteryState.tickets.push({
        number: ticketNumber,
        buyerJid: ctx.sender.jid,
        buyerName: user.name,
        purchasedAt: Date.now(),
      });
      purchasedTickets.push(ticketNumber);
    }

    lotteryState.prizePool += actualCost * LOTTERY_CONFIG.prizeMultiplier;
    persistLotteryState();

    const timeUntilDraw = this.getTimeUntilDraw();
    await ctx.reply(
      `🎫 *TICKETS COMPRADOS* 🎫\n\n` +
        `✨ *Tickets:* ${purchasedTickets.map(t => `\`${t}\``).join(', ')}\n\n` +
        `💰 *Costo:* $${formatNumber(actualCost)}\n` +
        `💎 *Pozo:* $${formatNumber(lotteryState.prizePool)}\n\n` +
        `⏰ *Sorteo en:* ${timeUntilDraw}\n\n` +
        `📊 *Tiquetes vendidos:* ${lotteryState.tickets.length}/${LOTTERY_CONFIG.maxTickets}`,
    );
    await ctx.react('🎫');
  }

  private async showStatus(ctx: MessageContext): Promise<void> {
    await serviceManager.userService.getUser(ctx.sender.jid);
    const userTickets = lotteryState.tickets.filter(t => t.buyerJid === ctx.sender.jid);
    const timeUntilDraw = this.getTimeUntilDraw();

    await ctx.reply(
      `🎫 *ESTADO DE LOTERÍA* 🎫\n\n` +
        `💎 *Pozo acumulado:* $${formatNumber(lotteryState.prizePool)}\n` +
        `📊 *Tickets vendidos:* ${lotteryState.tickets.length}/${LOTTERY_CONFIG.maxTickets}\n` +
        `⏰ *Sorteo en:* ${timeUntilDraw}\n\n` +
        (userTickets.length > 0
          ? `🎫 *Tus tickets:*\n${userTickets.map(t => `\`${t.number}\``).join(', ')}\n\n`
          : `✿ *No tienes tickets*\n`) +
        `💵 *Precio:* $${LOTTERY_CONFIG.ticketPrice.toLocaleString()}\n\n` +
        `📝 *Compra:* !loteria comprar [cantidad]`,
    );
  }

  private async drawLottery(ctx: MessageContext): Promise<void> {
    if (lotteryState.tickets.length === 0) {
      await ctx.reply(`❌ *No hay tickets comprados*\n\nNo se puede realizar el sorteo`);
      return;
    }

    const winningIndex = Math.floor(Math.random() * lotteryState.tickets.length);
    const winner = lotteryState.tickets[winningIndex];
    const prize = Math.floor(lotteryState.prizePool);

    await serviceManager.userService.addMoney(winner.buyerJid, prize);

    const winnerUser = await serviceManager.userService.getUser(winner.buyerJid);

    await ctx.reply(
      `🎉 *¡SORTEO REALIZADO!* 🎉\n\n` +
        `🥇 *GANADOR:* ${winner.buyerName}\n` +
        `🎫 *Ticket:* \`${winner.number}\`\n\n` +
        `💎 *PREMIO:* $${formatNumber(prize)}\n\n` +
        `💵 *Nuevo balance:* $${formatNumber(winnerUser.money)}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *Participantes:* ${lotteryState.tickets.length}`,
    );

    lotteryState.tickets = [];
    lotteryState.prizePool = 0;
    lotteryState.lastDraw = Date.now();
    persistLotteryState();
  }

  /** Owner-only: descarta tickets y pozo sin pagar y reinicia el ciclo del sorteo. */
  private async resetLottery(ctx: MessageContext): Promise<void> {
    const removedTickets = lotteryState.tickets.length;
    const discardedPool = lotteryState.prizePool;

    lotteryState.tickets = [];
    lotteryState.prizePool = 0;
    lotteryState.lastDraw = Date.now();
    persistLotteryState();

    await ctx.reply(
      `🔄 *SORTEO REINICIADO* 🔄\n\n` +
        `🗑️ *Tickets eliminados:* ${removedTickets}\n` +
        `💎 *Pozo descartado:* $${formatNumber(discardedPool)}\n\n` +
        `✿ *La lotería comienza de nuevo*`,
    );
  }

  private getTimeUntilDraw(): string {
    const now = Date.now();
    if (lotteryState.lastDraw === 0) {
      return '¡Pronto!';
    }

    const nextDraw = lotteryState.lastDraw + LOTTERY_CONFIG.drawInterval;
    const diff = nextDraw - now;

    if (diff <= 0) {
      return '¡Disponible ahora!';
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  }
}
