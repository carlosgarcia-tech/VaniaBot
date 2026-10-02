/**
 * GitHubSearchCommand.ts
 *
 * media command `githubsearch` — Buscar repositorios en GitHub
 * Usage: !githubsearch <búsqueda>
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios from 'axios';
import { logError } from '@/utils/logger.js';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Command handler for `!githubsearch`: Buscar repositorios en GitHub. */
export class GitHubSearchCommand extends Command {
  name = 'githubsearch';
  description = 'Buscar repositorios en GitHub';
  category = CommandCategory.MEDIA;
  aliases = ['ghsearch', 'github'];
  usage = '!githubsearch <búsqueda>';
  examples = ['!githubsearch DolphinBot', '!githubsearch whatsapp bot'];
  cooldown = 15_000;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ');

    if (!query) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *falta la búsqueda* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!githubsearch* <búsqueda>\n` +
          `✩ ejemplo: *!githubsearch DolphinBot* ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const response = await axios.get('https://api.github.com/search/repositories', {
        params: { q: query },
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      const repos = response.data.items.slice(0, 5);

      if (repos.length === 0) {
        await ctx.react('❌');
        await ctx.reply(`❌ No se encontraron resultados para: ${query}`);
        return;
      }

      const results = repos
        .map(
          (
            repo: {
              name: string;
              html_url: string;
              owner: { login: string };
              created_at: string;
              updated_at: string;
              watchers: number;
              stargazers_count: number;
              open_issues: number;
              description: string | null;
            },
            index: number,
          ) =>
            `🍟 *${index + 1}. ${repo.name}*\n` +
            `🔗 ${repo.html_url}\n` +
            `👑 Creador: ${repo.owner.login}\n` +
            `📅 Creado: ${formatDate(repo.created_at)}\n` +
            `🕐 Actualizado: ${formatDate(repo.updated_at)}\n` +
            `👀 Visitas: ${repo.watchers}\n` +
            `⭐ Estrellas: ${repo.stargazers_count}\n` +
            `📋 Issues: ${repo.open_issues}\n` +
            `📝 Descripción: ${repo.description || 'Sin descripción'}\n`,
        )
        .join('\n───────────────\n\n');

      await ctx.reply(`╭━〔GITHUB SEARCH〕━⬣\n\n` + results + `\n╰━━━━━━━━━━━━━━⬣`);

      await ctx.react('✅');
    } catch (error) {
      logError('[GitHubSearchCommand] Error:', error);
      await ctx.react('❌');
      await ctx.reply(`˚₊· ͟͟͞͞➳ *error* ˚₊· ͟͟͞͞➳\n\n` + `❌ No pude buscar en GitHub.`);
    }
  }
}
