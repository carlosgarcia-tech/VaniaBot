/**
 * QuestService.ts
 *
 * VaniaBot services module exposing `QuestService`, `Quest`, `QuestObjective`, `QuestReward`.
 *
 * @author **Carlos G**
 */

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: 'daily' | 'main' | 'side';
  objectives: QuestObjective[];
  rewards: QuestReward;
  requiredLevel: number;
  repeatable: boolean;
  cooldown?: number;
}

export interface QuestObjective {
  type: 'kill' | 'collect' | 'talk' | 'reach_level' | 'use_item' | 'craft_item';
  target: string;
  targetName: string;
  amount: number;
}

export interface QuestReward {
  xp: number;
  money: number;
  items?: string[];
  statBonus?: Record<string, number>;
}

export class QuestService {
  private static instance: QuestService;
  private quests: Map<string, Quest> = new Map();

  private constructor() {
    this.registerQuests();
  }

  static getInstance(): QuestService {
    if (!QuestService.instance) {
      QuestService.instance = new QuestService();
    }
    return QuestService.instance;
  }

  private registerQuests(): void {
    const quests: Quest[] = [
      {
        id: 'daily_hunter',
        name: 'Cazador Diario',
        description: 'Caza 5 animales para la aldea',
        type: 'daily',
        objectives: [{ type: 'kill', target: 'goblin', targetName: 'Goblins', amount: 5 }],
        rewards: { xp: 100, money: 200 },
        requiredLevel: 1,
        repeatable: true,
        cooldown: 24 * 60 * 60 * 1000,
      },
      {
        id: 'daily_collector',
        name: 'Recolector Diario',
        description: 'Recolecta materiales para el herrero',
        type: 'daily',
        objectives: [
          { type: 'collect', target: 'iron_ore', targetName: 'Mineral de Hierro', amount: 10 },
          { type: 'collect', target: 'stone', targetName: 'Piedra', amount: 10 },
        ],
        rewards: { xp: 80, money: 150, items: ['health_potion_small'] },
        requiredLevel: 1,
        repeatable: true,
        cooldown: 24 * 60 * 60 * 1000,
      },
      {
        id: 'daily_fisher',
        name: 'Pesca Milagrosa',
        description: 'Pesca peces extraños',
        type: 'daily',
        objectives: [{ type: 'kill', target: 'fish_rare', targetName: 'Peces raros', amount: 3 }],
        rewards: { xp: 120, money: 300 },
        requiredLevel: 5,
        repeatable: true,
        cooldown: 24 * 60 * 60 * 1000,
      },
      {
        id: 'tutorial_combat',
        name: 'Tu Primer Combate',
        description: 'Derrota a tu primer enemigo',
        type: 'main',
        objectives: [{ type: 'kill', target: 'slime', targetName: 'Slime', amount: 1 }],
        rewards: { xp: 50, money: 100, items: ['wooden_sword'] },
        requiredLevel: 1,
        repeatable: false,
      },
      {
        id: 'first_quest',
        name: 'El Mensajero',
        description: 'Lleva un mensaje al villagers cercano',
        type: 'main',
        objectives: [{ type: 'talk', target: 'elder', targetName: 'Anciano', amount: 1 }],
        rewards: { xp: 30, money: 50 },
        requiredLevel: 1,
        repeatable: false,
      },
      {
        id: 'slime_extermination',
        name: 'Exterminio de Slimes',
        description: 'La aldea está plagada de slimes',
        type: 'main',
        objectives: [{ type: 'kill', target: 'slime', targetName: 'Slimes', amount: 10 }],
        rewards: { xp: 150, money: 300, items: ['leather_armor'] },
        requiredLevel: 3,
        repeatable: false,
      },
      {
        id: 'goblin_threat',
        name: 'Amenaza Goblin',
        description: 'Los goblins están atacando',
        type: 'main',
        objectives: [{ type: 'kill', target: 'goblin', targetName: 'Goblins', amount: 5 }],
        rewards: { xp: 200, money: 500, items: ['iron_sword'] },
        requiredLevel: 5,
        repeatable: false,
      },
      {
        id: 'deep_cave',
        name: 'Exploración de Cuevas',
        description: 'Explora las cuevas oscuras',
        type: 'main',
        objectives: [
          { type: 'kill', target: 'spider', targetName: 'Arañas', amount: 5 },
          { type: 'kill', target: 'skeleton', targetName: ' esqueletos', amount: 3 },
        ],
        rewards: { xp: 400, money: 800, items: ['steel_sword'] },
        requiredLevel: 10,
        repeatable: false,
      },
      {
        id: 'herb_gatherer',
        name: 'Recolector de Hierbas',
        description: 'Las pociones requieren ingredientes',
        type: 'side',
        objectives: [
          { type: 'collect', target: 'herb_green', targetName: 'Hierba verde', amount: 20 },
        ],
        rewards: { xp: 60, money: 100, items: ['health_potion_medium'] },
        requiredLevel: 1,
        repeatable: false,
      },
      {
        id: 'treasure_map',
        name: 'El Mapa del Tesoro',
        description: 'Sigue el mapa hacia el tesoro',
        type: 'side',
        objectives: [
          { type: 'kill', target: 'boss_treasure', targetName: 'Guardian del tesoro', amount: 1 },
        ],
        rewards: { xp: 500, money: 2000, items: ['golden_sword'] },
        requiredLevel: 15,
        repeatable: false,
      },
      {
        id: 'dragon_slayer',
        name: 'Cazador de Dragones',
        description: 'Derrota al dragón del norte',
        type: 'side',
        objectives: [{ type: 'kill', target: 'dragon', targetName: 'Dragón', amount: 1 }],
        rewards: { xp: 3000, money: 10000, items: ['dragon_sword', 'dragon_armor'] },
        requiredLevel: 45,
        repeatable: false,
      },
    ];

    quests.forEach(quest => this.quests.set(quest.id, quest));
  }

  getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
  }

  getQuestByName(name: string): Quest | undefined {
    return Array.from(this.quests.values()).find(
      quest =>
        quest.name.toLowerCase().includes(name.toLowerCase()) || quest.id === name.toLowerCase(),
    );
  }

  getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  getQuestsByType(type: Quest['type']): Quest[] {
    return this.getAllQuests().filter(quest => quest.type === type);
  }

  getAvailableQuests(userLevel: number): Quest[] {
    return this.getAllQuests().filter(quest => quest.requiredLevel <= userLevel);
  }

  getDailyQuests(): Quest[] {
    return this.getQuestsByType('daily');
  }

  getMainQuests(): Quest[] {
    return this.getQuestsByType('main');
  }

  getSideQuests(): Quest[] {
    return this.getQuestsByType('side');
  }

  formatQuestList(userLevel: number): string {
    const availableQuests = this.getAvailableQuests(userLevel);

    let message = '📜 *MISIONES*\n\n';

    message += '⭐ *Diarias*\n';
    const dailyQuests = availableQuests.filter(q => q.type === 'daily');
    for (const quest of dailyQuests.slice(0, 3)) {
      message += `  • ${quest.name}: ${quest.description}\n`;
    }

    message += '\n📖 *Principales*\n';
    const mainQuests = availableQuests.filter(q => q.type === 'main');
    for (const quest of mainQuests.slice(0, 5)) {
      message += `  • ${quest.name}: ${quest.description}\n`;
    }

    message += '\n📋 *Secundarias*\n';
    const sideQuests = availableQuests.filter(q => q.type === 'side');
    for (const quest of sideQuests.slice(0, 5)) {
      message += `  • ${quest.name}: ${quest.description}\n`;
    }

    return message.trim();
  }

  formatQuestDetails(quest: Quest): string {
    let message = `📜 *${quest.name}*\n`;
    message += `${quest.description}\n\n`;

    message += '🎯 *Objetivos:*\n';
    for (const obj of quest.objectives) {
      message += `  • ${obj.targetName}: 0/${obj.amount}\n`;
    }

    message += '\n🏆 *Recompensas:*\n';
    message += `  • XP: ${quest.rewards.xp}\n`;
    message += `  • Dinero: $${quest.rewards.money}\n`;
    if (quest.rewards.items) {
      message += `  • Items: ${quest.rewards.items.join(', ')}\n`;
    }

    message += `\n📊 Nivel requerido: ${quest.requiredLevel}`;

    return message.trim();
  }
}

export const questService = QuestService.getInstance();
