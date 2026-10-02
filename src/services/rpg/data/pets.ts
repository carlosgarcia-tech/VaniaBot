/**
 * pets.ts
 *
 * VaniaBot services module exposing `pets`.
 *
 * @author **Carlos G**
 */

import type { RPGItem } from '../ItemRegistry.js';

export const pets: RPGItem[] = [
  {
    id: 'pet_cat',
    name: 'Gato',
    description: 'Un lindo gato como mascota',
    type: 'pet',
    rarity: 'common',
    stats: { luck: 5 },
    value: 200,
    sellValue: 100,
    levelRequired: 1,
  },
  {
    id: 'pet_dog',
    name: 'Perro',
    description: 'Un fiel perro como mascota',
    type: 'pet',
    rarity: 'common',
    stats: { atk: 5, def: 5 },
    value: 250,
    sellValue: 125,
    levelRequired: 1,
  },
  {
    id: 'pet_owl',
    name: 'Búho',
    description: 'Un búho sabio',
    type: 'pet',
    rarity: 'uncommon',
    stats: { int: 15 },
    value: 500,
    sellValue: 250,
    levelRequired: 10,
  },
  {
    id: 'pet_wolf',
    name: 'Lobo',
    description: 'Un lobo feroz',
    type: 'pet',
    rarity: 'rare',
    stats: { atk: 20, agi: 10 },
    value: 1500,
    sellValue: 750,
    levelRequired: 20,
  },
  {
    id: 'pet_griffin',
    name: 'Grifo',
    description: 'Una criatura mítica',
    type: 'pet',
    rarity: 'epic',
    stats: { atk: 40, def: 30, agi: 20 },
    value: 5000,
    sellValue: 2500,
    levelRequired: 40,
  },
  {
    id: 'pet_dragon',
    name: 'Dragón Bebé',
    description: 'Un pequeño dragón',
    type: 'pet',
    rarity: 'legendary',
    stats: { atk: 60, def: 50, int: 30, luck: 20 },
    value: 15000,
    sellValue: 7500,
    levelRequired: 50,
  },
];
