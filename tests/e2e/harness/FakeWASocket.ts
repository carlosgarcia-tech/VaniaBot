/**
 * FakeWASocket.ts
 *
 * Fake socket for e2e tests of the main pipeline. It implements only the
 * surface that Client/AuthManager/pipeline consume from a real WASocket:
 * event registration (ev.on), message sending (sendMessage), presence,
 * ws.readyState (queried by the AuthManager health check) and the
 * group/profile queries the guards may issue.
 *
 * Sent messages are recorded in `sent` so tests can assert on them;
 * receive() injects a messages.upsert like the one Baileys would emit for a
 * real incoming message, and emit() allows firing any other bus event
 * (connection.update, etc.).
 *
 * Group participants are configurable per test (`setGroup`) so tests can
 * assert on permissions, antilink in kick mode and mutes: without that,
 * `participants: []` makes the bot never an admin. Every participant change
 * must be accompanied by cache invalidation (see harness/groups.ts).
 */

import type { AnyMessageContent, WAMessage } from 'baileys';

export interface SentMessage {
  jid: string;
  content: AnyMessageContent;
  opts?: Record<string, unknown>;
}

export interface FakeParticipant {
  id: string;
  admin?: 'admin' | 'superadmin' | 'member' | null;
  name?: string;
}

export interface ParticipantUpdate {
  jid: string;
  participants: string[];
  action: string;
}

export interface FakeGroup {
  subject: string;
  participants: FakeParticipant[];
}

export type UpsertType = 'notify' | 'append';

type EventHandler = (payload: unknown) => void;

export class FakeWASocket {
  user = { id: '861234567890123:1@s.whatsapp.net', name: 'OrbitBot' };

  /** Messages sent by the bot, in arrival order. */
  readonly sent: SentMessage[] = [];

  /** groupParticipantsUpdate calls (kick/remove, add, etc.). */
  readonly participantUpdates: ParticipantUpdate[] = [];

  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly groups = new Map<string, FakeGroup>();
  private messageIdCounter = 0;

  readonly ev = {
    on: (event: string, handler: EventHandler): void => {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)?.add(handler);
    },
    off: (event: string, handler: EventHandler): void => {
      this.handlers.get(event)?.delete(handler);
    },
  };

  /** Emits a Baileys bus event to the registered listeners. */
  emit(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }

/**
   * Injects a messages.upsert with the given message. `append` reproduces
   * history sync: the pipeline only processes `notify`.
   */
  receive(message: WAMessage, type: UpsertType = 'notify'): void {
    this.emit('messages.upsert', { messages: [message], type });
  }

  /**
   * Injects several messages in a single upsert (like the burst Baileys
   * emits when reconnecting with pending history).
   */
  receiveMany(messages: WAMessage[], type: UpsertType = 'notify'): void {
    this.emit('messages.upsert', { messages, type });
  }

  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    opts?: Record<string, unknown>,
  ): Promise<unknown> {
    this.sent.push({ jid, content, opts });
    this.messageIdCounter++;
    return {
      key: { id: `FAKE-${this.messageIdCounter}`, remoteJid: jid, fromMe: true },
      message: content,
    };
  }

  async sendPresenceUpdate(): Promise<void> {}

  async profilePictureUrl(): Promise<string> {
    throw new Error('FakeWASocket: sin foto de perfil');
  }

  /**
   * Sets a group's metadata (participants and admin flags). Replaces the
   * default participants: [] response.
   */
  setGroup(jid: string, group: Partial<FakeGroup> = {}): void {
    const current = this.groups.get(jid);
    this.groups.set(jid, {
      subject: group.subject ?? current?.subject ?? 'Grupo de prueba',
      participants: group.participants ?? current?.participants ?? [],
    });
  }

  async groupMetadata(jid: string): Promise<unknown> {
    const group = this.groups.get(jid) ?? { subject: 'Grupo de prueba', participants: [] };
    return { id: jid, subject: group.subject, participants: group.participants };
  }

  async groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: string,
  ): Promise<unknown> {
    this.participantUpdates.push({ jid, participants, action });
    return [];
  }

  readonly ws = {
    close: async (): Promise<void> => {},
    readyState: 1,
  };

  /** Plain texts sent, in order. */
  texts(): string[] {
    return this.sent
      .map(s => (s.content as { text?: string }).text ?? '')
      .filter(t => t.length > 0);
  }

  /** Keys of the messages the bot attempted to delete (delete). */
  deletions(): string[] {
    return this.sent
      .map(s => (s.content as { delete?: { id?: string } }).delete?.id)
      .filter((id): id is string => typeof id === 'string');
  }

  /** Reactions sent by the bot (ctx.react). */
  reactions(): string[] {
    return this.sent
      .map(s => (s.content as { react?: { text?: string } }).react?.text)
      .filter((emoji): emoji is string => typeof emoji === 'string');
  }

  reset(): void {
    this.sent.length = 0;
    this.participantUpdates.length = 0;
  }
}
