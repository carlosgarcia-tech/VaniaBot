import type { WASocket, proto, AnyMessageContent, WAMessage } from 'baileys';

export interface ICommand {
  name: string;
  description: string;
  aliases?: string[];
  category: CommandCategory;
  usage?: string;
  examples?: string[];
  cooldown?: number;
  parallelizable?: boolean;
  enabled?: boolean;
  /**
   * Marks the command as NSFW: it is gated behind the persisted global
   * NSFW toggle (`!nsfw on/off`) even when `enabled` is true.
   */
  nsfw?: boolean;
  permissions?: {
    user?: PermissionLevel[];
    bot?: BotPermission[];
  };
  contexts?: CommandContext[];
  requiresRegistration?: boolean;
  execute(ctx: MessageContext): Promise<void>;
}

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

export enum PermissionLevel {
  USER = 0,
  ADMIN = 1,
  OWNER = 2,
}

export enum BotPermission {
  ADMIN = 'admin',
  SEND_MESSAGES = 'send_messages',
  DELETE_MESSAGES = 'delete_messages',
}

export enum CommandContext {
  GROUP = 'group',
  PRIVATE = 'private',
  BOTH = 'both',
}

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
  reply(text: string): Promise<void>;
  react(emoji: string): Promise<void>;
  sendMessage(content: AnyMessageContent): Promise<void>;
  loadSenderPermissions(): Promise<void>;
  loadBotPermissions(): Promise<void>;
  setOwnerOverride(isOwner: boolean): void;
}

export interface IMiddleware {
  name: string;
  execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}

export interface DatabaseConfig {
  type: 'json' | 'mongodb' | 'sqlite';
  uri?: string;
  path?: string;
}

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
