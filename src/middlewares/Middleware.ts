/**
 * Middleware.ts
 *
 * Base class for the message-processing chain.
 *
 * Concrete middlewares override `execute` and decide whether to call `next()`:
 * calling it continues the chain, returning without calling it short-circuits
 * the remaining middlewares and the command.
 *
 * Chain ordering and the parallel/sequential distinction are configured in
 * Client.initialize (priority + canRunParallel) and executed by
 * MainMessagePipeline.executeWithMiddlewares.
 *
 * @author **Carlos G**
 * @github CARLOSGRCIAGRCIA
 * @tiktok carlos.grcia0
 * @instagram carlos.gxv
 * @created 2026-03-16
 */

import type { IMiddleware, MessageContext } from '@/types/index.js';

export abstract class Middleware implements IMiddleware {
  /** Identifier used in logs when a middleware throws. */
  abstract name: string;
  /**
   * Runs this stage of the chain.
   * @param ctx Message context being processed.
   * @param next Invoked to continue the chain; omit it to stop here.
   */
  abstract execute(ctx: MessageContext, next: () => Promise<void>): Promise<void>;
}
