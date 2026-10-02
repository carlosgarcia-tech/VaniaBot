/**
 * DailyMissionService.ts
 *
 * VaniaBot services module exposing `DailyMission`, `dailyMissionService`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '../system/Servicemanager.js';
import { gameStateService } from './GameStateService.js';
import { logger } from '@/utils/logger.js';

export interface DailyMission {
  id: string;
  name: string;
  description: string;
  type: 'work' | 'crime' | 'casino' | 'hunt' | 'fish' | 'mine' | 'commands' | 'earn';
  target: number;
  reward: number;
  xpReward: number;
  emoji: string;
}

const DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'trabajador',
    name: 'Trabajador',
    description: 'Trabaja 5 veces',
    type: 'work',
    target: 5,
    reward: 2000,
    xpReward: 100,
    emoji: '💼',
  },
  {
    id: 'delincuente',
    name: 'Delincuente',
    description: 'Comete 3 delitos',
    type: 'crime',
    target: 3,
    reward: 3000,
    xpReward: 150,
    emoji: '🚨',
  },
  {
    id: 'apostador',
    name: 'Apostador',
    description: 'Juega 5 veces en el casino',
    type: 'casino',
    target: 5,
    reward: 1500,
    xpReward: 75,
    emoji: '🎰',
  },
  {
    id: 'cazador',
    name: 'Cazador',
    description: 'Caza 10 mobs',
    type: 'hunt',
    target: 10,
    reward: 2500,
    xpReward: 200,
    emoji: '⚔️',
  },
  {
    id: 'pescador',
    name: 'Pescador',
    description: 'Pesca 10 veces',
    type: 'fish',
    target: 10,
    reward: 1500,
    xpReward: 100,
    emoji: '🎣',
  },
  {
    id: 'minero',
    name: 'Minero',
    description: 'Mina 10 veces',
    type: 'mine',
    target: 10,
    reward: 2000,
    xpReward: 150,
    emoji: '⛏️',
  },
  {
    id: 'sociable',
    name: 'Sociable',
    description: 'Usa 20 comandos',
    type: 'commands',
    target: 20,
    reward: 1000,
    xpReward: 50,
    emoji: '💬',
  },
  {
    id: 'rico',
    name: 'Emprendedor',
    description: 'Gana $10,000 en un día',
    type: 'earn',
    target: 10000,
    reward: 5000,
    xpReward: 300,
    emoji: '💰',
  },
];

interface UserMissionProgress {
  missionId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  expiresAt: number;
}

class DailyMissionService {
  private static instance: DailyMissionService;
  private userMissions = new Map<string, UserMissionProgress[]>();
  private lastReset = new Map<string, number>();

  static getInstance(): DailyMissionService {
    if (!DailyMissionService.instance) {
      DailyMissionService.instance = new DailyMissionService();
    }
    return DailyMissionService.instance;
  }

  loadFromPersistence(): void {
    gameStateService.clearExpiredMissions();
    const now = Date.now();
    const allMissions = gameStateService.getAllUserMissions();

    for (const userMission of allMissions) {
      const hasValidMission = userMission.missions.some(m => m.expiresAt > now);
      if (hasValidMission) {
        this.userMissions.set(userMission.userId, userMission.missions);
        this.lastReset.set(userMission.userId, userMission.lastReset);
      }
    }
    logger.debug(`[DailyMission] Loaded missions for ${this.userMissions.size} users`);
  }

  private shouldResetMissions(userId: string): boolean {
    const lastReset = this.lastReset.get(userId) || 0;
    const now = Date.now();
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);
    return hoursSinceReset >= 24;
  }

  getMissionsForUser(userId: string): UserMissionProgress[] {
    if (this.shouldResetMissions(userId)) {
      this.resetMissions(userId);
    }

    if (!this.userMissions.has(userId)) {
      this.resetMissions(userId);
    }

    return this.userMissions.get(userId) || [];
  }

  private resetMissions(userId: string): void {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const selectedMissions = this.selectRandomMissions(3);
    const progress: UserMissionProgress[] = selectedMissions.map(mission => ({
      missionId: mission.id,
      progress: 0,
      completed: false,
      claimed: false,
      expiresAt: tomorrow.getTime(),
    }));

    this.userMissions.set(userId, progress);
    this.lastReset.set(userId, Date.now());
    this.saveMissions(userId);
  }

  private saveMissions(userId: string): void {
    const missions = this.userMissions.get(userId);
    const resetTime = this.lastReset.get(userId) || Date.now();
    if (missions) {
      gameStateService.setUserMissions(userId, missions, resetTime);
    }
  }

  private selectRandomMissions(count: number): DailyMission[] {
    const shuffled = [...DAILY_MISSIONS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  getAllMissions(): DailyMission[] {
    return DAILY_MISSIONS;
  }

  getMission(id: string): DailyMission | undefined {
    return DAILY_MISSIONS.find(m => m.id === id);
  }

  async updateProgress(
    userId: string,
    missionType: string,
    amount: number = 1,
  ): Promise<DailyMission[]> {
    const missions = this.getMissionsForUser(userId);
    const completedMissions: DailyMission[] = [];

    for (const missionProgress of missions) {
      if (missionProgress.claimed) continue;

      const mission = this.getMission(missionProgress.missionId);
      if (!mission || mission.type !== missionType) continue;

      missionProgress.progress += amount;

      if (missionProgress.progress >= mission.target && !missionProgress.completed) {
        missionProgress.completed = true;
        completedMissions.push(mission);
      }
    }

    this.saveMissions(userId);
    return completedMissions;
  }

  async claimReward(
    userId: string,
    missionId: string,
  ): Promise<{ success: boolean; message: string; reward?: number; xpReward?: number }> {
    const missions = this.getMissionsForUser(userId);
    const missionProgress = missions.find(m => m.missionId === missionId);

    if (!missionProgress) {
      return { success: false, message: '❌ Misión no encontrada' };
    }

    if (!missionProgress.completed) {
      return { success: false, message: '❌ Misión no completada aún' };
    }

    if (missionProgress.claimed) {
      return { success: false, message: '❌ Recompensa ya reclamada' };
    }

    const mission = this.getMission(missionId);
    if (!mission) {
      return { success: false, message: '❌ Misión no encontrada' };
    }

    await serviceManager.userService.addMoney(userId, mission.reward);
    await serviceManager.levelService.addXP(userId, mission.xpReward);

    missionProgress.claimed = true;
    this.saveMissions(userId);

    return {
      success: true,
      message: `✅ ¡Misión completada!\n\n${mission.emoji} *${mission.name}*\n💰 Recompensa: $${mission.reward}\n✨ XP: ${mission.xpReward}`,
      reward: mission.reward,
      xpReward: mission.xpReward,
    };
  }

  async getUserMissionStatus(
    userId: string,
  ): Promise<{ missions: UserMissionProgress[]; missionsData: DailyMission[] }> {
    const missions = this.getMissionsForUser(userId);
    const missionsData = missions
      .map(m => this.getMission(m.missionId))
      .filter((m): m is DailyMission => m !== undefined);
    return { missions, missionsData };
  }
}

export const dailyMissionService = DailyMissionService.getInstance();
