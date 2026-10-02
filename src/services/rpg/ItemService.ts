/**
 * ItemService.ts
 *
 * VaniaBot services module exposing `ItemService`, `InventoryItem`, `UseItemResult`, `EquipResult`.
 *
 * @author **Carlos G**
 */

import { itemRegistry, type RPGItemStats } from './ItemRegistry.js';
import { serviceManager } from '../system/Servicemanager.js';
import type { RPGStats } from '../database/UserService.js';

export interface InventoryItem {
  itemId: string;
  name: string;
  type: string;
  rarity: string;
  quantity: number;
  stats: Record<string, number>;
  useEffect?: {
    type: 'heal' | 'buff' | 'restoreEnergy' | 'restoreStamina' | 'xpBoost';
    value: number;
    duration?: number;
  };
  equipped?: boolean;
  purchasedAt?: number;
}

export interface UseItemResult {
  success: boolean;
  message: string;
  effects?: {
    hpRestored?: number;
    energyRestored?: number;
    staminaRestored?: number;
    xpGained?: number;
    buffApplied?: string;
  };
}

export interface EquipResult {
  success: boolean;
  message: string;
  previousItem?: InventoryItem;
}

export class ItemService {
  private static instance: ItemService;

  static getInstance(): ItemService {
    if (!ItemService.instance) {
      ItemService.instance = new ItemService();
    }
    return ItemService.instance;
  }

  async addItem(jid: string, itemId: string, quantity: number = 1): Promise<void> {
    const rpgItem = itemRegistry.getItem(itemId);
    if (!rpgItem) {
      throw new Error(`Item ${itemId} no encontrado`);
    }

    const user = await serviceManager.userService.getUser(jid);
    const existingItem = user.inventory.find(i => i.itemId === itemId);

    if (existingItem && existingItem.type !== 'weapon' && existingItem.type !== 'armor') {
      const updatedInventory = user.inventory.map(item => {
        if (item.itemId === itemId) {
          return { ...item, quantity: (item.quantity || 1) + quantity };
        }
        return item;
      });
      await serviceManager.userService.updateUser(jid, { inventory: updatedInventory });
    } else {
      await serviceManager.userService.addItemToInventory(jid, {
        itemId: rpgItem.id,
        name: rpgItem.name,
        type: rpgItem.type,
        purchasedAt: Date.now(),
      });
    }
  }

  async removeItem(jid: string, itemId: string, quantity: number = 1): Promise<boolean> {
    const user = await serviceManager.userService.getUser(jid);
    const existingItem = user.inventory.find(i => i.itemId === itemId);

    if (!existingItem) {
      return false;
    }

    const currentQty = existingItem.quantity || 1;
    if (currentQty <= quantity) {
      return await serviceManager.userService.removeItem(jid, itemId);
    } else {
      const updatedInventory = user.inventory.map(item => {
        if (item.itemId === itemId) {
          return { ...item, quantity: (item.quantity || 1) - quantity };
        }
        return item;
      });
      await serviceManager.userService.updateUser(jid, { inventory: updatedInventory });
      return true;
    }
  }

  async hasItem(jid: string, itemId: string, quantity: number = 1): Promise<boolean> {
    const user = await serviceManager.userService.getUser(jid);
    const item = user.inventory.find(i => i.itemId === itemId);
    return item ? (item.quantity || 1) >= quantity : false;
  }

  async useItem(jid: string, itemIdOrName: string): Promise<UseItemResult> {
    const user = await serviceManager.userService.getUser(jid);
    const item = user.inventory.find(
      i =>
        i.itemId.toLowerCase() === itemIdOrName.toLowerCase() ||
        i.name.toLowerCase().includes(itemIdOrName.toLowerCase()),
    );

    if (!item) {
      return { success: false, message: '❌ No tienes ese item' };
    }

    if (item.type !== 'consumable') {
      return {
        success: false,
        message: `❌ ${item.name} no es consumible. Usa !equip para equiparlo`,
      };
    }

    if (!item.useEffect) {
      return { success: false, message: '❌ Este item no tiene efecto' };
    }

    const rpgItem = itemRegistry.getItem(item.itemId);
    if (!rpgItem || !rpgItem.useEffect) {
      return { success: false, message: '❌ Error al usar el item' };
    }

    const effects: UseItemResult['effects'] = {};
    let message = '';
    const stats: RPGStats = user.stats || {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 5,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    };

    switch (rpgItem.useEffect.type) {
      case 'heal': {
        const currentHp = stats.hp || 100;
        const maxHp = stats.maxHp || 100;
        const healAmount = Math.min(rpgItem.useEffect.value, maxHp - currentHp);
        const newHp = Math.min(currentHp + rpgItem.useEffect.value, maxHp);

        await this.updateStats(jid, { hp: newHp });
        effects.hpRestored = healAmount;
        message = `💚 Te curaste ${healAmount} HP`;
        break;
      }
      case 'restoreEnergy': {
        const currentEnergy = stats.energy || 100;
        const maxEnergy = stats.maxEnergy || 100;
        const energyAmount = Math.min(rpgItem.useEffect.value, maxEnergy - currentEnergy);
        const newEnergy = Math.min(currentEnergy + rpgItem.useEffect.value, maxEnergy);

        await this.updateStats(jid, { energy: newEnergy });
        effects.energyRestored = energyAmount;
        message = `⚡ Restauraste ${energyAmount} de energía`;
        break;
      }
      case 'restoreStamina': {
        const currentStamina = stats.stamina || 100;
        const maxStamina = stats.maxStamina || 100;
        const staminaAmount = Math.min(rpgItem.useEffect.value, maxStamina - currentStamina);
        const newStamina = Math.min(currentStamina + rpgItem.useEffect.value, maxStamina);

        await this.updateStats(jid, { stamina: newStamina });
        effects.staminaRestored = staminaAmount;
        message = `💪 Restauraste ${staminaAmount} de resistencia`;
        break;
      }
      case 'xpBoost': {
        await serviceManager.userService.addXP(jid, rpgItem.useEffect.value);
        effects.xpGained = rpgItem.useEffect.value;
        message = `✨ Ganaste ${rpgItem.useEffect.value} XP extra`;
        break;
      }
      case 'buff': {
        message = `🔮 Has obtenido un buff temporal`;
        effects.buffApplied = item.name;
        break;
      }
    }

    await this.removeItem(jid, item.itemId);

    return { success: true, message, effects };
  }

