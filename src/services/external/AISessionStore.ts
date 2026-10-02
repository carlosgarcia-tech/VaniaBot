/**
 * AISessionStore.ts
 *
 * VaniaBot services module exposing `AISessionStore`.
 *
 * @author **Carlos G**
 */

import { serviceManager } from '@/services/system/Servicemanager.js';
import { logError, logger } from '@/utils/logger.js';
import type { ConversationSession } from './AITypes.js';
import {
  SESSION_TTL_MS,
  CLEANUP_INTERVAL_MS,
  PERSIST_INTERVAL_MS,
  AI_SESSIONS_COLLECTION,
} from './AITypes.js';
import { env } from '@/config/env.js';

export class AISessionStore {
  private sessions: Map<string, ConversationSession> = new Map();
  private dirtySessions = new Set<string>();
  private cleanupTimer: NodeJS.Timeout;
  private persistTimer: NodeJS.Timeout;
  private initialized = false;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupExpiredSessions();
      } catch (error) {
        logError('[AI] cleanupExpiredSessions', error);
      }
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();

    this.persistTimer = setInterval(() => {
      try {
        void this.persistDirtySessions();
      } catch (error) {
        logError('[AI] persistDirtySessions', error);
      }
    }, PERSIST_INTERVAL_MS);
    this.persistTimer.unref();
  }

  private sessionKey(chatJid: string, senderJid: string): string {
    return `${chatJid}::${senderJid}`;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.loadSessionsFromDb();
      this.initialized = true;
      logger.debug(`[AI] ${this.sessions.size} sesiones cargadas desde DB`);
    } catch (error) {
      logger.warn('[AI] Error loading sessions from DB, using in-memory only');
      logError('[AI] Load sessions from DB', error);
      this.initialized = true;
    }
  }

  private async loadSessionsFromDb(): Promise<void> {
    if (!serviceManager.db?.isConnected()) {
      logger.debug('[AI] Database not connected, skipping session load');
      return;
    }
    try {
      const sessions = await serviceManager.db.find<ConversationSession>(
        AI_SESSIONS_COLLECTION,
        {},
      );
      const now = Date.now();
      for (const session of sessions) {
        if (now - session.lastActivity < SESSION_TTL_MS) {
          const key = this.sessionKey(session.chatJid, session.senderJid);
          this.sessions.set(key, session);
        }
      }
    } catch (error) {
      logError('[AI] Failed to load sessions from DB', error);
    }
  }

  private async persistSession(session: ConversationSession): Promise<void> {
    if (!serviceManager.db?.isConnected()) return;
    try {
      const key = this.sessionKey(session.chatJid, session.senderJid);
      await serviceManager.db.set(AI_SESSIONS_COLLECTION, key, session);
    } catch (error) {
      logError('[AI] Failed to persist session', error);
    }
  }

  private async persistDirtySessions(): Promise<void> {
    if (this.dirtySessions.size === 0) return;

    const sessionsToPersist: Array<{ key: string; session: ConversationSession }> = [];
    for (const key of this.dirtySessions) {
      const session = this.sessions.get(key);
      if (session) sessionsToPersist.push({ key, session });
    }

    if (sessionsToPersist.length === 0) return;

    try {
      const results = await Promise.allSettled(
        sessionsToPersist.map(({ session }) => this.persistSession(session)),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      if (failed > 0) {
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'rejected') {
            this.dirtySessions.add(sessionsToPersist[i].key);
          }
        }
        logger.error(`[AI] ${failed}/${sessionsToPersist.length} sessions failed to persist`);
        logger.debug(
          `[AI] Persisted ${succeeded}/${sessionsToPersist.length} sessions, ${failed} re-marked dirty`,
        );
      } else {
        logger.debug(`[AI] Persisted ${sessionsToPersist.length} sessions to DB`);
      }
    } catch (error) {
      logError('[AI] Failed to persist sessions', error);
    }

    this.dirtySessions.clear();
  }

  markDirty(chatJid: string, senderJid: string): void {
    const key = this.sessionKey(chatJid, senderJid);
    this.dirtySessions.add(key);
  }

  getSession(chatJid: string, senderJid: string): ConversationSession {
    const key = this.sessionKey(chatJid, senderJid);
    let session = this.sessions.get(key);

    if (!session) {
      const maxSessions = env.MAX_AI_SESSIONS;
      if (this.sessions.size >= maxSessions) {
        logger.warn(`[AI] Max sessions (${maxSessions}) reached, evicting oldest`);
        const oldest = [...this.sessions.entries()].sort(
          (a, b) => a[1].lastActivity - b[1].lastActivity,
        )[0];
        if (oldest) {
          this.sessions.delete(oldest[0]);
          this.dirtySessions.delete(oldest[0]);
        }
      }

      session = {
        chatJid,
        senderJid,
        history: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      this.sessions.set(key, session);
    }

    return session;
  }

  async clearSession(chatJid: string, senderJid: string): Promise<void> {
    const key = this.sessionKey(chatJid, senderJid);
    this.sessions.delete(key);
    this.dirtySessions.delete(key);

    if (serviceManager.db?.isConnected()) {
      try {
        await serviceManager.db.delete(AI_SESSIONS_COLLECTION, key);
      } catch (error) {
        logError('[AI] Failed to delete session from DB', error);
      }
    }
  }

  async clearGroupSessions(chatJid: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const key of this.sessions.keys()) {
      if (key.startsWith(`${chatJid}::`)) {
        keysToDelete.push(key);
        this.sessions.delete(key);
        this.dirtySessions.delete(key);
      }
    }

    if (serviceManager.db?.isConnected()) {
      try {
        const groupSessions = await serviceManager.db.find<ConversationSession>(
          AI_SESSIONS_COLLECTION,
          { chatJid },
        );
        await Promise.all(
          groupSessions.map(s =>
            serviceManager.db.delete(
              AI_SESSIONS_COLLECTION,
              this.sessionKey(s.chatJid, s.senderJid),
            ),
          ),
        );
      } catch (error) {
        logError('[AI] Failed to clear group sessions from DB', error);
      }
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getStats(): {
    inMemory: number;
    dirty: number;
    persisted: number;
  } {
    return {
      inMemory: this.sessions.size,
      dirty: this.dirtySessions.size,
      persisted: this.dirtySessions.size === 0 ? this.sessions.size : 0,
    };
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL_MS) {
        this.sessions.delete(key);
        this.dirtySessions.delete(key);
        cleaned++;

        if (serviceManager.db?.isConnected()) {
          serviceManager.db
            .delete(AI_SESSIONS_COLLECTION, key)
            .catch((error: unknown) => logError('[AISessionStore]', error));
        }
      }
    }

    if (cleaned > 0) logger.debug(`[AI] ${cleaned} sesiones expiradas eliminadas`);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupTimer);
    clearInterval(this.persistTimer);

    if (this.dirtySessions.size > 0) {
      logger.info(`[AI] Persisting ${this.dirtySessions.size} sessions before shutdown...`);
      await this.persistDirtySessions();
    }
  }
}
