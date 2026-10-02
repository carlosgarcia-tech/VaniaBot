import { pinVerificationService } from '@/services/system/PinVerificationService.js';
import type { MessageContext } from '@/types/index.js';
import type { WASocket } from 'baileys';

export const PIN_PROTECTED_COMMANDS = ['eval', 'exec', 'grant', 'setowner', 'restart'];

/**
 * Checks if a command requires PIN verification for the owner.
 * Sends a PIN via DM if verification is needed.
 *
 * @param ctx - The message context.
 * @param commandName - The name of the command to check.
 * @param commandArgs - The command arguments.
 * @param sock - Optional socket instance (defaults to ctx.sock).
 * @returns An object indicating if PIN is required and if execution can proceed.
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
    `PIN Verification Required\n\n` +
      `A PIN was sent to your DM. Reply with the 6-digit code to confirm.\n\n` +
      `The PIN expires in 60 seconds.`,
  );

  return { requiresPin: true, canExecute: false };
}