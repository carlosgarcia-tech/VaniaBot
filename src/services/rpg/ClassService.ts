/**
 * ClassService.ts
 *
 * VaniaBot services module exposing `ClassService`, `RPGClass`, `classService`.
 *
 * @author **Carlos G**
 */

export interface RPGClass {
  id: string;
  name: string;
  description: string;
  emoji: string;
  statsBonus: {
    hp?: number;
    atk?: number;
    def?: number;
    str?: number;
    int?: number;
    agi?: number;
    vit?: number;
    luck?: number;
    critChance?: number;
    dodgeChance?: number;
  };
  skills: string[];
  requiredLevel: number;
}

export class ClassService {
  private static instance: ClassService;
  private classes: Map<string, RPGClass> = new Map();

  private constructor() {
    this.registerClasses();
  }

  static getInstance(): ClassService {
    if (!ClassService.instance) {
      ClassService.instance = new ClassService();
    }
    return ClassService.instance;
  }

  private registerClasses(): void {
    const classes: RPGClass[] = [
      {
        id: 'warrior',
        name: 'Guerrero',
        description: 'Luchador cuerpo a cuerpo con alta defensa y fuerza',
        emoji: '⚔️',
        statsBonus: {
          hp: 50,
          atk: 10,
          def: 15,
          str: 15,
          vit: 10,
        },
        skills: ['golpe_poderoso', 'escudo_defensa', 'furia'],
        requiredLevel: 1,
      },
      {
        id: 'mage',
        name: 'Mago',
        description: 'Maestro de la magia con alto poder intelectual',
        emoji: '🔮',
        statsBonus: {
          hp: -20,
          atk: 15,
          int: 20,
          def: -5,
        },
        skills: ['bola_fuego', 'escudo_magico', 'teleport'],
        requiredLevel: 1,
      },
      {
        id: 'rogue',
        name: 'Pícaro',
        description: 'Asesino sigiloso con alta velocidad y crítico',
        emoji: '🗡️',
        statsBonus: {
          hp: -10,
          atk: 12,
          agi: 20,
          luck: 10,
          def: -5,
        },
        skills: ['golpe_espada', 'sigilo', 'veneno'],
        requiredLevel: 1,
      },
      {
        id: 'paladin',
        name: 'Paladín',
        description: 'Guerrero sagrado con equilibrio entre ataque y defensa',
        emoji: '🛡️',
        statsBonus: {
          hp: 30,
          atk: 5,
          def: 20,
          vit: 15,
          luck: 5,
        },
        skills: ['golpe_sagrado', 'curacion', 'proteccion_divina'],
        requiredLevel: 5,
      },
      {
        id: 'ranger',
        name: 'Montaraz',
        description: 'Experto en arco y supervivencia',
        emoji: '🏹',
        statsBonus: {
          hp: 10,
          atk: 15,
          agi: 15,
          luck: 10,
        },
        skills: ['disparo_preciso', 'trampa', 'seguir_presa'],
        requiredLevel: 3,
      },
      {
        id: 'cleric',
        name: 'Clérigo',
        description: 'Sanador divino con poderes de curación',
        emoji: '✨',
        statsBonus: {
          hp: 20,
          int: 15,
          vit: 10,
          def: 5,
        },
        skills: ['curacion', 'resurreccion', 'bendicion'],
        requiredLevel: 1,
      },
      {
        id: 'knight',
        name: 'Caballero',
        description: 'Caballero blindado con máxima defensa',
        emoji: '🛡️',
        statsBonus: {
          hp: 60,
          atk: 5,
          def: 25,
          vit: 20,
        },
        skills: ['estocada', 'escudo_acero', 'provocacion'],
        requiredLevel: 10,
      },
      {
        id: 'assassin',
        name: 'Asesino',
        description: 'Maestro del asesinato con daño crítico masivo',
        emoji: '💀',
        statsBonus: {
          hp: -30,
          atk: 25,
          agi: 25,
          luck: 15,
          critChance: 10,
        },
        skills: ['golpe_critico', 'sigilo_asesino', 'red_de_muerte'],
        requiredLevel: 15,
      },
      {
        id: 'necromancer',
        name: 'Nigromante',
        description: 'Maestro de la muerte y los no muertos',
        emoji: '💀',
        statsBonus: {
          hp: 10,
          atk: 20,
          int: 25,
          def: -10,
        },
        skills: ['invocar_esqueleto', 'toque_muerte', 'escudo_huesos'],
        requiredLevel: 20,
      },
      {
        id: 'druid',
        name: 'Druida',
        description: 'Transformador con poderes de la naturaleza',
        emoji: '🌿',
        statsBonus: {
          hp: 30,
          atk: 10,
          int: 15,
          vit: 15,
          agi: 10,
        },
        skills: ['forma_oso', 'forma_lobo', 'regeneracion_naturaleza'],
        requiredLevel: 12,
      },
    ];

    classes.forEach(cls => this.classes.set(cls.id, cls));
  }

  getClass(id: string): RPGClass | undefined {
    return this.classes.get(id);
  }

  getAllClasses(): RPGClass[] {
    return Array.from(this.classes.values());
  }

  getAvailableClasses(userLevel: number): RPGClass[] {
    return this.getAllClasses().filter(cls => cls.requiredLevel <= userLevel);
  }

  getClassByName(name: string): RPGClass | undefined {
    return this.getAllClasses().find(
      cls =>
        cls.name.toLowerCase() === name.toLowerCase() ||
        cls.id.toLowerCase() === name.toLowerCase(),
    );
  }

  getClassStatsBonus(classId: string): RPGClass['statsBonus'] | undefined {
    const cls = this.getClass(classId);
    return cls?.statsBonus;
  }

  formatClassList(userLevel: number): string {
    const availableClasses = this.getAvailableClasses(userLevel);
    let message = '⚔️ *CLASES DISPONIBLES*\n\n';

    for (const cls of availableClasses) {
      const locked = cls.requiredLevel > userLevel ? '🔒' : cls.emoji;
      message += `${locked} *${cls.name}*\n`;
      message += `   📝 ${cls.description}\n`;
      if (cls.requiredLevel > 1) {
        message += `   🔓 Requiere nivel ${cls.requiredLevel}\n`;
      }
      message += '\n';
    }

    return message.trim();
  }
}

export const classService = ClassService.getInstance();
