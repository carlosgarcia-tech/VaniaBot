/**
 * MessageContext.ts
 *
 * Provides a structured context for message handling.
 * Parses messages, extracts commands, and provides helper methods.
 */

import type { WASocket, proto, AnyMessageContent, WAMessage } from 'baileys';
import type { MessageContext as IMessageContext } from '@/types/index.js';
import { matchCommandPrefix } from '@/utils/prefix.js';
import { PermissionService, normalizeJid } from '@/services/PermissionService.js';
import { cacheManager } from '@/core/CacheManager.js';
import { getContextInfo } from '@/utils/getContextInfo.js';

/**
 * MessageContext class that wraps a WhatsApp message.
 * Provides convenient access to message data and helper methods.
 */
export class MessageContext implements IMessageContext {
  /** The raw text content of the message */
  public text: string;
  /** Command arguments parsed from the message */
  public args: string[];
  /** The command name extracted from the message */
  public command: string;

  private _senderPermissions?: { isAdmin: boolean; isOwner: boolean };
  private _botPermissions?: { isAdmin: boolean };
  private _isOwnerOverride?: boolean;

  /**
   * Creates a new MessageContext instance.
   *
   * @param sock - The Baileys socket
   * @param message - The raw WhatsApp message
   * @param botId - Optional bot identifier (default: 'main')
   */
  constructor(
    public sock: WASocket,
    public message: WAMessage,
    public botId: string = 'main',
  ) {
    this.text = this.extractText();
    const parsed = this.parseCommand();
    this.command = parsed.command;
    this.args = parsed.args;
  }

  /**
   * Extracts text content from various message types.
   *
   * @returns The text content of the message
   */
  private extractText(): string {
    const msg = this.message.message;
    return (
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      msg?.videoMessage?.caption ||
      ''
    );
  }

  /**
   * Parses the command from message text.
   *
   * @returns Object with command name and arguments
   */
  private parseCommand() {
    const prefix = matchCommandPrefix(this.text);
    if (!prefix) {
      return { command: '', args: [] };
    }
    const args = this.text.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase() || '';
    return { command, args };
  }

  /**
   * Gets sender information including JID, name, and permissions.
   */
  get sender() {
    const rawJid = this.message.key.participant ?? this.message.key.remoteJid ?? '';
    const jid = normalizeJid(rawJid);
    const pushName = this.message.pushName || 'User';
    const baseOwner = PermissionService.isOwner(jid);
    const isOwner = this._isOwnerOverride ?? baseOwner;

    return {
      jid,
      pushName,
      isOwner,
      isAdmin: this._senderPermissions?.isAdmin ?? false,
    };
  }

  /**
   * Sets an override for the owner status.
   *
   * @param isOwner - Whether to override as owner
   */
  setOwnerOverride(isOwner: boolean): void {
    this._isOwnerOverride = isOwner;
  }

  /**
   * Gets chat information including JID and whether it's a group.
   */
  get chat() {
    const jid = this.message.key.remoteJid ?? '';
    const isGroup = jid.endsWith('@g.us');

    return {
      jid,
      isGroup,
      isBotAdmin: this._botPermissions?.isAdmin ?? false,
    };
  }

  /**
   * Loads sender permissions from cache or fetches from WhatsApp.
   *
   * @returns Promise that resolves when permissions are loaded
   */
  async loadSenderPermissions(): Promise<void> {
    const groupJid = this.chat.isGroup ? this.chat.jid : undefined;

    if (groupJid) {
      const cached = cacheManager.getPermissions(groupJid, this.sender.jid);
      if (cached) {
        this._senderPermissions = {
          isAdmin: cached.isAdmin,
          isOwner: this.sender.isOwner,
        };
        return;
      }
    }

    const perms = await PermissionService.getUserPermissions(this.sock, groupJid, this.sender.jid);

    this._senderPermissions = {
      isAdmin: perms.isAdmin,
      isOwner: this.sender.isOwner,
    };

    if (groupJid) {
      cacheManager.setPermissions(groupJid, this.sender.jid, perms);
    }
  }

  /**
   * Loads bot permissions for the current chat.
   *
   * @returns Promise that resolves when permissions are loaded
   */
  async loadBotPermissions(): Promise<void> {
    if (!this.chat.isGroup) {
      this._botPermissions = { isAdmin: false };
      return;
    }

    const perms = await PermissionService.getBotPermissions(this.sock, this.chat.jid);
    this._botPermissions = { isAdmin: perms.isAdmin };
  }

  /**
   * Gets the context info from the message (for quoted messages, mentions, etc.)
   */
  get contextInfo(): proto.IContextInfo | undefined {
    return getContextInfo(this.message.message);
  }

  /**
   * Gets the quoted message if present.
   */
  get quoted(): proto.IMessage | undefined {
    return this.contextInfo?.quotedMessage || undefined;
  }

  /**
   * Gets the first mentioned JID if present.
   */
  get mentionedJid(): string | undefined {
    return this.contextInfo?.mentionedJid?.[0] ?? undefined;
  }

  /**
   * Gets the quoted message participant JID.
   */
  get quotedParticipant(): string | undefined {
    return this.contextInfo?.participant ?? undefined;
  }

  /**
   * Gets the quoted message ID (stanza ID).
   */
  get quotedMessageId(): string | undefined {
    return this.contextInfo?.stanzaId ?? undefined;
  }

  /**
   * Sends a reply to the current chat, quoting the original message.
   *
   * @param text - The text to send
   * @returns A promise that resolves when the message is sent
   */
  async reply(text: string): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, { text }, { quoted: this.message });
  }

  /**
   * Sends a reaction to the original message.
   *
   * @param emoji - The emoji to react with
   * @returns A promise that resolves when the reaction is sent
   */
  async react(emoji: string): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, {
      react: { text: emoji, key: this.message.key },
    });
  }

  /**
   * Sends a message to the current chat.
   *
   * @param content - The message content to send
   * @returns A promise that resolves when the message is sent
   */
  async sendMessage(content: AnyMessageContent): Promise<void> {
    await this.sock.sendMessage(this.chat.jid, content);
  }

  /**
   * Gets the sender permissions (loaded or default).
   *
   * @returns The sender permissions object
   */
  getSenderPermissions() {
    return (
      this._senderPermissions || {
        isOwner: this.sender.isOwner,
        isAdmin: false,
      }
    );
  }

  /**
   * Gets the bot permissions (loaded or default).
   *
   * @returns The bot permissions object
   */
  getBotPermissions() {
    return this._botPermissions || { isAdmin: false };
  }
}