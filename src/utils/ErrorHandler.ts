/**
 * ErrorHandler.ts
 *
 * Translates thrown errors into user-facing WhatsApp messages.
 *
 * Every handler follows the same contract: log the real error server-side,
 * then return a short, friendly message that never leaks internals (stack
 * traces, API keys, file paths). The Spanish text returned here is the actual
 * user-facing output, not documentation.
 *
 * Classifying errors by matching known message fragments is a pragmatic
 * trade-off: upstream APIs throw plain `Error`s with only a message to go on,
 * so there is no structured code to switch on.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { logger, logError } from '@/utils/logger.js';
import { VBotError, ErrorCode } from '@/utils/errors.js';

/** Extra context attached to command errors for the server-side log. */
export interface ErrorContext {
  command?: string;
  userId?: string;
  groupId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export class ErrorHandler {
  /**
   * Maps a command failure to a reply string.
   * Domain errors (VBotError) get a specific message; anything else falls back
   * to a generic apology so unexpected failures never expose details.
   */
  static handleCommandError(error: unknown, command: string, ctx?: ErrorContext): string {
    const contextStr = ctx ? JSON.stringify(ctx) : '';

    if (error instanceof VBotError) {
      logError(`Command ${command} ${contextStr}`, error);
      return this.getUserMessage(error);
    }

    if (error instanceof Error) {
      logError(`Command ${command} ${contextStr}`, new Error(error.message));
    }

    return '❌ Error al ejecutar el comando. Intenta de nuevo.';
  }

  /** Maps a storage failure to a reply string. */
  static handleDatabaseError(error: unknown, operation: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      return '❌ Error de base de datos: Archivo no encontrado.';
    }

    if (errorMessage.includes('permission')) {
      return '❌ Error de permisos al acceder a la base de datos.';
    }

    if (errorMessage.includes('JSON')) {
      return '❌ Error de formato en la base de datos.';
    }

    logger.error(`Database error in ${operation}:`, error);
    return '❌ Error de base de datos. Intenta de nuevo más tarde.';
  }

  /** Maps an AI provider failure to a reply string (missing key, rate limit, timeout). */
  static handleAIError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('401') || errorMessage.includes('API key')) {
      return '⚠️ API KEY no establecida, esta función se encuentra temporalmente inhabilitada';
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
      return '⚠️ Límite de uso alcanzado. Intenta en unos segundos.';
    }

    if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
      return '⚠️ Servicio de AI no disponible temporalmente.';
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      return '⏱️ La AI tardó demasiado. Intenta de nuevo.';
    }

    logger.error('AI Error:', error);
    return '❌ Error con el servicio de AI. Intenta más tarde.';
  }

  /** Maps a media download failure to a reply string. */
  static handleDownloadError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return '❌ Video/audio no encontrado. Verifica el enlace.';
    }

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return '❌ No tienes permiso para descargar este contenido.';
    }

    if (errorMessage.includes('size') || errorMessage.includes('too large')) {
      return '❌ El archivo es demasiado grande.';
    }

    if (errorMessage.includes('timeout')) {
      return '⏱️ La descarga tardó demasiado. Intenta con otro enlace.';
    }

    logger.error('Download Error:', error);
    return '❌ Error al descargar. Verifica el enlace e intenta de nuevo.';
  }

  /** Maps a moderation failure to a reply string, focusing on missing bot rights. */
  static handleModerationError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('not admin')) {
      return '❌ Necesito ser administrador para eso.';
    }

    if (errorMessage.includes('permission')) {
      return '❌ No tengo permisos suficientes.';
    }

    if (errorMessage.includes('not found')) {
      return '❌ Usuario no encontrado en el grupo.';
    }

    logger.error('Moderation Error:', error);
    return '❌ Error de moderación. Intenta de nuevo.';
  }

  /**
   * Maps a VBotError code to its message.
   * AI and download codes delegate to their dedicated handlers so the wording
   * stays consistent across call sites.
   */
  static getUserMessage(error: VBotError): string {
    switch (error.code) {
      case ErrorCode.USER_BANNED:
        return '⛔ Has sido baneado del uso del bot.';

      case ErrorCode.INSUFFICIENT_FUNDS:
        return '❌ Fondos insuficientes.';

      case ErrorCode.RATE_LIMITED:
        return '⚠️ Estás excediendo el límite. Espera un momento.';

      case ErrorCode.PERMISSION_DENIED:
        return '❌ No tienes permiso para esto.';

      case ErrorCode.NOT_FOUND:
        return '❌ No encontrado.';

      case ErrorCode.VALIDATION_ERROR:
        return `❌ Datos inválidos: ${error.message}`;

      case ErrorCode.DATABASE_ERROR:
        return '❌ Error de base de datos. Intenta más tarde.';

      case ErrorCode.AI_ERROR:
        return this.handleAIError(error);

      case ErrorCode.DOWNLOAD_ERROR:
        return this.handleDownloadError(error);

      default:
        return error.message || '❌ Error desconocido.';
    }
  }

  /**
   * Decides whether an operation is worth retrying.
   * VBotError answers authoritatively via its `recoverable` flag; plain errors
   * fall back to matching transient network/rate-limit signatures.
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof VBotError) {
      return error.recoverable;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    const retryablePatterns = [
      'timeout',
      'ETIMEDOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'network',
      '503',
      '429',
    ];

    return retryablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase()),
    );
  }
}

export const errorHandler = ErrorHandler;
