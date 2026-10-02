/**
 * ItemRegistry.ts
 *
 * VaniaBot services module exposing `ItemRegistry`, `RPGItemStats`, `RPGItem`, `itemRegistry`.
 *
 * @author **Carlos G**
 */

import { weapons } from './data/weapons.js';
import { armor } from './data/armor.js';
import { consumables } from './data/consumables.js';
import { materials } from './data/materials.js';
import { pets } from './data/pets.js';

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'helmet'
  | 'gloves'
  | 'boots'
  | 'accessory'
  | 'consumable'
  | 'material'
  | 'questItem'
  | 'pet';

export interface RPGItemStats {
  hp?: number;
  maxHp?: number;
  mana?: number;
  atk?: number;
  def?: number;
  str?: number;
  int?: number;
  agi?: number;
  vit?: number;
  luck?: number;
  energy?: number;
  critChance?: number;
  dodgeChance?: number;
  blockChance?: number;
}

export interface RPGItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  stats: RPGItemStats;
  value: number;
  sellValue: number;
  levelRequired: number;
  classRequired?: string[];
  useEffect?: {
    type: 'heal' | 'buff' | 'restoreEnergy' | 'restoreStamina' | 'xpBoost';
    value: number;
    duration?: number;
  };
  craftRecipe?: {
    materials: { itemId: string; quantity: number }[];
    requiredTool?: string;
  };
}

export class ItemRegistry {
  private static instance: ItemRegistry;
  private items: Map<string, RPGItem> = new Map();

  private constructor() {
    const allItems = [...weapons, ...armor, ...consumables, ...materials, ...pets];
    allItems.forEach(item => this.items.set(item.id, item));
  }

  static getInstance(): ItemRegistry {
    if (!ItemRegistry.instance) {
      ItemRegistry.instance = new ItemRegistry();
    }
    return ItemRegistry.instance;
  }

  getItem(id: string): RPGItem | undefined {
    return this.items.get(id);
  }

  getAllItems(): RPGItem[] {
    return Array.from(this.items.values());
  }

  getItemsByType(type: ItemType): RPGItem[] {
    return this.getAllItems().filter(item => item.type === type);
  }

  getItemsByRarity(rarity: RPGItem['rarity']): RPGItem[] {
    return this.getAllItems().filter(item => item.rarity === rarity);
  }

  getItemsByLevel(level: number): RPGItem[] {
    return this.getAllItems().filter(item => item.levelRequired <= level);
  }

  getConsumablesList(): RPGItem[] {
    return this.getItemsByType('consumable');
  }

  getWeaponsList(): RPGItem[] {
    return this.getItemsByType('weapon');
  }

  getArmorList(): RPGItem[] {
    return this.getAllItems().filter(item =>
      ['armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type),
    );
  }

  getMaterialsList(): RPGItem[] {
    return this.getItemsByType('material');
  }

  getPetsList(): RPGItem[] {
    return this.getItemsByType('pet');
  }
}

export const itemRegistry = ItemRegistry.getInstance();
