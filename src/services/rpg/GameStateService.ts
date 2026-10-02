/**
 * GameStateService.ts
 *
 * VaniaBot services module exposing `PersistedMarketOffer`, `PersistedUserMissions`, `PersistedActiveCombat`, `PersistedLoan`.
 *
 * @author **Carlos G**
 */

import type { IDatabase } from '../database/Database.js';
import { logger, logError } from '@/utils/logger.js';

export interface PersistedMarketOffer {
  id: string;
  sellerJid: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  createdAt: number;
}

export interface PersistedUserMissions {
  userId: string;
  missions: Array<{
    missionId: string;
    progress: number;
    completed: boolean;
    claimed: boolean;
    expiresAt: number;
  }>;
  lastReset: number;
}

export interface PersistedActiveCombat {
  userJid: string;
  mobId: string;
  playerHp: number;
  turns: number;
  startedAt: number;
}

export interface PersistedLoan {
  id: string;
  lenderJid: string;
  borrowerJid: string;
  amount: number;
  interestRate: number;
  totalToRepay: number;
  remaining: number;
  createdAt: number;
  dueDate: number;
  status: 'pending' | 'active' | 'rejected' | 'paid' | 'defaulted';
}

export interface PersistedGameState {
  marketOffers: PersistedMarketOffer[];
  userMissions: PersistedUserMissions[];
  activeCombats: PersistedActiveCombat[];
  loans: PersistedLoan[];
  savedAt: number;
}

const SAVE_INTERVAL = 60_000;
const COLLECTION_NAME = 'game_state';

class GameStateService {
  private static instance: GameStateService;
  private saveTimer?: NodeJS.Timeout;
  private isDirty = false;
  private gameState: PersistedGameState = {
    marketOffers: [],
    userMissions: [],
    activeCombats: [],
    loans: [],
    savedAt: Date.now(),
  };
  private db: IDatabase | null = null;

  static getInstance(): GameStateService {
    if (!GameStateService.instance) {
      GameStateService.instance = new GameStateService();
    }
    return GameStateService.instance;
  }

  setDatabase(db: IDatabase): void {
    this.db = db;
  }

  async initialize(): Promise<void> {
    await this.loadState();
    this.startAutoSave();
  }

  private async loadState(): Promise<void> {
    if (!this.db) return;

    try {
      const saved = await this.db.get<PersistedGameState>(COLLECTION_NAME, 'state');
      if (saved) {
        this.gameState = {
          marketOffers: saved.marketOffers || [],
          userMissions: saved.userMissions || [],
          activeCombats: saved.activeCombats || [],
          loans: saved.loans || [],
          savedAt: saved.savedAt || Date.now(),
        };
        logger.info(
          `[GameState] Loaded: ${this.gameState.marketOffers.length} offers, ${this.gameState.userMissions.length} mission sets, ${this.gameState.activeCombats.length} combats, ${this.gameState.loans.length} loans`,
        );
      }
    } catch (error) {
      logError('[GameState] Failed to load state', error);
    }
  }

  private startAutoSave(): void {
    if (this.saveTimer) return;

    this.saveTimer = setInterval(() => {
      if (this.isDirty) {
        void this.saveState();
      }
    }, SAVE_INTERVAL);
  }

  async saveState(): Promise<void> {
    if (!this.db) return;

    try {
      this.gameState.savedAt = Date.now();
      await this.db.set(COLLECTION_NAME, 'state', this.gameState);
      this.isDirty = false;
      logger.debug('[GameState] Saved');
    } catch (error) {
      logError('[GameState] Failed to save state', error);
    }
  }

  markDirty(): void {
    this.isDirty = true;
  }

  setMarketOffers(offers: PersistedMarketOffer[]): void {
    this.gameState.marketOffers = offers;
    this.markDirty();
  }

  getMarketOffers(): PersistedMarketOffer[] {
    return this.gameState.marketOffers;
  }

  setUserMissions(
    userId: string,
    missions: PersistedUserMissions['missions'],
    lastReset: number,
  ): void {
    const existing = this.gameState.userMissions.findIndex(m => m.userId === userId);
    const data: PersistedUserMissions = { userId, missions, lastReset };

    if (existing >= 0) {
      this.gameState.userMissions[existing] = data;
    } else {
      this.gameState.userMissions.push(data);
    }
    this.markDirty();
  }

  getUserMissions(userId: string): PersistedUserMissions | undefined {
    return this.gameState.userMissions.find(m => m.userId === userId);
  }

  getAllUserMissions(): PersistedUserMissions[] {
    return this.gameState.userMissions;
  }

  setActiveCombats(combats: PersistedActiveCombat[]): void {
    this.gameState.activeCombats = combats;
    this.markDirty();
  }

  getActiveCombats(): PersistedActiveCombat[] {
    return this.gameState.activeCombats;
  }

  setLoans(loans: PersistedLoan[]): void {
    this.gameState.loans = loans;
    this.markDirty();
  }

  getLoans(): PersistedLoan[] {
    return this.gameState.loans;
  }

  clearExpiredMissions(): void {
    const now = Date.now();
    this.gameState.userMissions = this.gameState.userMissions.filter(um => {
      return um.missions.some(m => m.expiresAt > now);
    });
    this.markDirty();
  }

  clearExpiredCombats(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    this.gameState.activeCombats = this.gameState.activeCombats.filter(c => {
      return now - c.startedAt < maxAgeMs;
    });
    this.markDirty();
  }

  async shutdown(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
    await this.saveState();
    logger.info('[GameState] Shutdown complete');
  }
}

export const gameStateService = GameStateService.getInstance();
