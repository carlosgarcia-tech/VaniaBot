/**
 * CraftService.ts
 *
 * VaniaBot services module exposing `CraftService`, `CraftRecipe`, `CraftResult`, `craftService`.
 *
 * @author **Carlos G**
 */

import { itemRegistry, type RPGItem } from './ItemRegistry.js';
import { itemService } from './ItemService.js';
import { serviceManager } from '../system/Servicemanager.js';

export interface CraftRecipe {
  resultId: string;
  quantity: number;
  materials: { itemId: string; quantity: number }[];
  requiredTool?: string;
  requiredLevel: number;
  description: string;
}

export interface CraftResult {
  success: boolean;
  message: string;
  item?: RPGItem;
}

export class CraftService {
  private static instance: CraftService;
  private recipes: Map<string, CraftRecipe> = new Map();

  private constructor() {
    this.registerRecipes();
  }

  static getInstance(): CraftService {
    if (!CraftService.instance) {
      CraftService.instance = new CraftService();
    }
    return CraftService.instance;
  }

  private registerRecipes(): void {
    const recipes: CraftRecipe[] = [
      {
        resultId: 'wooden_sword',
        quantity: 1,
        materials: [{ itemId: 'wood', quantity: 5 }],
        requiredLevel: 1,
        description: 'Craftea una espada de madera',
      },
      {
        resultId: 'wooden_bow',
        quantity: 1,
        materials: [
          { itemId: 'wood', quantity: 4 },
          { itemId: 'leather', quantity: 2 },
        ],
        requiredLevel: 1,
        description: 'Craftea un arco de madera',
      },
      {
        resultId: 'iron_sword',
        quantity: 1,
        materials: [
          { itemId: 'iron_ore', quantity: 5 },
          { itemId: 'wood', quantity: 2 },
        ],
        requiredTool: 'iron_ore',
        requiredLevel: 5,
        description: 'Craftea una espada de hierro',
      },
      {
        resultId: 'steel_sword',
        quantity: 1,
        materials: [
          { itemId: 'iron_ore', quantity: 10 },
          { itemId: 'stone', quantity: 5 },
        ],
        requiredTool: 'iron_ore',
        requiredLevel: 10,
        description: 'Craftea una espada de acero',
      },
      {
        resultId: 'leather_armor',
        quantity: 1,
        materials: [{ itemId: 'leather', quantity: 8 }],
        requiredLevel: 1,
        description: 'Craftea armadura de cuero',
      },
      {
        resultId: 'iron_armor',
        quantity: 1,
        materials: [
          { itemId: 'iron_ore', quantity: 12 },
          { itemId: 'leather', quantity: 5 },
        ],
        requiredTool: 'iron_ore',
        requiredLevel: 8,
        description: 'Craftea armadura de hierro',
      },
      {
        resultId: 'health_potion_small',
        quantity: 1,
        materials: [
          { itemId: 'herb_green', quantity: 2 },
          { itemId: 'water_bottle', quantity: 1 },
        ],
        requiredLevel: 1,
        description: 'Craftea poción pequeña de vida',
      },
      {
        resultId: 'health_potion_medium',
        quantity: 1,
        materials: [
          { itemId: 'herb_green', quantity: 5 },
          { itemId: 'magic_dust', quantity: 2 },
        ],
        requiredLevel: 5,
        description: 'Craftea poción mediana de vida',
      },
      {
        resultId: 'health_potion_large',
        quantity: 1,
        materials: [
          { itemId: 'herb_red', quantity: 5 },
          { itemId: 'magic_dust', quantity: 5 },
          { itemId: 'diamond', quantity: 1 },
        ],
        requiredLevel: 15,
        description: 'Craftea poción grande de vida',
      },
      {
        resultId: 'silver_sword',
        quantity: 1,
        materials: [
          { itemId: 'silver_ore', quantity: 8 },
          { itemId: 'magic_dust', quantity: 3 },
        ],
        requiredTool: 'silver_ore',
        requiredLevel: 20,
        description: 'Craftea espada de plata',
      },
      {
        resultId: 'golden_sword',
        quantity: 1,
        materials: [
          { itemId: 'gold_ore', quantity: 10 },
          { itemId: 'ruby', quantity: 2 },
          { itemId: 'magic_dust', quantity: 5 },
        ],
        requiredTool: 'gold_ore',
        requiredLevel: 35,
        description: 'Craftea espada dorada',
      },
      {
        resultId: 'diamond_sword',
        quantity: 1,
        materials: [
          { itemId: 'diamond', quantity: 5 },
          { itemId: 'emerald', quantity: 3 },
          { itemId: 'dragon_scale', quantity: 1 },
        ],
        requiredTool: 'diamond',
        requiredLevel: 50,
        description: 'Craftea espada de diamante',
      },
      {
        resultId: 'magic_dust',
        quantity: 3,
        materials: [{ itemId: 'stone', quantity: 5 }],
        requiredLevel: 1,
        description: 'Convierte piedra en polvo mágico',
      },
      {
        resultId: 'leather',
        quantity: 2,
        materials: [{ itemId: 'wolf_pelt', quantity: 3 }],
        requiredLevel: 5,
        description: 'Procesa pieles de lobo',
      },
    ];

    recipes.forEach(recipe => {
      this.recipes.set(recipe.resultId, recipe);
    });
  }

