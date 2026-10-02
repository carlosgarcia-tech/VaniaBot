/**
 * MobService.ts
 *
 * VaniaBot services module exposing `MobService`, `Mob`, `mobService`.
 *
 * @author **Carlos G**
 */

export interface Mob {
  id: string;
  name: string;
  description: string;
  emoji: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xpReward: number;
  moneyReward: number;
  drops: Array<{ itemId: string; chance: number }>;
  zone: string;
}

export class MobService {
  private static instance: MobService;
  private mobs: Map<string, Mob> = new Map();

  private constructor() {
    this.registerMobs();
  }

  static getInstance(): MobService {
    if (!MobService.instance) {
      MobService.instance = new MobService();
    }
    return MobService.instance;
  }

  private registerMobs(): void {
    const allMobs: Mob[] = [
      {
        id: 'slime',
        name: 'Slime',
        description: 'Una masa viscosa verde',
        emoji: '🟢',
        level: 1,
        hp: 20,
        maxHp: 20,
        atk: 3,
        def: 1,
        xpReward: 10,
        moneyReward: 5,
        drops: [
          { itemId: 'jelly', chance: 0.3 },
          { itemId: 'wood', chance: 0.2 },
        ],
        zone: 'bosque',
      },
      {
        id: 'goblin',
        name: 'Goblin',
        description: 'Un pequeño ser malicioso',
        emoji: '👺',
        level: 3,
        hp: 40,
        maxHp: 40,
        atk: 8,
        def: 3,
        xpReward: 25,
        moneyReward: 15,
        drops: [
          { itemId: 'leather', chance: 0.4 },
          { itemId: 'iron_ore', chance: 0.2 },
        ],
        zone: 'bosque',
      },
      {
        id: 'wolf',
        name: 'Lobo',
        description: 'Un lobo salvaje feroz',
        emoji: '🐺',
        level: 5,
        hp: 60,
        maxHp: 60,
        atk: 12,
        def: 5,
        xpReward: 40,
        moneyReward: 25,
        drops: [
          { itemId: 'leather', chance: 0.5 },
          { itemId: 'wolf_pelt', chance: 0.3 },
        ],
        zone: 'bosque',
      },
      {
        id: 'bandit',
        name: 'Bandido',
        description: 'Un ladrón del camino',
        emoji: '🥷',
        level: 7,
        hp: 80,
        maxHp: 80,
        atk: 15,
        def: 8,
        xpReward: 60,
        moneyReward: 50,
        drops: [
          { itemId: 'money_bag', chance: 0.2 },
          { itemId: 'iron_sword', chance: 0.05 },
        ],
        zone: 'bosque',
      },
      {
        id: 'bat',
        name: 'Murciélago',
        description: 'Un murciélago gigante',
        emoji: '🦇',
        level: 8,
        hp: 50,
        maxHp: 50,
        atk: 10,
        def: 3,
        xpReward: 35,
        moneyReward: 15,
        drops: [{ itemId: 'bat_wing', chance: 0.4 }],
        zone: 'cuevas',
      },
      {
        id: 'spider',
        name: 'Araña',
        description: 'Una araña venenosa',
        emoji: '🕷️',
        level: 10,
        hp: 70,
        maxHp: 70,
        atk: 18,
        def: 6,
        xpReward: 55,
        moneyReward: 30,
        drops: [
          { itemId: 'spider_silk', chance: 0.35 },
          { itemId: 'poison', chance: 0.2 },
        ],
        zone: 'cuevas',
      },
      {
        id: 'skeleton',
        name: 'Esqueleto',
        description: 'Un guerrero esquelético',
        emoji: '💀',
        level: 12,
        hp: 100,
        maxHp: 100,
        atk: 22,
        def: 10,
        xpReward: 80,
        moneyReward: 45,
        drops: [
          { itemId: 'bone', chance: 0.5 },
          { itemId: 'iron_sword', chance: 0.1 },
        ],
        zone: 'cuevas',
      },
      {
        id: 'orc',
        name: 'Orco',
        description: 'Un guerrero orco brutal',
        emoji: '👹',
        level: 15,
        hp: 150,
        maxHp: 150,
        atk: 28,
        def: 15,
        xpReward: 120,
        moneyReward: 80,
        drops: [
          { itemId: 'orc_tusk', chance: 0.3 },
          { itemId: 'leather', chance: 0.4 },
        ],
        zone: 'montañas',
      },
      {
        id: 'troll',
        name: 'Trol',
        description: 'Un trol de las montañas',
        emoji: '🧌',
        level: 18,
        hp: 200,
        maxHp: 200,
        atk: 35,
        def: 20,
        xpReward: 160,
        moneyReward: 120,
        drops: [
          { itemId: 'troll_meat', chance: 0.3 },
          { itemId: 'stone', chance: 0.5 },
        ],
        zone: 'montañas',
      },
      {
        id: 'fire_elemental',
        name: 'Elemental de Fuego',
        description: 'Una criatura de fuego puro',
        emoji: '🔥',
        level: 22,
        hp: 180,
        maxHp: 180,
        atk: 45,
        def: 12,
        xpReward: 200,
        moneyReward: 150,
        drops: [
          { itemId: 'fire_essence', chance: 0.25 },
          { itemId: 'magic_dust', chance: 0.4 },
        ],
        zone: 'volcán',
      },
      {
        id: 'demon',
        name: 'Demonio',
        description: 'Un ser infernal malvado',
        emoji: '😈',
        level: 30,
        hp: 350,
        maxHp: 350,
        atk: 60,
        def: 30,
        xpReward: 350,
        moneyReward: 300,
        drops: [
          { itemId: 'demon_horn', chance: 0.2 },
          { itemId: 'magic_dust', chance: 0.5 },
        ],
        zone: 'volcán',
      },
      {
        id: 'zombie',
        name: 'Zombi',
        description: 'Un muerto viviente',
        emoji: '🧟',
        level: 14,
        hp: 120,
        maxHp: 120,
        atk: 20,
        def: 8,
        xpReward: 90,
        moneyReward: 40,
        drops: [
          { itemId: 'bone', chance: 0.4 },
          { itemId: 'rotten_meat', chance: 0.3 },
        ],
        zone: 'castillo',
      },
      {
        id: 'ghost',
        name: 'Fantasma',
        description: 'Un espíritu vengativo',
        emoji: '👻',
        level: 20,
        hp: 100,
        maxHp: 100,
        atk: 40,
        def: 5,
        xpReward: 180,
        moneyReward: 100,
        drops: [
          { itemId: 'ectoplasm', chance: 0.3 },
          { itemId: 'magic_dust', chance: 0.4 },
        ],
        zone: 'castillo',
      },
      {
        id: 'vampire',
        name: 'Vampiro',
        description: 'Un señor de los muertos',
        emoji: '🧛',
        level: 28,
        hp: 280,
        maxHp: 280,
        atk: 55,
        def: 25,
        xpReward: 300,
        moneyReward: 250,
        drops: [
          { itemId: 'vampire_fang', chance: 0.15 },
          { itemId: 'gold_ore', chance: 0.3 },
        ],
        zone: 'castillo',
      },
      {
        id: 'dragon',
        name: 'Dragón',
        description: 'El rey de los dragones',
        emoji: '🐉',
        level: 50,
        hp: 2000,
        maxHp: 2000,
        atk: 100,
        def: 50,
        xpReward: 2000,
        moneyReward: 5000,
        drops: [
          { itemId: 'dragon_scale', chance: 0.8 },
          { itemId: 'dragon_sword', chance: 0.1 },
          { itemId: 'dragon_armor', chance: 0.05 },
        ],
        zone: 'boss',
      },
      {
        id: 'phoenix',
        name: 'Fénix',
        description: 'El ave legendaria',
        emoji: '🦅',
        level: 45,
        hp: 1500,
        maxHp: 1500,
        atk: 85,
        def: 40,
        xpReward: 1500,
        moneyReward: 3000,
        drops: [
          { itemId: 'phoenix_feather', chance: 0.7 },
          { itemId: 'fire_essence', chance: 0.5 },
        ],
        zone: 'boss',
      },
      {
        id: 'lich',
        name: 'Lich',
        description: 'El señor de los muertos vivos',
        emoji: '☠️',
        level: 55,
        hp: 1800,
        maxHp: 1800,
        atk: 90,
        def: 35,
        xpReward: 2500,
        moneyReward: 4000,
        drops: [
          { itemId: 'necromancer_staff', chance: 0.1 },
          { itemId: 'magic_dust', chance: 0.8 },
        ],
        zone: 'boss',
      },
    ];

    allMobs.forEach(mob => this.mobs.set(mob.id, mob));
  }