  private async updateStats(jid: string, updates: Record<string, number>): Promise<void> {
    const user = await serviceManager.userService.getUser(jid);
    const currentStats = user.stats || {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 5,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    };

    await serviceManager.userService.updateUser(jid, {
      stats: { ...currentStats, ...updates },
    });
  }

  async equipItem(jid: string, itemIdOrName: string): Promise<EquipResult> {
    const user = await serviceManager.userService.getUser(jid);
    const item = user.inventory.find(
      i =>
        (i.itemId.toLowerCase() === itemIdOrName.toLowerCase() ||
          i.name.toLowerCase().includes(itemIdOrName.toLowerCase())) &&
        !i.equipped,
    );

    if (!item) {
      return { success: false, message: '❌ No tienes ese item' };
    }

    const equipableTypes = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
    if (!equipableTypes.includes(item.type)) {
      if (item.type === 'consumable') {
        return {
          success: false,
          message: `❌ ${item.name} es consumible. Usa !use ${item.itemId}`,
        };
      }
      if (item.type === 'pet') {
        return {
          success: false,
          message: `❌ Para adoptar esta mascota usa !pet adopt ${item.itemId}`,
        };
      }
      return { success: false, message: `❌ Este item no se puede equipar` };
    }

    const rpgItem = itemRegistry.getItem(item.itemId);
    if (!rpgItem) {
      return { success: false, message: '❌ Item no encontrado' };
    }

    if (rpgItem.levelRequired > (user.level || 1)) {
      return {
        success: false,
        message: `❌ Necesitas nivel ${rpgItem.levelRequired} para equipar esto`,
      };
    }

    if (rpgItem.classRequired && rpgItem.classRequired.length > 0) {
      const userClass = user.currentClass;
      if (!userClass || !rpgItem.classRequired.includes(userClass)) {
        return {
          success: false,
          message: `❌ Este item requiere una clase: ${rpgItem.classRequired.join(', ')}`,
        };
      }
    }

    const slotType = item.type;
    const currentEquipped = user.inventory.find(i => i.equipped && i.type === slotType);

    const updatedInventory = user.inventory.map(invItem => {
      if (invItem.itemId === item.itemId) {
        return { ...invItem, equipped: true };
      }
      if (invItem.type === slotType) {
        return { ...invItem, equipped: false };
      }
      return invItem;
    });

    await serviceManager.userService.updateUser(jid, { inventory: updatedInventory });

    const previousItemName = currentEquipped ? currentEquipped.name : 'nada';
    return {
      success: true,
      message: `✅ Equipaste ${item.name} (antes: ${previousItemName})`,
      previousItem: currentEquipped,
    };
  }

  async unequipItem(jid: string, itemIdOrName: string): Promise<EquipResult> {
    const user = await serviceManager.userService.getUser(jid);
    const item = user.inventory.find(
      i =>
        (i.itemId.toLowerCase() === itemIdOrName.toLowerCase() ||
          i.name.toLowerCase().includes(itemIdOrName.toLowerCase())) &&
        i.equipped,
    );

    if (!item) {
      return { success: false, message: '❌ No tienes ese item equipado' };
    }

    const updatedInventory = user.inventory.map(invItem => {
      if (invItem.itemId === item.itemId) {
        return { ...invItem, equipped: false };
      }
      return invItem;
    });

    await serviceManager.userService.updateUser(jid, { inventory: updatedInventory });

    return { success: true, message: `✅ Desequipaste ${item.name}` };
  }

  async getEquippedItems(jid: string): Promise<InventoryItem[]> {
    const user = await serviceManager.userService.getUser(jid);
    return user.inventory.filter(item => item.equipped) as InventoryItem[];
  }

  async getTotalStats(jid: string): Promise<Record<string, number>> {
    const equippedItems = await this.getEquippedItems(jid);
    const baseStats = this.getBaseStats();

    const totalStats: Record<string, number> = { ...baseStats };

    for (const item of equippedItems) {
      if (item.stats) {
        for (const [stat, value] of Object.entries(item.stats)) {
          totalStats[stat] = (totalStats[stat] || 0) + value;
        }
      }
    }

    return totalStats;
  }

  private getBaseStats(): Record<string, number> {
    return {
      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      stamina: 100,
      maxStamina: 100,
      atk: 10,
      def: 5,
      str: 10,
      int: 10,
      agi: 10,
      vit: 10,
      luck: 5,
      critChance: 5,
      dodgeChance: 5,
    };
  }

  private flattenStats(stats: RPGItemStats): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(stats)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  getItemPrice(itemId: string): number {
    const item = itemRegistry.getItem(itemId);
    return item?.value || 0;
  }

  getItemSellPrice(itemId: string): number {
    const item = itemRegistry.getItem(itemId);
    return item?.sellValue || 0;
  }
}

export const itemService = ItemService.getInstance();