  getRecipe(id: string): CraftRecipe | undefined {
    return this.recipes.get(id);
  }

  getRecipeByName(name: string): CraftRecipe | undefined {
    return Array.from(this.recipes.values()).find(recipe => {
      const item = itemRegistry.getItem(recipe.resultId);
      return (
        item?.name.toLowerCase().includes(name.toLowerCase()) ||
        recipe.resultId === name.toLowerCase()
      );
    });
  }

  getAllRecipes(): CraftRecipe[] {
    return Array.from(this.recipes.values());
  }

  getRecipesByLevel(level: number): CraftRecipe[] {
    return this.getAllRecipes().filter(recipe => recipe.requiredLevel <= level);
  }

  async craftItem(jid: string, recipeIdOrName: string): Promise<CraftResult> {
    const recipe = this.getRecipeByName(recipeIdOrName);
    if (!recipe) {
      return { success: false, message: '❌ Receta no encontrada' };
    }

    const user = await serviceManager.userService.getUser(jid);

    if (user.level < recipe.requiredLevel) {
      return {
        success: false,
        message: `❌ Necesitas nivel ${recipe.requiredLevel} para craftear esto`,
      };
    }

    const inventory = user.inventory || [];

    for (const material of recipe.materials) {
      const hasEnough = inventory.some(
        item => item.itemId === material.itemId && (item.quantity || 1) >= material.quantity,
      );

      if (!hasEnough) {
        const materialItem = itemRegistry.getItem(material.itemId);
        return {
          success: false,
          message: `❌ No tienes suficientes ${materialItem?.name || material.itemId}. Necesitas: ${material.quantity}`,
        };
      }
    }

    for (const material of recipe.materials) {
      for (let i = 0; i < material.quantity; i++) {
        await itemService.removeItem(jid, material.itemId);
      }
    }

    for (let i = 0; i < recipe.quantity; i++) {
      await itemService.addItem(jid, recipe.resultId);
    }

    const craftedItem = itemRegistry.getItem(recipe.resultId);

    return {
      success: true,
      message: `✅ ¡Crafteaste ${recipe.quantity}x ${craftedItem?.name || recipe.resultId}!`,
      item: craftedItem,
    };
  }

  formatRecipeList(userLevel: number): string {
    const availableRecipes = this.getRecipesByLevel(userLevel);

    let message = '🔨 *RECETAS DE CRAFTING*\n\n';

    for (const recipe of availableRecipes) {
      const item = itemRegistry.getItem(recipe.resultId);
      message += `📦 *${item?.name || recipe.resultId}*\n`;
      message += `   ${recipe.description}\n`;
      message += `   📋 Materiales: `;
      message += recipe.materials
        .map(m => {
          const matItem = itemRegistry.getItem(m.itemId);
          return `${matItem?.name || m.itemId} x${m.quantity}`;
        })
        .join(', ');
      message += `\n`;
      message += `   🔓 Nivel: ${recipe.requiredLevel}\n\n`;
    }

    return message.trim();
  }

  formatRecipeDetails(recipe: CraftRecipe): string {
    const item = itemRegistry.getItem(recipe.resultId);

    let message = `🔨 *${item?.name || recipe.resultId}*\n`;
    message += `${recipe.description}\n\n`;
    message += `📋 *Materiales requeridos:*\n`;
    for (const material of recipe.materials) {
      const matItem = itemRegistry.getItem(material.itemId);
      message += `  • ${matItem?.name || material.itemId}: ${material.quantity}\n`;
    }
    message += `\n🔓 Nivel requerido: ${recipe.requiredLevel}`;

    return message.trim();
  }
}

export const craftService = CraftService.getInstance();
