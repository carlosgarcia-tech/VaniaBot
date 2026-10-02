/**
 * PersistenceService.ts
 *
 * Durable state for timers-driven features: reminders, polls and listas
 * (roster games).
 *
 * All three are kept in memory for fast reads and mirrored to the database so
 * they survive a restart. On startup only still-relevant entries are loaded —
 * expired reminders and closed/expired polls are dropped rather than
 * rescheduled, and listas must still be inside their TTL.
 *
 * The socket is injected separately from the database because it only exists
 * after authentication; reminders are rescheduled once it is set.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { WASocket } from 'baileys';
import type { Database } from '../database/Database.js';
import { randomUUID } from 'crypto';
import { logger, logError } from '@/utils/logger.js';

/** A scheduled one-shot message. */
export interface Reminder {
  id: string;
  userJid: string;
  chatJid: string;
  message: string;
  triggerAt: number;
  createdAt: number;
}

/** One choice and the JIDs that voted for it. */
export interface PollOption {
  label: string;
  votes: string[];
}

/** A group poll; keyed by chat, so at most one is active per chat. */
export interface Poll {
  id: string;
  chatJid: string;
  creatorJid: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  createdAt: number;
  endsAt?: number;
  closed: boolean;
}

/**
 * Persisted list game (squads, substitutes, capacity).
 * Field names are the domain's own Spanish, kept for compatibility with
 * existing stored records.
 */
export interface ListaPersistida {
  tipo: string;
  chatJid: string;
  messageId: string;
  horaTexto: string;
  horaMex: string;
  horaCol: string;
  liga?: string;
  color?: string;
  escuadras: Array<{ jugadores: Array<{ jid: string; nombre: string }>; capacidad: number }>;
  suplentes: Array<{ jid: string; nombre: string }>;
  maxSuplentes: number;
  creadoEn: number;
  activa: boolean;
}

export class PersistenceService {
  private static instance: PersistenceService;
  private reminders = new Map<string, Reminder>();
  /** Pending timeout per reminder, cleared on removal so it cannot fire twice. */
  private reminderTimers = new Map<string, NodeJS.Timeout>();
  private polls = new Map<string, Poll>();
  private pollTimers = new Map<string, NodeJS.Timeout>();
  private listas = new Map<string, ListaPersistida>();
  private db: Database | null = null;
  private sock: WASocket | null = null;
  private initialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  /** Cap on stored reminders; the soonest-to-fire are evicted first. */
  private readonly MAX_TOTAL_REMINDERS = 1000;
  private readonly DB_REMINDERS_KEY = 'system:reminders';
  private readonly DB_POLLS_KEY = 'system:polls';
  private readonly DB_LISTAS_KEY = 'game:listas';

  static getInstance(): PersistenceService {
    if (!PersistenceService.instance) {
      PersistenceService.instance = new PersistenceService();
    }
    return PersistenceService.instance;
  }

  /**
   * Injects the live socket so pending timers can actually send.
   * Called once the connection opens; without it timers still expire but the
   * message is dropped.
   */
  setSocket(sock: WASocket): void {
    this.sock = sock;
  }

  /** Injects the database used for mirroring state. */
  setDatabase(db: Database): void {
    this.db = db;
  }

  /**
   * Loads persisted state and starts the hourly sweep.
   * Idempotent: subsequent calls are ignored so a reconnect cannot double-schedule.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.loadReminders();
    await this.loadPolls();
    await this.loadListas();
    this.rescheduleReminders();
    this.startCleanup();

    logger.debug(
      `PersistenceService: ${this.reminders.size} reminders, ${this.polls.size} polls, ${this.listas.size} listas loaded`,
    );
  }

  private async loadReminders(): Promise<void> {
    if (!this.db) return;
    try {
      const stored = await this.db.get<Record<string, Reminder>>(this.DB_REMINDERS_KEY, 'data');
      if (stored) {
        for (const [id, reminder] of Object.entries(stored)) {
          if (reminder && reminder.triggerAt > Date.now()) {
            this.reminders.set(id, reminder);
          }
        }
      }
    } catch (error) {
      logError('PersistenceService.loadReminders', error);
    }
  }

  private async loadPolls(): Promise<void> {
    if (!this.db) return;
    try {
      const stored = await this.db.get<Record<string, Poll>>(this.DB_POLLS_KEY, 'data');
      if (stored) {
        for (const [chatJid, poll] of Object.entries(stored)) {
          if (poll && !poll.closed && (!poll.endsAt || poll.endsAt > Date.now())) {
            this.polls.set(chatJid, poll);
          }
        }
      }
    } catch (error) {
      logError('PersistenceService.loadPolls', error);
    }
  }

  async loadListas(): Promise<void> {
    if (!this.db) return;
    try {
      const stored = await this.db.get<Record<string, ListaPersistida>>(this.DB_LISTAS_KEY, 'data');
      if (stored) {
        const now = Date.now();
        for (const [messageId, lista] of Object.entries(stored)) {
          if (!lista) continue;
          const ttl = this.getListaTTL();
          if (lista.activa && now - lista.creadoEn < ttl) {
            this.listas.set(messageId, lista);
          }
        }
      }
      logger.debug(`[Persistence] ${this.listas.size} listas loaded from DB`);
    } catch (error) {
      logError('PersistenceService.loadListas', error);
    }
  }

  /** Lista lifetime in milliseconds, overridable via LISTA_TTL_HOURS. */
  private getListaTTL(): number {
    const envTTL = parseInt(process.env.LISTA_TTL_HOURS || '12', 10);
    return envTTL * 60 * 60 * 1000;
  }

