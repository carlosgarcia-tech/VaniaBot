import type { WASocket, proto, AnyMessageContent, WAMessage } from 'baileys';

/**
 * Interface for bot commands.
 */
export interface ICommand {
  /** The unique command name */
  name: string;
  /** Command description */
  description: string;
  /** Alternative command aliases */
  aliases?: string[];
  /** Command category */
  category: CommandCategory;
  /** Usage string (optional) */
  usage?: string;
  /** Usage examples (optional) */
  examples?: string[];
  /** Cooldown in milliseconds (default: 3000) */
  cooldown?: number;
  /** Whether the command can run in parallel (default: false) */
  parallelizable?: boolean;
  /** Whether the command is enabled (default: true) */
  enabled?: boolean;
  /**
   * Marks the command as NSFW: it is gated behind the persisted global
   * NSFW toggle (`!nsfw on/off`) even when `enabled` is true.
   */
  nsfw?: boolean;
  /** Permission requirements */
  permissions?: {
    user?: PermissionLevel[];
    bot?: BotPermission[];
  };
  /** Allowed contexts */
  contexts?: CommandContext[];
  /** Whether the command requires user registration */
  requiresRegistration?: boolean;
  /** Command execution function */
  execute(ctx: MessageContext): Promise<void>;
}

/**
 * Command categories for organization.
 */
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
 * User permission levels.
 */
export enum PermissionLevel {
  USER = 0,
  ADMIN = 1,
  OWNER = 2,
}

/**
 * Bot permission types.
 */
export enum BotPermission {
  ADMIN = 'admin',
  SEND_MESSAGES = 'send_messages',
  DELETE_MESSAGES = 'delete_messages',
}

/**
 * Command execution contexts.
 */
export enum CommandContext {
  GROUP = 'group',
  PRIVATE = 'private',
  BOTH = 'both',
}

/**
 * Message context interface providing access to message data and helper methods.
 */
export interface MessageContext {
  /** The Baileys socket */
  sock: WASocket;
  /** The raw WhatsApp message */
  message: WAMessage;
  /** The message text content */
  text: string;
  /** Parsed command arguments */
  args: string[];
  /** The command name */
  command: string;
  /** Bot identifier */
  botId: string;
  /** Sender information */
  sender: {
    jid: string;
    pushName: string;
    isOwner: boolean;
    isAdmin: boolean;
  };
  /** Chat information */
  chat: {
    jid: string;
    isGroup: boolean;
    isBotAdmin: boolean;
  };
  /** Quoted message if present */
  quoted?: proto.IMessage;
  /** Quoted message ID */
  quotedMessageId?: string;
  /** Quoted participant JID */
  quotedParticipant?: string;
  /** Mentioned JID */
  mentionedJid?: string;
  /** Context info from the message */
  contextInfo?: proto.IContextInfo;
  /** Media buffer if present */
  media?: Buffer;
  /**
   * True when this execution was authorized through the owner PIN
   * confirmation flow (PinVerificationMiddleware injected the command);
   * checkPinVerification uses it to skip the challenge on this run.
   */
  pinConfirmed?: boolean;
  /** Sends a reply to the chat */
  reply(text: string): Promise<void>;
  /** Sends a reaction to the message */
  react(emoji: string): Promise<void>;
  /** Sends a message to the chat */
  sendMessage(content: AnyMessageContent): Promise<void>;
  /** Loads sender permissions */
  loadSenderPermissions(): Promise<void>;
  /** Loads bot permissions */
  loadBotPermissions(): Promise<void>;
  /** Sets owner override */
  setOwnerOverride(isOwner: boolean): void;
}

/**
 * Middleware interface for the message processing pipeline.
 */
export interface IMiddleware {
  /** Middleware name */
  name: string;
  /** Executes the middleware */
  execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}

/**
 * Database configuration.
 */
export interface DatabaseConfig {
  type: 'json' | 'mongodb' | 'sqlite';
  uri?: string;
  path?: string;
}

/**
 * Bot configuration object.
 */
export interface BotConfig {
  /** Bot display name */
  name: string;
  /** Command prefix */
  prefix: string;
  /** Array of owner JIDs */
  owners: string[];
  /** Additional owner JIDs */
  ownerJids: string[];
  /** Session storage directory path */
  sessionPath: string;
  /** Authentication configuration */
  auth: {
    /** Use pairing code instead of QR code */
    usePairingCode: boolean;
    /** Phone number for pairing code (with country code) */
    phoneNumber?: string;
  };
  /** Feature flags */
  features: {
    /** Enable anti-spam rate limiting */
    antiSpam: boolean;
    /** Automatically mark messages as read */
    autoRead: boolean;
    /** Enable bot to respond to itself */
    selfReply: boolean;
    /** Enable in-memory caching */
    cacheEnabled: boolean;
    /** Enable automatic reconnection */
    autoReconnect: boolean;
  };
  /** Rate limits and thresholds */
  limits: {
    /** Maximum commands per minute per user */
    maxCommandsPerMinute: number;
    /** Maximum media file size in bytes */
    maxMediaSize: number;
    /** Maximum reconnection attempts */
    maxReconnectAttempts: number;
  };
  /** Database configuration */
  database: DatabaseConfig;
  /** Rate limiting configuration */
  rateLimit: {
    maxMessagesPerGroup: number;
    windowMs: number;
    whitelistGroups: string[];
    whitelistUsers: string[];
    floodMaxPerSecond: number;
    floodWindowMs: number;
  };
  /** Economy limits */
  economy: {
    minBet: number;
    maxBet: number;
    vipMaxBet: number;
    minTransfer: number;
    maxTransfer: number;
  };
}