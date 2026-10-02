/**
 * PetService.ts
 *
 * VaniaBot services module exposing `PetService`, `PetData`, `petService`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '../system/Servicemanager.js';
import type { Either } from '@/utils/either.js';
import { left, right } from '@/utils/either.js';
import type { User, Pet } from '../database/UserService.js';

export interface PetData {
  id: string;
  name: string;
  emoji: string;
  description: string;
  baseStats: Record<string, number>;
  type: string;
}

export type PetResult = Either<{ message: string }, { message: string }>;

export class PetService {
  private static instance: PetService;
  private petData: Map<string, PetData> = new Map();

  private constructor() {
    this.registerPets();
  }

  static getInstance(): PetService {
    if (!PetService.instance) {
      PetService.instance = new PetService();
    }
    return PetService.instance;
  }

  private registerPets(): void {
    const pets: PetData[] = [
      {
        id: 'pet_cat',
        name: 'Gato',
        emoji: '🐱',
        description: 'Un lindo gato que te da suerte',
        baseStats: { luck: 5 },
        type: 'companion',
      },
      {
        id: 'pet_dog',
        name: 'Perro',
        emoji: '🐕',
        description: 'Un fiel compañero leal',
        baseStats: { atk: 5, def: 5 },
        type: 'companion',
      },
      {
        id: 'pet_owl',
        name: 'Búho',
        emoji: '🦉',
        description: 'Un búho sabio',
        baseStats: { int: 15 },
        type: 'companion',
      },
      {
        id: 'pet_hamster',
        name: 'Hámster',
        emoji: '🐹',
        description: 'Un pequeño roedor adorable',
        baseStats: { luck: 10, agi: 5 },
        type: 'companion',
      },
      {
        id: 'pet_rabbit',
        name: 'Conejo',
        emoji: '🐰',
        description: 'Un conejo saltarín',
        baseStats: { agi: 10, luck: 5 },
        type: 'companion',
      },
      {
        id: 'pet_wolf',
        name: 'Lobo',
        emoji: '🐺',
        description: 'Un lobo feroz como compañero',
        baseStats: { atk: 20, agi: 10 },
        type: 'combat',
      },
      {
        id: 'pet_fox',
        name: 'Zorro',
        emoji: '🦊',
        description: 'Un zorro astuto',
        baseStats: { agi: 15, luck: 15 },
        type: 'combat',
      },
      {
        id: 'pet_bear',
        name: 'Oso',
        emoji: '🐻',
        description: 'Un oso poderoso',
        baseStats: { atk: 25, def: 20, hp: 50 },
        type: 'combat',
      },
      {
        id: 'pet_tiger',
        name: 'Tigre',
        emoji: '🐯',
        description: 'Un tigre feroz',
        baseStats: { atk: 30, agi: 20 },
        type: 'combat',
      },
      {
        id: 'pet_griffin',
        name: 'Grifo',
        emoji: '🦅',
        description: 'Una criatura mítica',
        baseStats: { atk: 40, def: 30, agi: 20 },
        type: 'mythical',
      },
      {
        id: 'pet_phoenix',
        name: 'Fénix',
        emoji: '🔥',
        description: 'El ave legendaria',
        baseStats: { int: 50, atk: 40, luck: 30 },
        type: 'mythical',
      },
      {
        id: 'pet_dragon',
        name: 'Dragón',
        emoji: '🐉',
        description: 'Un dragón bebé',
        baseStats: { atk: 60, def: 50, hp: 100, luck: 20 },
        type: 'mythical',
      },
    ];

    pets.forEach(pet => this.petData.set(pet.id, pet));
  }

  getPetData(id: string): PetData | undefined {
    return this.petData.get(id);
  }

  getPetDataByName(name: string): PetData | undefined {
    return Array.from(this.petData.values()).find(
      pet => pet.name.toLowerCase().includes(name.toLowerCase()) || pet.id === name.toLowerCase(),
    );
  }

  getAllPetData(): PetData[] {
    return Array.from(this.petData.values());
  }

  async adoptPet(jid: string, petIdOrName: string): Promise<PetResult> {
    const petData = this.getPetDataByName(petIdOrName);
    if (!petData) {
      return left({ message: '❌ Mascota no encontrada' });
    }

    const user = await serviceManager.userService.getUser(jid);
    const hasPet = user.pets?.some(p => p.id === petData.id);

    if (hasPet) {
      return left({ message: '❌ Ya tienes esta mascota' });
    }

    const newPet: Pet = {
      id: petData.id,
      name: petData.name,
      level: 1,
      xp: 0,
      happiness: 100,
      hunger: 0,
      stats: { ...petData.baseStats },
      equipped: true,
    };

    await serviceManager.userService.updateUser(jid, {
      pets: [...(user.pets || []), newPet],
    });

    return right({
      message: `✅ ¡Adoptaste a ${petData.emoji} ${petData.name}!`,
    });
  }

  async releasePet(jid: string, petIdOrName: string): Promise<PetResult> {
    const user = await serviceManager.userService.getUser(jid);
    const pets = user.pets || [];

    const petIndex = pets.findIndex(
      p =>
        p.id === petIdOrName.toLowerCase() ||
        p.name.toLowerCase().includes(petIdOrName.toLowerCase()),
    );

    if (petIndex === -1) {
      return left({ message: '❌ No tienes esa mascota' });
    }

    const newPets = [...pets];
    newPets.splice(petIndex, 1);

    await serviceManager.userService.updateUser(jid, { pets: newPets });

    return right({ message: `✅ Liberaste a la mascota` });
  }

  async feedPet(jid: string, petIdOrName: string): Promise<PetResult> {
    const user = await serviceManager.userService.getUser(jid);
    const pets = user.pets || [];

    const pet = pets.find(
      p =>
        p.id === petIdOrName.toLowerCase() ||
        p.name.toLowerCase().includes(petIdOrName.toLowerCase()),
    );

    if (!pet) {
      return left({ message: '❌ No tienes esa mascota' });
    }

    if (pet.hunger <= 0) {
      return left({ message: '❌ Tu mascota no tiene hambre' });
    }

    const foodItems = ['bread', 'meat', 'fish', 'apple', 'cookie'];
    const hasFood = user.inventory?.some(i => foodItems.includes(i.itemId));

    if (!hasFood) {
      return left({ message: '❌ Necesitas comida para alimentar a tu mascota' });
    }

    const foodItem = user.inventory.find(i => foodItems.includes(i.itemId));
    if (foodItem) {
      await serviceManager.userService.removeItem(jid, foodItem.itemId);
    }

    const newHunger = Math.max(0, pet.hunger - 30);
    const newHappiness = Math.min(100, pet.happiness + 10);

    const updatedPets = pets.map(p => {
      if (p.id === pet.id) {
        return { ...p, hunger: newHunger, happiness: newHappiness };
      }
      return p;
    });

    await serviceManager.userService.updateUser(jid, { pets: updatedPets });

    return right({
      message: `🍖 ¡Alimentaste a ${pet.name}! Hambre: ${newHunger}% | Felicidad: ${newHappiness}%`,
    });
  }

  async getPetBonus(jid: string): Promise<Record<string, number>> {
    const user = await serviceManager.userService.getUser(jid);
    const pets = user.pets || [];

    const bonus: Record<string, number> = {};

    for (const pet of pets) {
      if (pet.equipped && pet.stats) {
        for (const [stat, value] of Object.entries(pet.stats)) {
          const levelBonus = Math.floor(pet.level / 5);
          bonus[stat] = (bonus[stat] || 0) + value + levelBonus;
        }
      }
    }

    return bonus;
  }

  formatPetList(user: User): string {
    const pets = user.pets || [];

    if (pets.length === 0) {
      return '🐾 *No tienes mascotas*\n\n💡 Usa !pet adopt [nombre] para adoptar una';
    }

    let message = '🐾 *TUS MASCOTAS*\n\n';

    for (const pet of pets) {
      const petData = this.getPetData(pet.id);
      message += `${petData?.emoji || '🐾'} *${pet.name}*\n`;
      message += `   📊 Nivel: ${pet.level} | XP: ${pet.xp}\n`;
      message += `   😊 Felicidad: ${pet.happiness}%\n`;
      message += `   🍽️ Hambre: ${pet.hunger}%\n`;
      message += `   ⚔️ ${pet.equipped ? '✅ Equipado' : '❌ No equipado'}\n`;

      if (pet.stats) {
        message += `   📈 Stats: `;
        message += Object.entries(pet.stats)
          .map(([s, v]) => `${s}: +${v}`)
          .join(', ');
        message += '\n';
      }
      message += '\n';
    }

    return message.trim();
  }
}

export const petService = PetService.getInstance();
