/**
 * GitCloneCommand.ts
 *
 * media command `gitclon` — Clonar repositorio de GitHub
 * Usage: !gitclon <URL>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '@/utils/logger.js';

const TMP_DIR = path.join(os.tmpdir(), 'vaniabot-gitclone');

/** Command handler for `!gitclon`: Clonar repositorio de GitHub. */
export class GitCloneCommand extends Command {
  name = 'gitclon';
  description = 'Clonar repositorio de GitHub';
  category = CommandCategory.MEDIA;
  aliases = ['clone', 'clonar'];
  usage = '!gitclon <URL>';
  examples = ['!gitclon https://github.com/username/repo'];
  cooldown = 60_000;

  async execute(ctx: MessageContext): Promise<void> {
    const url = ctx.args[0];

    if (!url) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta la URL* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!gitclon* <URL de GitHub>\n` +
          `✩ ejemplo: *!gitclon https://github.com/username/repo* ✩`,
      );
      return;
    }

    if (!url.includes('github.com')) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *URL inválida* ˚₊· ͟͟͞͞➳\n\n` + `❌ Solo se pueden clonar repositorios de GitHub.`,
      );
      return;
    }

    await ctx.react('⏳');

    try {
      let repoUrl = url.trim();
      if (!repoUrl.endsWith('/')) repoUrl += '/';

      const branchMatch = repoUrl.match(/tree\/([^/]+)/);
      const branch = branchMatch ? branchMatch[1] : 'main';
      const baseUrl = repoUrl.replace(/\/tree\/[^/]+$/, '');

      const zipUrl = `${baseUrl}/archive/refs/heads/${branch}.zip`;

      if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
      }

      const filePath = path.join(TMP_DIR, `repo_${Date.now()}.zip`);

      const response = await axios.get(zipUrl, {
        responseType: 'arraybuffer',
        timeout: 120_000,
      });

      fs.writeFileSync(filePath, response.data);

      await ctx.sock.sendMessage(ctx.chat.jid, {
        document: fs.readFileSync(filePath),
        mimetype: 'application/zip',
        fileName: 'repo.zip',
        caption: `📦 Repo clonado: ${baseUrl}`,
      });

      fs.unlinkSync(filePath);

      await ctx.react('✅');
    } catch (error) {
      logger.error('[GitCloneCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` +
          `❌ No pude clonar el repositorio. Verifica que la URL sea correcta.`,
      );
    }
  }
}