  private async saveReminders(): Promise<void> {
    if (!this.db) return;
    const data: Record<string, Reminder> = {};
    for (const [id, reminder] of this.reminders) {
      data[id] = reminder;
    }
    try {
      await this.db.set(this.DB_REMINDERS_KEY, 'data', data);
    } catch (error) {
      // Most call sites are fire-and-forget (`void`): catching here
      // avoids unhandled rejections and records disk failures.
      logError('PersistenceService.saveReminders', error);
    }
  }

  private async savePolls(): Promise<void> {
    if (!this.db) return;
    const data: Record<string, Poll> = {};
    for (const [chatJid, poll] of this.polls) {
      data[chatJid] = poll;
    }
    try {
      await this.db.set(this.DB_POLLS_KEY, 'data', data);
    } catch (error) {
      logError('PersistenceService.savePolls', error);
    }
  }

  async saveLista(messageId: string, lista: ListaPersistida): Promise<void> {
    this.listas.set(messageId, lista);
    await this.persistListas();
  }

  async removeLista(messageId: string): Promise<void> {
    this.listas.delete(messageId);
    await this.persistListas();
  }

  /**
   * Fetches a live lista, dropping and returning undefined when past its TTL.
   */
  getLista(messageId: string): ListaPersistida | undefined {
    const lista = this.listas.get(messageId);
    if (!lista) return undefined;
    const ttl = this.getListaTTL();
    if (Date.now() - lista.creadoEn > ttl) {
      this.listas.delete(messageId);
      return undefined;
    }
    return lista;
  }

  /** Snapshot of every stored lista, expired ones included. */
  getAllListas(): ListaPersistida[] {
    return [...this.listas.values()];
  }

  private async persistListas(): Promise<void> {
    if (!this.db) return;
    const data: Record<string, ListaPersistida> = {};
    for (const [messageId, lista] of this.listas) {
      data[messageId] = lista;
    }
    try {
      await this.db.set(this.DB_LISTAS_KEY, 'data', data);
    } catch (error) {
      logError('PersistenceService.persistListas', error);
    }
  }

  private rescheduleReminders(): void {
    if (!this.sock) return;
    for (const reminder of this.reminders.values()) {
      if (reminder.triggerAt > Date.now()) {
        this.scheduleReminder(reminder);
      }
    }
  }

