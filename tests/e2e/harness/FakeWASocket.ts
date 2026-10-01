/**
 * FakeWASocket.ts
 *
 * Socket falso para pruebas e2e del pipeline principal. Implementa
 * únicamente la superficie que Client/AuthManager/pipeline consumen de
 * un WASocket real: registro de eventos (ev.on), envío de mensajes
 * (sendMessage), presence, ws.readyState (el health check de AuthManager
 * lo consulta) y las consultas de grupo/perfil que los guards pueden
 * pedir.
 *
 * Los mensajes enviados quedan grabados en `sent` para que los tests
 * afirmen sobre ellos; `receive()` inyecta un messages.upsert como el
 * que Baileys emitiría con un mensaje entrante real, y emit() permite
 * disparar cualquier otro evento del bus (connection.update, etc.).
 *
 * Los participantes de grupo son configurables por test (`setGroup`) para
 * poder afirmar sobre permisos, antilink en modo kick y silencios: sin eso,
 * `participants: []` hace que el bot nunca sea admin. Cada cambio de
 * participantes debe ir acompañado de una invalidación de caches
 * (ver harness/groups.ts).
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
  user = { id: '861234567890123:1@s.whatsapp.net', name: 'VaniaBot' };

  /** Mensajes enviados por el bot, en orden de llegada. */
  readonly sent: SentMessage[] = [];

  /** Llamadas a groupParticipantsUpdate (kick/remove, add, etc.). */
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

  /** Emite un evento del bus de Baileys a los listeners registrados. */
  emit(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }

/**
   * Inyecta un messages.upsert con el mensaje dado. `append` reproduce la
   * sincronización de historial: el pipeline solo procesa `notify`.
   */
  receive(message: WAMessage, type: UpsertType = 'notify'): void {
    this.emit('messages.upsert', { messages: [message], type });
  }

  /**
   * Inyecta varios mensajes en un solo upsert (como el burst que emite
   * Baileys al reconectar con historial pendiente).
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
   * Define la metadata de un grupo (participantes y admin flags). Sustituye
   * la respuesta por defecto de participants: [].
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

  /** Textos planos enviados, en orden. */
  texts(): string[] {
    return this.sent
      .map(s => (s.content as { text?: string }).text ?? '')
      .filter(t => t.length > 0);
  }

  /** Claves de los mensajes que el bot intentó borrar (delete). */
  deletions(): string[] {
    return this.sent
      .map(s => (s.content as { delete?: { id?: string } }).delete?.id)
      .filter((id): id is string => typeof id === 'string');
  }

  /** Reacciones enviadas por el bot (ctx.react). */
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
