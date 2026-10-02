/**
 * RestartCommand.ts
 *
 * owner command `restart` — Reinicia el bot
 * Usage: !restart
 *
 * @author **Carlos G**
 */

/**
 * @fileoverview RestartCommand.ts - Restart the bot
 *
 * Restarts the bot process.
 *
 * @module commands/owner/system/RestartCommand
 */

import { Command } from '../../Command.js';
import {
  CommandCategory,
  PermissionLevel,
  CommandContext,
  type MessageContext,
} from '@/types/index.js';
import { logger } from '@/utils/logger.js';
import { checkPinVerification } from '@/utils/pinVerificationHelper.js';

/** Command handler for `!restart`: Reinicia el bot. */
export class RestartCommand extends Command {
  name = 'restart';
  description = 'Reinicia el bot';
  category = CommandCategory.OWNER;
  aliases = ['reiniciar'];
  usage = '!restart';
  examples = ['!restart'];
  permissions = { user: [PermissionLevel.OWNER] };
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const { requiresPin: _requiresPin, canExecute } = await checkPinVerification(
      ctx,
      'restart',
      '',
    );
    if (!canExecute) {
      return;
    }

    await ctx.react('🔄');
    await ctx.reply(`🔄 *Reiniciando bot...*\n\nEspera un momento.`);

    logger.info('Restart requested via command');

    setTimeout(() => {
      logger.info('Bot restarting now...');
      process.exit(0);
    }, 2000);
  }
}
