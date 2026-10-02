/**
 * PinVerificationMiddleware.ts
 *
 * Owner PIN confirmation for destructive commands (eval/exec/grant/
 * setowner/restart). Runs as a GUARD inside MainMessagePipeline.runGuards —
 * NOT as a chain middleware — because only guards see messages without a
 * resolved command, and a bare 6-digit code resolves to no command.
 *
 * Flow: !exec ls → owner-only, creates a pending verification and DMs a PIN;
 * the owner replies "123456" in the same private chat → this guard verifies
 * it, injects the stored command/args into the context and lets the message
 * continue through the FULL middleware chain (validation, permissions,
 * cooldown, gates), closing the previous bypass that executed the command
 * directly. Commands outside PIN_ALLOWED_COMMANDS are never confirmed.
 */

import { Middleware } from './Middleware.js';
import type { MessageContext } from '@/types/index.js';
import { pinVerificationService } from '@/services/system/PinVerificationService.js';
import { logger } from '@/utils/logger.js';

/**
 * Middleware that verifies PIN codes for owner-only commands.
 * Runs as a guard in the message pipeline to intercept PIN replies.
 */
export class PinVerificationMiddleware extends Middleware {
  name = 'pin-verification';

  /**
   * Executes the PIN verification.
   *
   * @param ctx - The message context.
   * @param next - The next middleware in the chain.
   * @returns A promise that resolves when verification completes.
   */
  async execute(ctx: MessageContext, next: () => Promise<void>): Promise<void> {
    if (!ctx.chat.isGroup && ctx.sender.isOwner) {
      // A bare reply has command:'' and args:[], so the code lives in text;
      // a prefixed '.123456' resolves to command:'123456' instead.
      const messageText = (ctx.command || ctx.text).trim();

      if (/^\d{6}$/.test(messageText)) {
        const result = await pinVerificationService.verifyPin(ctx.sender.jid, messageText);

        if (result.valid && result.command) {
          // Whitelist gate: refuse to confirm anything outside the list.
          const pending = pinVerificationService.buildPendingCommandContext(
            result.command,
            result.args ?? '',
          );
          if (!pending) {
            logger.warn(`[PinVerification] Refusing non-whitelisted command '${result.command}'`);
            await ctx.react('❌');
            await ctx.reply('Command not allowed for PIN confirmation.');
            return;
          }

          await ctx.react('✅');

          // Inject the verified command so the message continues through the
          // full middleware chain instead of executing the command directly.
          // The flag tells checkPinVerification inside the command not to
          // challenge for another PIN on this authorized run.
          ctx.command = pending.command;
          ctx.args = pending.args;
          ctx.pinConfirmed = true;
          await next();
        } else {
          await ctx.react('❌');
          await ctx.reply('Invalid or expired PIN. You need to run the command again.');
        }
        return;
      }
    }

    await next();
  }
}