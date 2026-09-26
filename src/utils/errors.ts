export class BotError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'BotError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTH_ERROR = 'AUTH_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_URL = 'INVALID_URL',
  INVALID_INPUT = 'INVALID_INPUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_OWNER = 'NOT_OWNER',
  NOT_ADMIN = 'NOT_ADMIN',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  GROUP_NOT_FOUND = 'GROUP_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AI_ERROR = 'AI_ERROR',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  MEDIA_ERROR = 'MEDIA_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  USER_BANNED = 'USER_BANNED',
}

export class VBotError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    public recoverable: boolean = true,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'VBotError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PermissionError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'PERMISSION_DENIED', details);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class CommandExecutionError extends BotError {
  constructor(
    public commandName: string,
    originalError: unknown,
  ) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);

    super(`Error ejecutando comando '${commandName}': ${message}`, 'COMMAND_ERROR', originalError);
    this.name = 'CommandExecutionError';
  }
}

export class PluginLoadError extends BotError {
  constructor(
    public pluginPath: string,
    originalError: unknown,
  ) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);

    super(`Error cargando plugin '${pluginPath}': ${message}`, 'PLUGIN_LOAD_ERROR', originalError);
    this.name = 'PluginLoadError';
  }
}

export class NotFoundError extends VBotError {
  constructor(resource: string) {
    super(`${resource} no encontrado`, ErrorCode.NOT_FOUND, true);
    this.name = 'NotFoundError';
  }
}

export class UserNotFoundError extends VBotError {
  constructor(userJid: string) {
    super(`Usuario ${userJid} no encontrado`, ErrorCode.USER_NOT_FOUND, true, { userJid });
    this.name = 'UserNotFoundError';
  }
}

export class GroupNotFoundError extends VBotError {
  constructor(groupJid: string) {
    super(`Grupo ${groupJid} no encontrado`, ErrorCode.GROUP_NOT_FOUND, true, { groupJid });
    this.name = 'GroupNotFoundError';
  }
}

export class ItemNotFoundError extends VBotError {
  constructor(itemId: string) {
    super(`Item ${itemId} no encontrado`, ErrorCode.ITEM_NOT_FOUND, true, { itemId });
    this.name = 'ItemNotFoundError';
  }
}

export class RateLimitError extends VBotError {
  constructor(message: string, waitTime?: number) {
    super(message, ErrorCode.RATE_LIMITED, true, { waitTime });
    this.name = 'RateLimitError';
  }
}

export class InsufficientFundsError extends VBotError {
  constructor(needed: number, has: number) {
    super(`Necesitas $${needed}, tienes $${has}`, ErrorCode.INSUFFICIENT_FUNDS, true, {
      needed,
      has,
    });
    this.name = 'InsufficientFundsError';
  }
}

export class NetworkError extends VBotError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.NETWORK_ERROR, true, details);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends VBotError {
  constructor(message: string = 'Operation timed out') {
    super(message, ErrorCode.TIMEOUT, true);
    this.name = 'TimeoutError';
  }
}

export class ServiceUnavailableError extends VBotError {
  constructor(service: string) {
    super(`${service} no disponible`, ErrorCode.SERVICE_UNAVAILABLE, true, { service });
    this.name = 'ServiceUnavailableError';
  }
}

export class PermissionDeniedError extends VBotError {
  constructor(message: string = 'Permission denied') {
    super(message, ErrorCode.PERMISSION_DENIED, false);
    this.name = 'PermissionDeniedError';
  }
}

export class NotOwnerError extends VBotError {
  constructor() {
    super('Solo el owner puede usar este comando', ErrorCode.NOT_OWNER, false);
    this.name = 'NotOwnerError';
  }
}

export class NotAdminError extends VBotError {
  constructor() {
    super('Solo los admins pueden usar este comando', ErrorCode.NOT_ADMIN, false);
    this.name = 'NotAdminError';
  }
}

export class InvalidURLError extends VBotError {
  constructor(url: string, reason?: string) {
    super(`URL inválida: ${url}${reason ? ` - ${reason}` : ''}`, ErrorCode.INVALID_URL, true, {
      url,
      reason,
    });
    this.name = 'InvalidURLError';
  }
}

export class InvalidInputError extends VBotError {
  constructor(input: string, expected: string) {
    super(`Input inválido: '${input}' - esperado: ${expected}`, ErrorCode.INVALID_INPUT, true, {
      input,
      expected,
    });
    this.name = 'InvalidInputError';
  }
}

export class AlreadyExistsError extends VBotError {
  constructor(resource: string) {
    super(`${resource} ya existe`, ErrorCode.ALREADY_EXISTS, true);
    this.name = 'AlreadyExistsError';
  }
}

export class AuthError extends VBotError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AUTH_ERROR, true, details);
    this.name = 'AuthError';
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super('Sesión expirada', { requiresReauth: true });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Safely extracts a human-readable message from an unknown thrown value.
 * Replaces the repeated `error instanceof Error ? error.message : '...'
 * ternaries scattered across commands and services.
 */
export function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}