  /**
   * Hourly sweep.
   *
   * Drops fired/expired reminders and polls (clearing their timers), trims
   * reminders over MAX_TOTAL_REMINDERS by dropping the soonest-to-fire first,
   * then persists both collections. The timer is unref'd so it never keeps the
   * process alive.
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(
      () => {
        const now = Date.now();

        for (const [id, reminder] of this.reminders.entries()) {
          if (reminder.triggerAt < now) {
            this.reminders.delete(id);
            const timer = this.reminderTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              this.reminderTimers.delete(id);
            }
          }
        }

        for (const [chatJid, poll] of this.polls.entries()) {
          if (poll.closed || (poll.endsAt && poll.endsAt < now)) {
            this.polls.delete(chatJid);
            const timer = this.pollTimers.get(chatJid);
            if (timer) {
              clearTimeout(timer);
              this.pollTimers.delete(chatJid);
            }
          }
        }

        if (this.reminders.size > this.MAX_TOTAL_REMINDERS) {
          const sorted = [...this.reminders.entries()].sort(
            (a, b) => a[1].triggerAt - b[1].triggerAt,
          );
          const toDelete = sorted.slice(0, this.reminders.size - this.MAX_TOTAL_REMINDERS);
          for (const [id] of toDelete) {
            this.reminders.delete(id);
            const timer = this.reminderTimers.get(id);
            if (timer) {
              clearTimeout(timer);
              this.reminderTimers.delete(id);
            }
          }
        }

        void this.saveReminders();
        void this.savePolls();
      },
      60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  /**
   * Stops the cleanup interval and every pending reminder/poll timer.
   * Part of the graceful shutdown chain.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const timer of this.reminderTimers.values()) {
      clearTimeout(timer);
    }
    this.reminderTimers.clear();
    for (const timer of this.pollTimers.values()) {
      clearTimeout(timer);
    }
    this.pollTimers.clear();
  }

  /**
   * Arms a reminder timer.
   *
   * On fire it sends the message, then removes the reminder and persists. A send
   * failure is logged but still removes the entry, so one unreachable chat does
   * not leave a permanently failing timer behind.
   */
  private scheduleReminder(reminder: Reminder): void {
    const delay = reminder.triggerAt - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (this.sock) {
            await this.sock.sendMessage(reminder.chatJid, {
              text:
                `⏰ *¡Recordatorio!*\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `📝 ${reminder.message}\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `👤 @${reminder.userJid.split('@')[0]}`,
              mentions: [reminder.userJid],
            });
          }
        } catch (error) {
          // The reminder is lost if the send fails, but it must be
          // logged: without this the failure was completely silent.
          logError(`PersistenceService.sendReminder ${reminder.id}`, error);
        }
        this.reminders.delete(reminder.id);
        this.reminderTimers.delete(reminder.id);
        void this.saveReminders();
      })();
    }, delay);

    this.reminderTimers.set(reminder.id, timer);
  }

  addReminder(reminder: Reminder): void {
    this.reminders.set(reminder.id, reminder);
    this.scheduleReminder(reminder);
    void this.saveReminders();
  }

  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  getUserReminders(userJid: string): Reminder[] {
    return [...this.reminders.values()].filter(r => r.userJid === userJid);
  }

  removeReminder(id: string): void {
    const timer = this.reminderTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reminderTimers.delete(id);
    }
    this.reminders.delete(id);
    void this.saveReminders();
  }

  /** Short, human-quotable identifier: the first segment of a UUID, uppercased. */
  generateId(): string {
    return randomUUID().split('-')[0].toUpperCase();
  }

  /**
   * Fetches the active poll for a chat.
   * A poll past `endsAt` is marked closed and persisted here, so expiry does not
   * depend on its timer having fired.
   */
  getPoll(chatJid: string): Poll | undefined {
    const poll = this.polls.get(chatJid);
    if (!poll) return undefined;
    if (poll.endsAt && poll.endsAt < Date.now()) {
      poll.closed = true;
      void this.savePolls();
    }
    return poll;
  }

  /**
   * Stores a poll and, when it has an end time in the future, arms the timer that
   * closes it.
   */
  addPoll(chatJid: string, poll: Poll): void {
    this.polls.set(chatJid, poll);
    void this.savePolls();

    if (poll.endsAt && poll.endsAt > Date.now()) {
      const delay = poll.endsAt - Date.now();
      const timer = setTimeout(() => {
        void (async () => {
          const p = this.polls.get(chatJid);
          if (p && !p.closed) {
            p.closed = true;
            void this.savePolls();
          }
        })();
      }, delay);
      this.pollTimers.set(chatJid, timer);
    }
  }

  /** Replaces a poll, e.g. after a vote is recorded. */
  updatePoll(chatJid: string, poll: Poll): void {
    this.polls.set(chatJid, poll);
    void this.savePolls();
  }

  /** Removes a poll and cancels any pending close timer. */
  removePoll(chatJid: string): void {
    const timer = this.pollTimers.get(chatJid);
    if (timer) {
      clearTimeout(timer);
      this.pollTimers.delete(chatJid);
    }
    this.polls.delete(chatJid);
    void this.savePolls();
  }

  /** Snapshot of every stored poll. */
  getAllPolls(): Poll[] {
    return [...this.polls.values()];
  }
}

export const persistenceService = PersistenceService.getInstance();
