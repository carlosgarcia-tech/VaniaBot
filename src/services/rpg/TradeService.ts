/**
 * TradeService.ts
 *
 * VaniaBot services module exposing `TradeService`, `TradeOffer`, `tradeService`.
 *
 * @author **Carlos G**
 */

import { itemRegistry } from './ItemRegistry.js';
import { itemService } from './ItemService.js';
import { serviceManager } from '../system/Servicemanager.js';
import { gameStateService, type PersistedMarketOffer } from './GameStateService.js';
import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import { logger } from '@/utils/logger.js';

export interface TradeOffer {
  id: string;
  sellerJid: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  createdAt: number;
}

export type TradeResult = Either<{ message: string }, { message: string }>;

export class TradeService {
  private static instance: TradeService;
  private marketOffers: Map<string, TradeOffer> = new Map();
  private tradeCooldowns: Map<string, number> = new Map();

  private readonly TRADE_COOLDOWN = 30000;
  private readonly MAX_MARKET_FEE = 0.05;

  static getInstance(): TradeService {
    if (!TradeService.instance) {
      TradeService.instance = new TradeService();
    }
    return TradeService.instance;
  }

  loadFromPersistence(): void {
    const offers = gameStateService.getMarketOffers();
    this.marketOffers.clear();
    for (const offer of offers) {
      this.marketOffers.set(offer.id, {
        id: offer.id,
        sellerJid: offer.sellerJid,
        itemId: offer.itemId,
        itemName: offer.itemName,
        price: offer.price,
        quantity: offer.quantity,
        createdAt: offer.createdAt,
      });
    }
    logger.debug(`[Trade] Loaded ${this.marketOffers.size} market offers`);
  }

  private saveOffers(): void {
    const offers: PersistedMarketOffer[] = Array.from(this.marketOffers.values()).map(o => ({
      id: o.id,
      sellerJid: o.sellerJid,
      itemId: o.itemId,
      itemName: o.itemName,
      price: o.price,
      quantity: o.quantity,
      createdAt: o.createdAt,
    }));
    gameStateService.setMarketOffers(offers);
  }

  async createOffer(
    jid: string,
    itemIdOrName: string,
    price: number,
    quantity: number = 1,
  ): Promise<TradeResult> {
    const user = await serviceManager.userService.getUser(jid);

    if (price < 1) {
      return left({ message: '❌ El precio debe ser mayor a 0' });
    }

    const item = user.inventory?.find(
      i =>
        i.itemId.toLowerCase() === itemIdOrName.toLowerCase() ||
        i.name.toLowerCase().includes(itemIdOrName.toLowerCase()),
    );

    if (!item) {
      return left({ message: '❌ No tienes ese item' });
    }

    const itemData = itemRegistry.getItem(item.itemId);
    if (!itemData) {
      return left({ message: '❌ Item no válido' });
    }

    if ((item.quantity || 1) < quantity) {
      return left({ message: `❌ No tienes suficientes ${item.name}` });
    }

    const hasCooldown = this.tradeCooldowns.get(jid);
    if (hasCooldown && Date.now() - hasCooldown < this.TRADE_COOLDOWN) {
      const remaining = Math.ceil((this.TRADE_COOLDOWN - (Date.now() - hasCooldown)) / 1000);
      return left({ message: `❌ Espera ${remaining}s antes de vender de nuevo` });
    }

    const offerId = `${jid}_${item.itemId}_${Date.now()}`;
    const offer: TradeOffer = {
      id: offerId,
      sellerJid: jid,
      itemId: item.itemId,
      itemName: item.name,
      price,
      quantity,
      createdAt: Date.now(),
    };

    this.marketOffers.set(offerId, offer);
    this.saveOffers();

    for (let i = 0; i < quantity; i++) {
      await itemService.removeItem(jid, item.itemId);
    }

    this.tradeCooldowns.set(jid, Date.now());

    return right({
      message: `✅ Pusiste ${quantity}x ${item.name} en el mercado por $${price * quantity}`,
    });
  }

  async buyItem(jid: string, offerId: string): Promise<TradeResult> {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return left({ message: '❌ Oferta no encontrada' });
    }

    if (offer.sellerJid === jid) {
      return left({ message: '❌ No puedes comprar tu propia oferta' });
    }

    const buyer = await serviceManager.userService.getUser(jid);
    const totalPrice = offer.price * offer.quantity;
    const marketFee = Math.floor(totalPrice * this.MAX_MARKET_FEE);
    const sellerGets = totalPrice - marketFee;

