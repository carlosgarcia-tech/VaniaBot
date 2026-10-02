/**
 * ContactsCache.ts
 *
 * Push-name cache keyed by phone number.
 *
 * Resolving a display name normally requires a group metadata round-trip, which
 * is far too expensive to do per message. Names are instead harvested from
 * inbound messages and from a one-time warm of each group's participant list.
 *
 * Keys are the bare phone number (domain and device suffix stripped) so a user
 * is recognised identically whether referenced by phone number or by LID.
 *
 * Unbounded by design: it only grows with distinct participants and is cheap to
 * hold. Names expire only on restart.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { WASocket } from 'baileys';
import { logError } from '@/utils/logger.js';
import type { MessageContext } from '@/types/index.js';

class ContactsCache {
  /** Phone number -> display name. */
  private cache = new Map<string, string>();
  /** Groups whose participant list has already been warmed. */
  private loadedGroups = new Set<string>();

  /**
   * Stores a display name. Placeholder values are ignored so a real name is
   * never overwritten by the generic fallback.
   */
  set(jid: string, name: string): void {
    if (!name || name === 'User') return;
    this.cache.set(jid.split('@')[0].split(':')[0], name);
  }

  /** Cached display name for a JID, or undefined when unknown. */
  get(jid: string): string | undefined {
    return this.cache.get(jid.split('@')[0].split(':')[0]);
  }

  /**
   * Resolves a display name, falling back to a group metadata lookup and then
   * to an `@number` placeholder so callers always receive something printable.
   */
  async getContactName(ctx: MessageContext, jid: string): Promise<string> {
    const cached = this.get(jid);
    if (cached) return cached;

    try {
      const groupMeta = await ctx.sock.groupMetadata(ctx.chat.jid);
      const targetBase = jid.split('@')[0].split(':')[0];

      const participant = groupMeta.participants.find(p => {
        const pBase = p.id.split('@')[0].split(':')[0];
        return pBase === targetBase;
      });

      if (participant) {
        const name = participant.notify || participant.name || participant.verifiedName;

        if (name) {
          this.set(participant.id, name);
          return name;
        }
      }
    } catch (error) {
      logError('[ContactsCache]', error);
    }

    return `@${jid.split('@')[0]}`;
  }

  /**
   * Preloads every participant name for a group exactly once.
   * The loaded-group guard is set before the fetch, so concurrent warmups of the
   * same group collapse into a single metadata request.
   */
  async warmGroup(sock: WASocket, groupJid: string): Promise<void> {
    if (this.loadedGroups.has(groupJid)) return;
    this.loadedGroups.add(groupJid);

    try {
      const meta = await sock.groupMetadata(groupJid);
      for (const p of meta.participants) {
        const name =
          p.notify ||
          (p as { id: string; name?: string; verifiedName?: string })?.name ||
          (p as { id: string; name?: string; verifiedName?: string })?.verifiedName;
        if (name) this.set(p.id, name);
      }
    } catch (error) {
      logError('ContactsCache.loadParticipants', error);
    }
  }
}

export const contactsCache = new ContactsCache();
