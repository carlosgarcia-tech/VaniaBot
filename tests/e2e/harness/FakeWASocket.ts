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
 */

import type { AnyMessageContent, WAMessage } from 'baileys';

export interface SentMessage {
  jid: string;
  content: AnyMessageContent;
  opts?: Record<string, unknown>;
}

type EventHandler = (payload: unknown) => void;

export class FakeWASocket {
  user = { id: '861234567890123:1@s.whatsapp.net', name: 'VaniaBot' };

  /** Mensajes enviados por el bot, en orden de llegada. */
  readonly sent: SentMessage[] = [];

  private readonly handlers = new Map<string, Set<EventHandler>>();
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

  /** Inyecta un messages.upsert (type notify) con el mensaje dado. */
  receive(message: WAMessage): void {
    this.emit('messages.upsert', { messages: [message], type: 'notify' });
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

  async groupMetadata(jid: string): Promise<unknown> {
    return { id: jid, subject: 'Grupo de prueba', participants: [] };
  }

  async groupParticipantsUpdate(): Promise<unknown> {
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

  reset(): void {
    this.sent.length = 0;
  }
}
