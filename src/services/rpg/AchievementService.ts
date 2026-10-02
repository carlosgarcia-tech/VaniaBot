/**
 * AchievementService.ts
 *
 * VaniaBot services module exposing `Achievement`, `achievementService`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '../system/Servicemanager.js';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: number;
  category: 'level' | 'money' | 'crime' | 'casino' | 'work' | 'social' | 'collection';
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'level_5',
    name: 'Novato',
    description: 'Alcanza nivel 5',
    emoji: '🌱',
    reward: 200,
    category: 'level',
  },
  {
    id: 'level_10',
    name: 'Aprendiz',
    description: 'Alcanza nivel 10',
    emoji: '📚',
    reward: 500,
    category: 'level',
  },
  {
    id: 'level_25',
    name: 'Experto',
    description: 'Alcanza nivel 25',
    emoji: '🎓',
    reward: 1500,
    category: 'level',
  },
  {
    id: 'level_50',
    name: 'Maestro',
    description: 'Alcanza nivel 50',
    emoji: '🏆',
    reward: 5000,
    category: 'level',
  },
  {
    id: 'level_100',
    name: 'Leyenda',
    description: 'Alcanza nivel 100',
    emoji: '👑',
    reward: 15000,
    category: 'level',
  },
  {
    id: 'money_1000',
    name: 'Pobre',
    description: 'Acumula $1,000',
    emoji: '💵',
    reward: 100,
    category: 'money',
  },
  {
    id: 'money_10000',
    name: 'Clase Media',
    description: 'Acumula $10,000',
    emoji: '💰',
    reward: 500,
    category: 'money',
  },
  {
    id: 'money_100000',
    name: 'Rico',
    description: 'Acumula $100,000',
    emoji: '💎',
    reward: 2500,
    category: 'money',
  },
  {
    id: 'money_1000000',
    name: 'Millonario',
    description: 'Acumula $1,000,000',
    emoji: '🏦',
    reward: 10000,
    category: 'money',
  },
  {
    id: 'crime_1',
    name: 'Delincuente Primerizo',
    description: 'Comete tu primer delito',
    emoji: '🔓',
    reward: 100,
    category: 'crime',
  },
  {
    id: 'crime_10',
    name: 'Delincuente',
    description: 'Comete 10 delitos',
    emoji: '🔓',
    reward: 500,
    category: 'crime',
  },
  {
    id: 'crime_50',
    name: 'Criminal',
    description: 'Comete 50 delitos',
    emoji: '🔓',
    reward: 2000,
    category: 'crime',
  },
  {
    id: 'crime_100',
    name: 'Jefe del Crimen',
    description: 'Comete 100 delitos',
    emoji: '🔓',
    reward: 5000,
    category: 'crime',
  },
  {
    id: 'crime_success_10',
    name: 'Manos Ligeras',
    description: '10 robos exitosos',
    emoji: '👜',
    reward: 1000,
    category: 'crime',
  },
  {
    id: 'crime_success_50',
    name: 'Ladrón Maestro',
    description: '50 robos exitosos',
    emoji: '🥷',
    reward: 5000,
    category: 'crime',
  },
  {
    id: 'crime_rich',
    name: 'Asaltante',
    description: 'Roba $100,000 en total',
    emoji: '💰',
    reward: 3000,
    category: 'crime',
  },
  {
    id: 'casino_1',
    name: 'Apostador',
    description: 'Juega en el casino 1 vez',
    emoji: '🎰',
    reward: 100,
    category: 'casino',
  },
  {
    id: 'casino_50',
    name: 'Jugador',
    description: 'Juega en el casino 50 veces',
    emoji: '🎰',
    reward: 1000,
    category: 'casino',
  },
  {
    id: 'casino_win_1',
    name: 'Suerte Beginner',
    description: 'Gana 1 vez en el casino',
    emoji: '🍀',
    reward: 200,
    category: 'casino',
  },
  {
    id: 'casino_win_10',
    name: 'Afortunado',
    description: 'Gana 10 veces en el casino',
    emoji: '🍀',
    reward: 1500,
    category: 'casino',
  },
  {
    id: 'casino_win_50',
    name: 'Dichoso',
    description: 'Gana 50 veces en el casino',
    emoji: '🍀',
    reward: 5000,
    category: 'casino',
  },
  {
    id: 'casino_lose_10',
    name: 'Gastador',
    description: 'Pierde 10 veces en el casino',
    emoji: '💸',
    reward: 500,
    category: 'casino',
  },
  {
    id: 'work_1',
    name: 'Trabajador',
    description: 'Trabaja por primera vez',
    emoji: '💼',
    reward: 50,
    category: 'work',
  },
  {
    id: 'work_100',
    name: 'Empleado',
    description: 'Trabaja 100 veces',
    emoji: '💼',
    reward: 1000,
    category: 'work',
  },
  {
    id: 'work_500',
    name: 'Profesional',
    description: 'Trabaja 500 veces',
    emoji: '💼',
    reward: 5000,
    category: 'work',
  },
  {
    id: 'work_1000',
    name: 'Workaholic',
    description: 'Trabaja 1000 veces',
    emoji: '⚡',
    reward: 10000,
    category: 'work',
  },
  {
    id: 'daily_1',
    name: 'Consistente',
    description: 'Reclama tu primer daily',
    emoji: '📅',
    reward: 50,
    category: 'social',
  },
  {
    id: 'daily_7',
    name: 'Semanal',
    description: '7 días de daily seguidos',
    emoji: '📅',
    reward: 500,
    category: 'social',
  },
  {
    id: 'daily_30',
    name: 'Mensual',
    description: '30 días de daily seguidos',
    emoji: '📅',
    reward: 3000,
    category: 'social',
  },
  {
    id: 'daily_100',
    name: 'Dedicado',
    description: '100 días de daily seguidos',
    emoji: '🔥',
    reward: 10000,
    category: 'social',
  },

  {
    id: 'items_5',
    name: 'Coleccionista Beginner',
    description: 'Consigue 5 items diferentes',
    emoji: '📦',
    reward: 200,
    category: 'collection',
  },
  {
    id: 'items_20',
    name: 'Coleccionista',
    description: 'Consigue 20 items diferentes',
    emoji: '📦',
    reward: 1000,
    category: 'collection',
  },
  {
    id: 'items_50',
    name: 'Coleccionista Master',
    description: 'Consigue 50 items diferentes',
    emoji: '📦',
    reward: 5000,
    category: 'collection',
  },
];

class AchievementService {
  private static instance: AchievementService;
  private userStats = new Map<
    string,
    {
      crimes: number;
      crimesSuccess: number;
      totalStolen: number;
      casinoPlays: number;
      casinoWins: number;
      casinoLoses: number;
      works: number;
      dailys: number;
    }
  >();

  static getInstance(): AchievementService {
    if (!AchievementService.instance) {
      AchievementService.instance = new AchievementService();
    }
    return AchievementService.instance;
  }

  getAchievement(id: string): Achievement | undefined {
    return ACHIEVEMENTS.find(a => a.id === id);
  }

  getAllAchievements(): Achievement[] {
    return ACHIEVEMENTS;
  }

  getAchievementsByCategory(category: string): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.category === category);
  }

  private getUserStats(jid: string) {
    if (!this.userStats.has(jid)) {
      this.userStats.set(jid, {
        crimes: 0,
        crimesSuccess: 0,
        totalStolen: 0,
        casinoPlays: 0,
        casinoWins: 0,
        casinoLoses: 0,
        works: 0,
        dailys: 0,
      });
    }
    const stats = this.userStats.get(jid);
    return (
      stats ?? {
        jid: '',
        crimes: 0,
        crimesSuccess: 0,
        totalStolen: 0,
        casinoPlays: 0,
        casinoWins: 0,
        casinoLoses: 0,
        works: 0,
        dailys: 0,
      }
    );
  }

  async trackCrime(jid: string, success: boolean, amountStolen: number = 0): Promise<string[]> {
    const stats = this.getUserStats(jid);
    stats.crimes++;
    if (success) {
      stats.crimesSuccess++;
      stats.totalStolen += amountStolen;
    }
    return this.checkCrimeAchievements(jid);
  }

  async trackCasino(jid: string, won: boolean): Promise<string[]> {
    const stats = this.getUserStats(jid);
    stats.casinoPlays++;
    if (won) {
      stats.casinoWins++;
    } else {
      stats.casinoLoses++;
    }
    return this.checkCasinoAchievements(jid);
  }

  async trackWork(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    stats.works++;
    return this.checkWorkAchievements(jid);
  }

  async trackDaily(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    stats.dailys++;
    return this.checkDailyAchievements(jid);
  }

  private async checkCrimeAchievements(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: stats.crimes >= 1, id: 'crime_1' },
      { condition: stats.crimes >= 10, id: 'crime_10' },
      { condition: stats.crimes >= 50, id: 'crime_50' },
      { condition: stats.crimes >= 100, id: 'crime_100' },
      { condition: stats.crimesSuccess >= 10, id: 'crime_success_10' },
      { condition: stats.crimesSuccess >= 50, id: 'crime_success_50' },
      { condition: stats.totalStolen >= 100000, id: 'crime_rich' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  private async checkCasinoAchievements(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: stats.casinoPlays >= 1, id: 'casino_1' },
      { condition: stats.casinoPlays >= 50, id: 'casino_50' },
      { condition: stats.casinoWins >= 1, id: 'casino_win_1' },
      { condition: stats.casinoWins >= 10, id: 'casino_win_10' },
      { condition: stats.casinoWins >= 50, id: 'casino_win_50' },
      { condition: stats.casinoLoses >= 10, id: 'casino_lose_10' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  private async checkWorkAchievements(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: stats.works >= 1, id: 'work_1' },
      { condition: stats.works >= 100, id: 'work_100' },
      { condition: stats.works >= 500, id: 'work_500' },
      { condition: stats.works >= 1000, id: 'work_1000' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  private async checkDailyAchievements(jid: string): Promise<string[]> {
    const stats = this.getUserStats(jid);
    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: stats.dailys >= 1, id: 'daily_1' },
      { condition: stats.dailys >= 7, id: 'daily_7' },
      { condition: stats.dailys >= 30, id: 'daily_30' },
      { condition: stats.dailys >= 100, id: 'daily_100' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  async checkLevelAchievements(jid: string): Promise<string[]> {
    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: user.level >= 5, id: 'level_5' },
      { condition: user.level >= 10, id: 'level_10' },
      { condition: user.level >= 25, id: 'level_25' },
      { condition: user.level >= 50, id: 'level_50' },
      { condition: user.level >= 100, id: 'level_100' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  async checkMoneyAchievements(jid: string): Promise<string[]> {
    const user = await serviceManager.userService.getUser(jid);
    const netWorth = user.money + (user.bank || 0);
    const achievements = user.achievements || [];
    const newAchievements: string[] = [];

    const checks = [
      { condition: netWorth >= 1000, id: 'money_1000' },
      { condition: netWorth >= 10000, id: 'money_10000' },
      { condition: netWorth >= 100000, id: 'money_100000' },
      { condition: netWorth >= 1000000, id: 'money_1000000' },
    ];

    for (const check of checks) {
      if (check.condition && !achievements.includes(check.id)) {
        achievements.push(check.id);
        newAchievements.push(check.id);
      }
    }

    if (newAchievements.length > 0) {
      await serviceManager.userService.updateUser(jid, { achievements });
    }

    return newAchievements;
  }

  async grantAchievement(jid: string, achievementId: string): Promise<boolean> {
    const achievement = this.getAchievement(achievementId);
    if (!achievement) return false;

    const user = await serviceManager.userService.getUser(jid);
    const achievements = user.achievements || [];

    if (achievements.includes(achievementId)) return false;

    achievements.push(achievementId);
    await serviceManager.userService.updateUser(jid, { achievements });
    await serviceManager.userService.addMoney(jid, achievement.reward);

    return true;
  }
}

export const achievementService = AchievementService.getInstance();
