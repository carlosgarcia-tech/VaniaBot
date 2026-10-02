/**
 * pinVerificationHelper.ts
 *
 * Entry point for the owner PIN challenge used by destructive commands.
 *
 * A protected command never runs on the first invocation: the helper records a
 * pending verification and DMs a short-lived PIN. The owner then confirms by
 * replying with that PIN, which PinVerificationMiddleware verifies and replays
 * through the normal chain.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

import { pinVerificationService } from '@/services/system/PinVerificationService.js';
import type { MessageContext } from '@/types/index.js';
import type { WASocket } from 'baileys';

/**
 * Commands that require PIN confirmation before executing.
 * Kept as a whitelist: anything not listed here is unprotected by default.
 */
export const PIN_PROTECTED_COMMANDS = ['eval', 'exec', 'grant', 'setowner', 'restart'];

/**
 * Decides whether a protected command may run, challenging for a PIN if not.
 *
 * @param commandName Command being invoked.
 * @param commandArgs Raw argument string stored with the pending verification
 *                     so the confirmed run can be replayed exactly.
 * @param sock Optional socket override, used by sub-bot sessions.
 * @returns `canExecute` true when the command may proceed now; `requiresPin`
 *          true when a challenge was just sent and execution is deferred.
 */
export async function checkPinVerification(
  ctx: MessageContext,
  commandName: string,
  commandArgs: string,
  sock?: WASocket,
): Promise<{ requiresPin: boolean; canExecute: boolean }> {
  const socket = sock || ctx.sock;

  // This run was authorized through the PIN confirmation flow (the guard
  // injected the command). Without this flag the confirmed execution would
  // re-enter and demand yet another PIN forever.
  if (ctx.pinConfirmed) {
    return { requiresPin: false, canExecute: true };
  }

  // NOTE: previously a pending verification allowed re-issuing the command
  // WITHOUT a PIN (canExecute: true). That was a bypass window — every
  // fresh execution of a protected command must challenge for a PIN.

  if (!PIN_PROTECTED_COMMANDS.includes(commandName)) {
    return { requiresPin: false, canExecute: true };
  }

  const pin = await pinVerificationService.createPendingVerification(
    ctx.sender.jid,
    commandName,
    commandArgs,
  );

  await pinVerificationService.sendPinDm(ctx.sender.jid, pin, commandName, socket);

  await ctx.reply(
    `🔐 *Verificación requerida*\n\n` +
      `Te envié un PIN a tu DM. Responde con el código de 6 dígitos para confirmar.\n\n` +
      `*El PIN expira en 60 segundos.*`,
  );

  return { requiresPin: true, canExecute: false };
}
