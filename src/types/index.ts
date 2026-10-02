/**
 * types/index.ts
 *
 * Shared contracts for the command, middleware and configuration layers.
 *
 * This file is the vocabulary of the bot: command implementations, the
 * middleware chain and the config layer all speak in these types, so changes
 * here ripple across the codebase.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import type { WASocket, proto, AnyMessageContent, WAMessage } from 'baileys';

/** Everything a command must provide to be registered and executed. */
export interface ICommand {
  /** Primary trigger word, matched case-insensitively. */
  name: string;
  /** Short human-readable summary shown in help output. */
  description: string;
  /** Alternative trigger words resolving to this command. */
  aliases?: string[];
  category: CommandCategory;
  /** Usage string shown when arguments are missing. */
  usage?: string;
  /** Sample invocations shown in help output. */
  examples?: string[];
  /** Minimum milliseconds between two executions by the same user. */
  cooldown?: number;
  /**
   * Marks the command as safe to run concurrently.
   * Only set this for read-only commands: anything mutating shared state
   * (economy, levels, moderation) must stay sequential to avoid lost updates.
   */
  parallelizable?: boolean;
  /** False disables the command globally; it is never resolved or executed. */
  enabled?: boolean;
  /**
   * Marks the command as NSFW: it is gated behind the persisted global
   * NSFW toggle (`!nsfw on/off`) even when `enabled` is true.
   */
  nsfw?: boolean;
  permissions?: {
    /** Minimum privilege required from the invoking user. */
    user?: PermissionLevel[];
    /** Rights the bot itself needs (e.g. admin to delete messages). */
    bot?: BotPermission[];
  };
  /** Chat types the command may run in. Omitted or BOTH means anywhere. */
  contexts?: CommandContext[];
  /** When true, the user must have registered a name first. */
  requiresRegistration?: boolean;
  /** Command body. Throwing is handled by the pipeline as a command error. */
  execute(ctx: MessageContext): Promise<void>;
}

/** Groups used to organise commands in help listings and lazy loading. */
export enum CommandCategory {
  UTILITY = 'utility',
  FUN = 'fun',
  SUBBOT = 'subbot',
  ECONOMY = 'economy',
  MODERATION = 'moderation',
  GROUP = 'group',
  MEDIA = 'media',
  GAME = 'game',
  CREATIVE = 'creative',
  INFORMATION = 'information',
  ADMIN = 'admin',
  OWNER = 'owner',
  RPG = 'rpg',
  FREEFIRE = 'freefire',
  ANIME = 'anime',
}

/**
 * User privilege tiers, ordered from least to most privileged.
 * A command declaring ADMIN also accepts owners (owners bypass the check).
 */
export enum PermissionLevel {
  USER = 0,
  ADMIN = 1,
  OWNER = 2,
}

/** Rights the bot must hold in a group for a command to be permitted. */
export enum BotPermission {
  ADMIN = 'admin',
  SEND_MESSAGES = 'send_messages',
  DELETE_MESSAGES = 'delete_messages',
}

/** Chat types a command accepts. */
export enum CommandContext {
  GROUP = 'group',
  PRIVATE = 'private',
  BOTH = 'both',
}

/**
 * Read/write view over an inbound message handed to commands.
 *
 * `sender` and `chat` are getters backed by permission data that is loaded
 * lazily; `isAdmin`/`isBotAdmin` stay false until the matching `load*Permissions`
 * call has run, so commands must load what they rely on.
 */
export interface MessageContext {
  sock: WASocket;
  message: WAMessage;
  text: string;
  args: string[];
  command: string;
  botId: string;
  sender: {
    jid: string;
    pushName: string;
    isOwner: boolean;
    isAdmin: boolean;
  };
  chat: {
    jid: string;
    isGroup: boolean;
    isBotAdmin: boolean;
  };
  quoted?: proto.IMessage;
  quotedMessageId?: string;
  quotedParticipant?: string;
  mentionedJid?: string;
  contextInfo?: proto.IContextInfo;
  media?: Buffer;
  /**
   * True when this execution was authorized through the owner PIN
   * confirmation flow (PinVerificationMiddleware injected the command);
   * checkPinVerification uses it to skip the challenge on this run.
   */
  pinConfirmed?: boolean;
  reply(text: string): Promise<void>;
  react(emoji: string): Promise<void>;
  sendMessage(content: AnyMessageContent): Promise<void>;
  loadSenderPermissions(): Promise<void>;
  loadBotPermissions(): Promise<void>;
  setOwnerOverride(isOwner: boolean): void;
}

/** Contract implemented by every middleware in the chain. */
export interface IMiddleware {
  /** Identifier used when a middleware throws during chain execution. */
  name: string;
  /** Runs the stage; call `next` to continue the chain. */
  execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}

/** Which storage backend the bot should use. */
export interface DatabaseConfig {
  type: 'json' | 'mongodb' | 'sqlite';
  uri?: string;
  path?: string;
}

/** Fully resolved runtime configuration assembled in config/index.ts. */
export interface BotConfig {
  name: string;
  prefix: string;
  owners: string[];
  ownerJids: string[];
  sessionPath: string;
  auth: {
    usePairingCode: boolean;
    phoneNumber?: string;
  };
  features: {
    antiSpam: boolean;
    autoRead: boolean;
    selfReply: boolean;
    cacheEnabled: boolean;
    autoReconnect: boolean;
  };
  limits: {
    maxCommandsPerMinute: number;
    maxMediaSize: number;
    maxReconnectAttempts: number;
  };
  database: DatabaseConfig;
  rateLimit: {
    maxMessagesPerGroup: number;
    windowMs: number;
    whitelistGroups: string[];
    whitelistUsers: string[];
    floodMaxPerSecond: number;
    floodWindowMs: number;
  };
  economy: {
    minBet: number;
    maxBet: number;
    vipMaxBet: number;
    minTransfer: number;
    maxTransfer: number;
  };
}