    if (buyer.money < totalPrice) {
      return left({
        message: `❌ No tienes suficiente dinero. Necesitas: $${totalPrice}`,
      });
    }

    const removed = await serviceManager.userService.removeMoney(jid, totalPrice);
    if (!removed) {
      return left({ message: '❌ Error al procesar el pago' });
    }

    await serviceManager.userService.addMoney(offer.sellerJid, sellerGets);

    for (let i = 0; i < offer.quantity; i++) {
      await itemService.addItem(jid, offer.itemId);
    }

    this.marketOffers.delete(offerId);
    this.saveOffers();

    const itemData = itemRegistry.getItem(offer.itemId);

    return right({
      message: `✅ ¡Compraste ${offer.quantity}x ${itemData?.name || offer.itemName} por $${totalPrice}!\n💰 El vendedor recibió: $${sellerGets}\n📊 Comisión del mercado: $${marketFee}`,
    });
  }

  async cancelOffer(jid: string, offerId: string): Promise<TradeResult> {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return left({ message: '❌ Oferta no encontrada' });
    }

    if (offer.sellerJid !== jid) {
      return left({ message: '❌ No puedes cancelar ofertas de otros' });
    }

    for (let i = 0; i < offer.quantity; i++) {
      await itemService.addItem(jid, offer.itemId);
    }

    this.marketOffers.delete(offerId);
    this.saveOffers();

    return right({
      message: `✅ Cancelaste la oferta. Tu/s item/s devuelto/s al inventario`,
    });
  }

  getMarketOffers(): TradeOffer[] {
    return Array.from(this.marketOffers.values());
  }

  getMyOffers(jid: string): TradeOffer[] {
    return this.getMarketOffers().filter(offer => offer.sellerJid === jid);
  }

  formatMarket(page: number = 1, limit: number = 10): string {
    const offers = this.getMarketOffers();

    if (offers.length === 0) {
      return '🏪 *Mercado vacío*\n\n💡 Usa !sell [item] [precio] para vender';
    }

    const start = (page - 1) * limit;
    const paginatedOffers = offers.slice(start, start + limit);

    let message = `🏪 *MERCADO*\n\n`;
    message += `📦 Total de ofertas: ${offers.length}\n\n`;

    paginatedOffers.forEach((offer, index) => {
      const itemData = itemRegistry.getItem(offer.itemId);
      const emoji =
        itemData?.type === 'weapon'
          ? '⚔️'
          : itemData?.type === 'armor'
            ? '🛡️'
            : itemData?.type === 'consumable'
              ? '🧪'
              : itemData?.type === 'material'
                ? '🪨'
                : '📦';

      message += `${start + index + 1}. ${emoji} *${offer.itemName}*\n`;
      message += `   💰 Precio: $${offer.price} x${offer.quantity}\n`;
      message += `   🆔 ID: ${offer.id.slice(-8)}\n\n`;
    });

    const totalPages = Math.ceil(offers.length / limit);
    if (totalPages > 1) {
      message += `📄 Página ${page}/${totalPages}\n`;
      message += `💡 Usa !market [página] para ver más`;
    }

    return message.trim();
  }

  formatMyOffers(jid: string): string {
    const offers = this.getMyOffers(jid);

    if (offers.length === 0) {
      return '📦 *No tienes ofertas en el mercado*';
    }

    let message = '📦 *TUS OFERTAS*\n\n';

    offers.forEach((offer, index) => {
      message += `${index + 1}. *${offer.itemName}*\n`;
      message += `   💰 Precio: $${offer.price} x${offer.quantity}\n`;
      message += `   🆔 ID: ${offer.id.slice(-8)}\n`;
      message += `   ❌ !cancel ${offer.id.slice(-8)}\n\n`;
    });

    return message.trim();
  }

  formatBuyHelp(offerId: string): string {
    const offer = this.marketOffers.get(offerId);

    if (!offer) {
      return '❌ Oferta no encontrada';
    }

    const itemData = itemRegistry.getItem(offer.itemId);
    const totalPrice = offer.price * offer.quantity;

    return (
      `💰 *Confirmar compra*\n\n` +
      `Item: ${itemData?.name || offer.itemName}\n` +
      `Cantidad: ${offer.quantity}\n` +
      `Precio unitario: $${offer.price}\n` +
      `Total: $${totalPrice}\n\n` +
      `Usa !buy ${offer.id.slice(-8)} para comprar`
    );
  }
}

export const tradeService = TradeService.getInstance();
