/**
 * BlackMarketService.ts
 *
 * VaniaBot services module exposing `BlackMarketListing`, `blackMarketService`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '../system/Servicemanager.js';
import { itemRegistry } from '../rpg/ItemRegistry.js';

export interface BlackMarketListing {
  id: string;
  sellerJid: string;
  itemId: string;
  itemName: string;
  originalPrice: number;
  sellPrice: number;
  rarity: string;
  listedAt: number;
  expiresAt: number;
}

const BLACK_MARKET_ITEMS = [
  { itemId: 'diamond', minPrice: 500, maxPrice: 2000, rarity: 'legendary' },
  { itemId: 'gold', minPrice: 200, maxPrice: 800, rarity: 'epic' },
  { itemId: 'iron', minPrice: 50, maxPrice: 200, rarity: 'rare' },
  { itemId: 'wood', minPrice: 20, maxPrice: 100, rarity: 'common' },
  { itemId: 'sword', minPrice: 500, maxPrice: 2000, rarity: 'rare' },
  { itemId: 'shield', minPrice: 400, maxPrice: 1500, rarity: 'rare' },
  { itemId: 'bow', minPrice: 300, maxPrice: 1200, rarity: 'rare' },
  { itemId: 'health_potion', minPrice: 50, maxPrice: 200, rarity: 'common' },
  { itemId: 'mana_potion', minPrice: 50, maxPrice: 200, rarity: 'common' },
  { itemId: 'speed_potion', minPrice: 100, maxPrice: 400, rarity: 'uncommon' },
];

class BlackMarketService {
  private static instance: BlackMarketService;
  private listings: BlackMarketListing[] = [];
  private readonly LISTING_DURATION = 24 * 60 * 60 * 1000;
  private readonly MAX_LISTINGS = 50;

  static getInstance(): BlackMarketService {
    if (!BlackMarketService.instance) {
      BlackMarketService.instance = new BlackMarketService();
    }
    return BlackMarketService.instance;
  }

  private cleanupExpiredListings(): void {
    const now = Date.now();
    this.listings = this.listings.filter(l => l.expiresAt > now);
  }

  async listItem(
    sellerJid: string,
    itemId: string,
    price: number,
  ): Promise<{ success: boolean; message: string; listing?: BlackMarketListing }> {
    this.cleanupExpiredListings();

    if (this.listings.length >= this.MAX_LISTINGS) {
      return { success: false, message: '❌ El mercado está lleno, intenta más tarde' };
    }

    const rpgItem = itemRegistry.getItem(itemId);
    if (!rpgItem) {
      return { success: false, message: '❌ Item no válido' };
    }

    const seller = await serviceManager.userService.getUser(sellerJid);
    const hasItem = seller.inventory.some(i => i.itemId === itemId);

    if (!hasItem) {
      return { success: false, message: '❌ No tienes ese item' };
    }

    const discount = Math.random() * 0.3 + 0.1;
    const suggestedPrice = Math.floor(rpgItem.value * (1 - discount));

    if (price > rpgItem.value) {
      return { success: false, message: `❌ Precio muy alto. Máximo: $${suggestedPrice}` };
    }

    await serviceManager.userService.removeItem(sellerJid, itemId);

    const listing: BlackMarketListing = {
      id: crypto.randomUUID(),
      sellerJid,
      itemId,
      itemName: rpgItem.name,
      originalPrice: rpgItem.value,
      sellPrice: price,
      rarity: rpgItem.rarity || 'common',
      listedAt: Date.now(),
      expiresAt: Date.now() + this.LISTING_DURATION,
    };

    this.listings.push(listing);

    return {
      success: true,
      message: `✅ *Item listed in Black Market*\n\n📦 ${rpgItem.name}\n💰 Price: $${price}\n⏰ Expires in 24 hours\n\n🆔 ID: \`${listing.id}\``,
      listing,
    };
  }

  async buyItem(
    buyerJid: string,
    listingId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.cleanupExpiredListings();

    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      return { success: false, message: '❌ Listing not found or expired' };
    }

    if (listing.sellerJid === buyerJid) {
      return { success: false, message: '❌ No puedes comprar tu propio item' };
    }

    const buyer = await serviceManager.userService.getUser(buyerJid);
    if (buyer.money < listing.sellPrice) {
      return {
        success: false,
        message: `❌ No tienes suficiente dinero. Necesitas: $${listing.sellPrice}`,
      };
    }

    await serviceManager.userService.removeMoney(buyerJid, listing.sellPrice);
    await serviceManager.userService.addMoney(listing.sellerJid, listing.sellPrice);
    await serviceManager.userService.addItemToInventory(buyerJid, {
      itemId: listing.itemId,
      name: listing.itemName,
      type: listing.itemId.includes('potion') ? 'consumable' : 'material',
      purchasedAt: Date.now(),
    });

    this.listings = this.listings.filter(l => l.id !== listingId);

    return {
      success: true,
      message: `✅ *Purchase successful!*\n\n📦 ${listing.itemName}\n💰 Paid: $${listing.sellPrice}\n\n💝 Thanks for shopping at the Black Market!`,
    };
  }

  getListings(): BlackMarketListing[] {
    this.cleanupExpiredListings();
    return [...this.listings].sort((a, b) => a.sellPrice - b.sellPrice);
  }

  getUserListings(userJid: string): BlackMarketListing[] {
    return this.listings.filter(l => l.sellerJid === userJid);
  }

  async cancelListing(
    userJid: string,
    listingId: string,
  ): Promise<{ success: boolean; message: string }> {
    const listing = this.listings.find(l => l.id === listingId && l.sellerJid === userJid);

    if (!listing) {
      return { success: false, message: '❌ Listing no encontrado o no te pertenece' };
    }

    await serviceManager.userService.addItemToInventory(userJid, {
      itemId: listing.itemId,
      name: listing.itemName,
      type: 'material',
      purchasedAt: Date.now(),
    });

    this.listings = this.listings.filter(l => l.id !== listingId);

    return { success: true, message: `✅ Listing cancelado. Item devuelto a tu inventario.` };
  }

  getRandomItems(): Array<{ itemId: string; minPrice: number; maxPrice: number; rarity: string }> {
    const shuffled = [...BLACK_MARKET_ITEMS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }
}

export const blackMarketService = BlackMarketService.getInstance();
