/**
 * ShopService.ts
 *
 * VaniaBot services module exposing `ShopService`, `ShopItem`, `shopService`.
 *
 * @author **Carlos G**
 */

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
  type: 'role' | 'feature' | 'cosmetic' | 'badge';
  duration?: number;
}

export class ShopService {
  private static instance: ShopService;

  static getInstance(): ShopService {
    if (!ShopService.instance) {
      ShopService.instance = new ShopService();
    }
    return ShopService.instance;
  }

  readonly SHOP_ITEMS: ShopItem[] = [
    {
      id: 'vip_role',
      name: 'VIP Role',
      description: 'Estado VIP por 7 días',
      price: 7500,
      emoji: '👑',
      type: 'role',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'legend_role',
      name: 'Legend Role',
      description: 'Estado Legend por 7 días',
      price: 15000,
      emoji: '💎',
      type: 'role',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'daily_bonus',
      name: 'Daily Bonus',
      description: '+10% recompensa diaria (permanente)',
      price: 5000,
      emoji: '📈',
      type: 'feature',
    },
    {
      id: 'cooldown_bypass',
      name: 'Cooldown Bypass',
      description: 'Reduce cooldowns 50% por 24h',
      price: 3500,
      emoji: '⚡',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
    {
      id: 'xp_boost',
      name: 'XP Boost',
      description: 'XP doble por 24 horas',
      price: 2500,
      emoji: '✨',
      type: 'feature',
      duration: 24 * 60 * 60 * 1000,
    },
    {
      id: 'lucky_charm',
      name: 'Lucky Charm',
      description: '+25% chance de ganar juegos (7 días)',
      price: 7500,
      emoji: '🍀',
      type: 'feature',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'income_boost',
      name: 'Income Boost',
      description: '+50% dinero en trabajos (7 días)',
      price: 12000,
      emoji: '💰',
      type: 'feature',
      duration: 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'premium_pass',
      name: 'Premium Pass',
      description: 'Acceso a juegos VIP del casino',
      price: 15000,
      emoji: '💎',
      type: 'feature',
    },
    {
      id: 'badge_rich',
      name: 'Badge: Rich',
      description: 'Badge exclusivo de rico',
      price: 35000,
      emoji: '🤑',
      type: 'badge',
    },
    {
      id: 'badge_lucky',
      name: 'Badge: Lucky',
      description: 'Badge exclusivo de suerte',
      price: 25000,
      emoji: '🍀',
      type: 'badge',
    },
    {
      id: 'badge_pro',
      name: 'Badge: Pro Player',
      description: 'Badge de jugador profesional',
      price: 45000,
      emoji: '🏆',
      type: 'badge',
    },
    {
      id: 'bank_interest',
      name: 'Bank Interest',
      description: '+5% interés en banco (permanente)',
      price: 10000,
      emoji: '🏦',
      type: 'feature',
    },
  ];

  getItems(): ShopItem[] {
    return this.SHOP_ITEMS;
  }

  getItemById(id: string): ShopItem | undefined {
    return this.SHOP_ITEMS.find(item => item.id === id);
  }

  getItemByIndex(index: number): ShopItem | undefined {
    return this.SHOP_ITEMS[index - 1];
  }

  getItemsByType(type: ShopItem['type']): ShopItem[] {
    return this.SHOP_ITEMS.filter(item => item.type === type);
  }
}

export const shopService = ShopService.getInstance();
