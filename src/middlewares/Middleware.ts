import type { IMiddleware, MessageContext } from '@/types/index.js';

/**
 * Base abstract class for all middleware implementations.
 * Provides the standard interface for the middleware chain.
 */
export abstract class Middleware implements IMiddleware {
  /** The unique name identifier for this middleware. */
  abstract name: string;

  /**
   * Executes the middleware logic.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when the middleware completes.
   */
  abstract execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}