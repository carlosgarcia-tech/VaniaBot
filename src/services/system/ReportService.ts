/**
 * ReportService.ts
 *
 * User-submitted reports, bug reports and feedback, with a read/resolve
 * lifecycle that the owner reviews.
 *
 * IDs are human-quotable (`RPT-<timestamp>-<counter>`) because owners refer to
 * them in chat. The counter is persisted under the reserved `_counter` key so
 * IDs stay unique across restarts, and every read path filters that key out so
 * it is never mistaken for a report.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { IDatabase } from '../database/Database.js';

/** A stored report and its review state. */
export interface Report {
  id: string;
  type: 'report' | 'bugreport' | 'feedback';
  fromJid: string;
  fromName: string;
  fromGroup?: string;
  fromGroupName?: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'read' | 'resolved';
  readAt?: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export class ReportService {
  private db: IDatabase;
  private readonly COLLECTION = 'reports';
  /** Persisted under `_counter` so IDs remain unique across restarts. */
  private idCounter: number = 0;

  constructor(db: IDatabase) {
    this.db = db;
  }

  /** Restores the ID counter; must run before the first report is created. */
  async initialize(): Promise<void> {
    const counter = await this.db.get<{ value: number }>(this.COLLECTION, '_counter');
    this.idCounter = counter?.value || 0;
  }

  /**
   * Builds the next report ID.
   * The counter write is intentionally not awaited: it is fire-and-forget so
   * creating a report does not pay for two sequential round-trips.
   */
  private generateId(): string {
    this.idCounter++;
    const id = `RPT-${Date.now()}-${this.idCounter.toString().padStart(4, '0')}`;
    void this.db.set(this.COLLECTION, '_counter', { value: this.idCounter });
    return id;
  }

  /** Persists a new report with status `pending` and returns it. */
  async createReport(
    type: Report['type'],
    fromJid: string,
    fromName: string,
    content: string,
    fromGroup?: string,
    fromGroupName?: string,
  ): Promise<Report> {
    const report: Report = {
      id: this.generateId(),
      type,
      fromJid,
      fromName,
      fromGroup,
      fromGroupName,
      content,
      timestamp: Date.now(),
      status: 'pending',
    };

    await this.db.set(this.COLLECTION, report.id, report);
    await this.db.flush();

    return report;
  }

  /** Fetches one report by ID, or null when it does not exist. */
  async getReport(id: string): Promise<Report | null> {
    return await this.db.get<Report>(this.COLLECTION, id);
  }

  /**
   * Lists reports, newest first, with optional status filter and pagination.
   * Sorting and slicing happen in memory because the collection is small.
   */
  async getReports(options?: {
    status?: Report['status'];
    limit?: number;
    page?: number;
  }): Promise<{ items: Report[]; total: number }> {
    const { status, limit = 50, page = 1 } = options || {};

    const allReports = await this.db.getAll<Report>(this.COLLECTION);
    let filtered = allReports.filter(r => r.id !== '_counter');

    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { items, total };
  }

  /** All reports submitted by one user, newest first. */
  async getReportsByUser(jid: string): Promise<Report[]> {
    const allReports = await this.db.getAll<Report>(this.COLLECTION);
    return allReports
      .filter(r => r.id !== '_counter' && r.fromJid === jid)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /** How many reports are still awaiting review. */
  async getPendingCount(): Promise<number> {
    const { total } = await this.getReports({ status: 'pending' });
    return total;
  }

  /** Marks a report read. Returns false when the ID does not exist. */
  async markAsRead(id: string, _readBy?: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    const updated: Report = {
      ...report,
      status: 'read',
      readAt: Date.now(),
    };

    await this.db.set(this.COLLECTION, id, updated);
    await this.db.flush();
    return true;
  }

  /** Marks a report resolved, recording who resolved it. */
  async resolveReport(id: string, resolvedBy?: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    const updated: Report = {
      ...report,
      status: 'resolved',
      resolvedAt: Date.now(),
      resolvedBy,
    };

    await this.db.set(this.COLLECTION, id, updated);
    await this.db.flush();
    return true;
  }

  /** Removes a report entirely. Returns false when the ID does not exist. */
  async deleteReport(id: string): Promise<boolean> {
    const report = await this.getReport(id);
    if (!report) return false;

    await this.db.delete(this.COLLECTION, id);
    await this.db.flush();
    return true;
  }

  /** Renders a report as the owner-facing WhatsApp message. */
  formatReportForOwner(report: Report): string {
    const date = new Date(report.timestamp).toLocaleString();
    const typeEmoji = report.type === 'bugreport' ? '🐛' : report.type === 'feedback' ? '💡' : '📢';
    const typeLabel =
      report.type === 'bugreport'
        ? 'Bug Report'
        : report.type === 'feedback'
          ? 'Feedback'
          : 'Report';

    let message = `${typeEmoji} *${typeLabel}*\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📋 ID: \`${report.id}\`\n`;
    message += `👤 De: ${report.fromName}\n`;
    message += `📱 @${report.fromJid.split('@')[0]}\n`;

    if (report.fromGroup) {
      message += `💬 Grupo: ${report.fromGroupName || report.fromGroup}\n`;
    }

    message += `🕐 Fecha: ${date}\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📝 *Contenido:*\n${report.content}\n`;
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `Estado: ${report.status === 'pending' ? '⏳ Pendiente' : report.status === 'read' ? '👁️ Leído' : '✅ Resuelto'}`;

    return message;
  }
}
