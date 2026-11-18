/**
 * GitcloneCommand.ts
 *
 * media command `gitclone` — Downloads a GitHub repository as a zip document.
 * Usage: !gitclone <url>
 *
 * Direct GitHub flow (no dead API): the public repo API resolves the default
 * branch, then the codeload zip is downloaded to temp and sent as a document.
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { logError } from '@/utils/logger.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  CommandCategory,
  CommandContext,
  PermissionLevel,
  type MessageContext,
} from '@/types/index.js';

const TEMP_DIR = './data/temp/downloads';

/** Command handler for `!gitclone`: Downloads a GitHub repo as a zip. */
export class GitcloneCommand extends Command {
  name = 'gitclone';
  /** Downloads legitimately exceed the 30s default pipeline timeout. */
  timeout = 180000;
  parallelizable = true;
  description = 'Descarga un repositorio de GitHub como zip';
  category = CommandCategory.MEDIA;
  aliases = ['gitclone'];
  cooldown = 30000;
  contexts = [CommandContext.BOTH];
  usage = '!gitclone <url>';
  examples = ['!gitclone https://github.com/user/repo'];
  permissions = { user: [PermissionLevel.USER], bot: [] };

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args?.join(' ').trim();
    const match = url?.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/i);

    if (!match) {
      await ctx.reply(
        '❌ Debes proporcionar una URL válida de GitHub\n_Ejemplo: !gitclone https://github.com/user/repo_',
      );
      return;
    }

    const [, owner, repo] = match;
    await ctx.react('📦');

    try {
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoResponse.ok) {
        throw new Error(`no encontré el repositorio (${repoResponse.status})`);
      }
      const branch =
        ((await repoResponse.json()) as { default_branch?: string }).default_branch ?? 'main';

      await ctx.react('⏳');
      const zipResponse = await fetch(
        `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`,
      );
      if (!zipResponse.ok) {
        throw new Error(`no pude descargar el zip (${zipResponse.status})`);
      }
      const zip = Buffer.from(await zipResponse.arrayBuffer());
      if (zip.length === 0) {
        throw new Error('zip vacío');
      }

      const filePath = join(TEMP_DIR, `${repo}_${branch}_${Date.now()}.zip`);
      writeFileSync(filePath, zip);
      try {
        await ctx.sock.sendMessage(ctx.chat.jid, {
          document: { url: filePath },
          mimetype: 'application/zip',
          fileName: `${repo}-${branch}.zip`,
        });
        await ctx.react('✅');
      } finally {
        setTimeout(() => {
          try {
            unlinkSync(filePath);
          } catch {
            // best-effort cleanup
          }
        }, 30000);
      }
    } catch (error) {
      logError('[GitcloneCommand]', error);
      await ctx.react('❌');
      await ctx.reply(`❌ ${error instanceof Error ? error.message : 'Error al clonar'}`);
    }
  }
}
