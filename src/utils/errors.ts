/**
 * Base error class for bot errors with optional code and details.
 */
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

/**
 * Standard error codes used throughout the application.
 */
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

/**
 * Extended bot error with error code, recoverability flag, and details.
 */
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

/**
 * Error thrown when a permission check fails.
 */
export class PermissionError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'PERMISSION_DENIED', details);
    this.name = 'PermissionError';
  }
}

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends BotError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when command execution fails.
 */
export class CommandExecutionError extends BotError {
  constructor(
    public commandName: string,
    originalError: unknown,
  ) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);

    super(`Error executing command '${commandName}': ${message}`, 'COMMAND_ERROR', originalError);
    this.name = 'CommandExecutionError';
  }
}

/**
 * Error thrown when a plugin fails to load.
 */
export class PluginLoadError extends BotError {
  constructor(
    public pluginPath: string,
    originalError: unknown,
  ) {
    const message = originalError instanceof Error ? originalError.message : String(originalError);

    super(`Error loading plugin '${pluginPath}': ${message}`, 'PLUGIN_LOAD_ERROR', originalError);
    this.name = 'PluginLoadError';
  }
}

/**
 * Error thrown when a resource is not found.
 */
export class NotFoundError extends VBotError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorCode.NOT_FOUND, true);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when a user is not found.
 */
export class UserNotFoundError extends VBotError {
  constructor(userJid: string) {
    super(`User ${userJid} not found`, ErrorCode.USER_NOT_FOUND, true, { userJid });
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when a group is not found.
 */
export class GroupNotFoundError extends VBotError {
  constructor(groupJid: string) {
    super(`Group ${groupJid} not found`, ErrorCode.GROUP_NOT_FOUND, true, { groupJid });
    this.name = 'GroupNotFoundError';
  }
}

/**
 * Error thrown when an item is not found.
 */
export class ItemNotFoundError extends VBotError {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`, ErrorCode.ITEM_NOT_FOUND, true, { itemId });
    this.name = 'ItemNotFoundError';
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitError extends VBotError {
  constructor(message: string, waitTime?: number) {
    super(message, ErrorCode.RATE_LIMITED, true, { waitTime });
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when user has insufficient funds.
 */
export class InsufficientFundsError extends VBotError {
  constructor(needed: number, has: number) {
    super(`Need $${needed}, have $${has}`, ErrorCode.INSUFFICIENT_FUNDS, true, {
      needed,
      has,
    });
    this.name = 'InsufficientFundsError';
  }
}

/**
 * Error thrown for network-related issues.
 */
export class NetworkError extends VBotError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.NETWORK_ERROR, true, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when an operation times out.
 */
export class TimeoutError extends VBotError {
  constructor(message: string = 'Operation timed out') {
    super(message, ErrorCode.TIMEOUT, true);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when a service is unavailable.
 */
export class ServiceUnavailableError extends VBotError {
  constructor(service: string) {
    super(`${service} unavailable`, ErrorCode.SERVICE_UNAVAILABLE, true, { service });
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error thrown when permission is denied (non-recoverable).
 */
export class PermissionDeniedError extends VBotError {
  constructor(message: string = 'Permission denied') {
    super(message, ErrorCode.PERMISSION_DENIED, false);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Error thrown when owner-only command is used by non-owner.
 */
export class NotOwnerError extends VBotError {
  constructor() {
    super('Only the owner can use this command', ErrorCode.NOT_OWNER, false);
    this.name = 'NotOwnerError';
  }
}

/**
 * Error thrown when admin-only command is used by non-admin.
 */
export class NotAdminError extends VBotError {
  constructor() {
    super('Only admins can use this command', ErrorCode.NOT_ADMIN, false);
    this.name = 'NotAdminError';
  }
}

/**
 * Error thrown when a URL is invalid.
 */
export class InvalidURLError extends VBotError {
  constructor(url: string, reason?: string) {
    super(`Invalid URL: ${url}${reason ? ` - ${reason}` : ''}`, ErrorCode.INVALID_URL, true, {
      url,
      reason,
    });
    this.name = 'InvalidURLError';
  }
}

/**
 * Error thrown when input is invalid.
 */
export class InvalidInputError extends VBotError {
  constructor(input: string, expected: string) {
    super(`Invalid input: '${input}' - expected: ${expected}`, ErrorCode.INVALID_INPUT, true, {
      input,
      expected,
    });
    this.name = 'InvalidInputError';
  }
}

/**
 * Error thrown when a resource already exists.
 */
export class AlreadyExistsError extends VBotError {
  constructor(resource: string) {
    super(`${resource} already exists`, ErrorCode.ALREADY_EXISTS, true);
    this.name = 'AlreadyExistsError';
  }
}

/**
 * Error thrown for authentication failures.
 */
export class AuthError extends VBotError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.AUTH_ERROR, true, details);
    this.name = 'AuthError';
  }
}

/**
 * Error thrown when session has expired.
 */
export class SessionExpiredError extends AuthError {
  constructor() {
    super('Session expired', { requiresReauth: true });
    this.name = 'SessionExpiredError';
  }
}

/**
 * Safely extracts a human-readable message from an unknown thrown value.
 * Replaces repeated `error instanceof Error ? error.message : '...'` ternaries.
 *
 * @param error - The error value.
 * @param fallback - Fallback message if error cannot be extracted.
 * @returns A human-readable error message.
 */
export function errorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}