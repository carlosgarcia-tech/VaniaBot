import { pinVerificationService } from '@/services/system/PinVerificationService.js';
import type { MessageContext } from '@/types/index.js';
import type { WASocket } from 'baileys';

export const PIN_PROTECTED_COMMANDS = ['eval', 'exec', 'grant', 'setowner', 'restart'];

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