  getMob(id: string): Mob | undefined {
    return this.mobs.get(id);
  }

  getMobByName(name: string): Mob | undefined {
    return Array.from(this.mobs.values()).find(
      mob => mob.name.toLowerCase().includes(name.toLowerCase()) || mob.id === name.toLowerCase(),
    );
  }

  getAllMobs(): Mob[] {
    return Array.from(this.mobs.values());
  }

  getMobsByZone(zone: string): Mob[] {
    return this.getAllMobs().filter(mob => mob.zone === zone);
  }

  getMobsByLevel(level: number): Mob[] {
    return this.getAllMobs().filter(mob => mob.level <= level + 5 && mob.level >= level - 3);
  }

  getZones(): string[] {
    const zones = new Set(this.getAllMobs().map(mob => mob.zone));
    return Array.from(zones);
  }

  getRandomMob(level: number): Mob {
    const availableMobs = this.getMobsByLevel(level);
    let cumulative = 0;

    for (const mob of availableMobs) {
      cumulative += 1 / Math.abs(mob.level - level + 1);
    }

    let random = Math.random() * cumulative;
    for (const mob of availableMobs) {
      const weight = 1 / Math.abs(mob.level - level + 1);
      random -= weight;
      if (random <= 0) {
        return mob;
      }
    }

    return availableMobs[Math.floor(Math.random() * availableMobs.length)];
  }

  getMobDrops(mob: Mob): string[] {
    const drops: string[] = [];
    for (const drop of mob.drops) {
      if (Math.random() * 100 < drop.chance * 100) {
        drops.push(drop.itemId);
      }
    }
    return drops;
  }

  formatMobList(zone?: string): string {
    let mobs: Mob[];

    if (zone) {
      mobs = this.getMobsByZone(zone);
    } else {
      mobs = this.getAllMobs().filter(m => m.zone !== 'boss');
    }

    const groupedByZone = new Map<string, Mob[]>();
    mobs.forEach(mob => {
      const existing = groupedByZone.get(mob.zone) || [];
      existing.push(mob);
      groupedByZone.set(mob.zone, existing);
    });

    let message = '👾 *BESTIARIO*\n\n';

    for (const [zoneName, zoneMobs] of groupedByZone) {
      message += `📍 *${this.capitalize(zoneName)}*\n`;
      for (const mob of zoneMobs) {
        message += `${mob.emoji} *${mob.name}* (Nv.${mob.level})\n`;
        message += `   💰 $${mob.moneyReward} | ✨ ${mob.xpReward} XP\n`;
      }
      message += '\n';
    }

    return message.trim();
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const mobService = MobService.getInstance();
