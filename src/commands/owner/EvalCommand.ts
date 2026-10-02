/**
 * EvalCommand.ts
 *
 * owner command `eval` — Evalúa código JavaScript en tiempo real
 * Usage: !eval <codigo>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { checkPinVerification } from '@/utils/pinVerificationHelper.js';

/** Command handler for `!eval`: Evalúa código JavaScript en tiempo real. */
export class EvalCommand extends Command {
  name = 'eval';
  description = 'Evalúa código JavaScript en tiempo real';
  category = CommandCategory.OWNER;
  aliases = ['evaluate', 'js'];
  usage = '!eval <codigo>';
  examples = ['!eval 2 + 2', '!eval process.version'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const code = ctx.args.join(' ').trim();

    const { requiresPin: _requiresPin, canExecute } = await checkPinVerification(ctx, 'eval', code);
    if (!canExecute) {
      return;
    }

    if (!code) {
      await ctx.reply(
        '*EVAL*\n\n' +
          'Evalúa código JavaScript en tiempo real.\n\n' +
          'Uso: !eval <codigo>\n' +
          'Ejemplo: !eval 2 + 2\n' +
          'Ejemplo: !eval process.version',
      );
      return;
    }

    try {
      const output = await eval(`(async () => { ${code} })()`);
      let text: string;

      if (output === undefined || output === null) {
        text = 'Sin resultado (undefined/null)';
      } else if (typeof output === 'string') {
        text = output;
      } else if (typeof output === 'object') {
        text = JSON.stringify(output, null, 2);
      } else {
        text = String(output);
      }

      const truncated = text.length > 3900 ? text.substring(0, 3900) + '\n\n... (truncado)' : text;

      await ctx.reply(`*✓ Resultado*\n\n\`\`\`\n${truncated}\n\`\`\``);
    } catch (error: unknown) {
      const errorText =
        error instanceof Error
          ? (error.stack ?? String(error))
          : String(error || 'Error desconocido');
      const truncated = errorText.length > 3900 ? errorText.substring(0, 3900) : errorText;
      await ctx.reply(`*✗ Error*\n\n\`\`\`\n${truncated}\n\`\`\``);
    }
  }
}
