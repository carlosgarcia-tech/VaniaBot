/**
 * ExecCommand.ts
 *
 * owner command `exec` — Ejecuta comandos del sistema
 * Usage: !exec <comando>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkPinVerification } from '@/utils/pinVerificationHelper.js';

const execAsync = promisify(exec);

/** Command handler for `!exec`: Ejecuta comandos del sistema. */
export class ExecCommand extends Command {
  name = 'exec';
  description = 'Ejecuta comandos del sistema';
  category = CommandCategory.OWNER;
  aliases = ['shell', 'bash', 'cmd'];
  usage = '!exec <comando>';
  examples = ['!exec ls -la', '!exec whoami', '!exec node --version'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    const command = ctx.args.join(' ').trim();

    const { requiresPin: _requiresPin, canExecute } = await checkPinVerification(
      ctx,
      'exec',
      command,
    );
    if (!canExecute) {
      return;
    }

    if (!command) {
      await ctx.reply(
        '*EXEC*\n\n' +
          'Ejecuta comandos del shell del sistema.\n\n' +
          'Uso: !exec <comando>\n' +
          'Ejemplo: !exec ls -la\n' +
          'Ejemplo: !exec whoami\n' +
          'Ejemplo: !exec node --version',
      );
      return;
    }

    const TIMEOUT_MS = 20_000;

    try {
      await ctx.react('⏳');

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: TIMEOUT_MS,
        maxBuffer: 2 * 1024 * 1024,
        shell: '/bin/bash',
      });

      const chunks: string[] = [];

      if (stdout?.trim()) {
        chunks.push(`STDOUT:\n${stdout.trim()}`);
      }

      if (stderr?.trim()) {
        chunks.push(`STDERR:\n${stderr.trim()}`);
      }

      const result = chunks.join('\n\n') || 'Comando ejecutado sin salida.';
      const truncated =
        result.length > 3900 ? result.substring(0, 3900) + '\n\n... (truncado)' : result;

      await ctx.reply(`*✓ Ejecutado*\n\n\`\`\`\n${truncated}\n\`\`\``);
    } catch (error) {
      let errorText: string;

      if (error instanceof Error) {
        if ('stdout' in error && error.stdout) {
          const stdout = String(error.stdout);
          const stderr = 'stderr' in error ? String(error.stderr || '') : '';
          const chunks: string[] = [];

          if (stdout.trim()) chunks.push(`STDOUT:\n${stdout.trim()}`);
          if (stderr.trim()) chunks.push(`STDERR:\n${stderr.trim()}`);

          if (chunks.length > 0) {
            const result = chunks.join('\n\n');
            const truncated =
              result.length > 3900 ? result.substring(0, 3900) + '\n\n... (truncado)' : result;
            await ctx.reply(`*⚠ Timeout/Error*\n\n\`\`\`\n${truncated}\n\`\`\``);
            return;
          }
          errorText = error.message;
        } else {
          errorText = error.stack ?? error.message;
        }
      } else {
        errorText = String(error);
      }

      const truncated = errorText.length > 3900 ? errorText.substring(0, 3900) : errorText;
      await ctx.reply(`*✗ Error*\n\n\`\`\`\n${truncated}\n\`\`\``);
    }
  }
}
