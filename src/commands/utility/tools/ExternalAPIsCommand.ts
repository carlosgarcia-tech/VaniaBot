import { Command } from '@/commands/Command.js';
import { CommandCategory, CommandContext } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import axios from 'axios';
import { logger } from '@/utils/logger.js';

export class WikipediaCommand extends Command {
  name = 'wikipedia';
  description = 'Buscar en Wikipedia';
  category = CommandCategory.UTILITY;
  aliases = ['wikipedia', 'wikipediab'];
  usage = '.wikipedia <tema>';
  examples = ['.wikipedia TypeScript', '.wikipedia WhatsApp'];
  contexts = [CommandContext.BOTH];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ');

    if (!query) {
      await ctx.reply('用法: .wikipedia <tema>\nEjemplo: .wikipedia TypeScript');
      return;
    }

    try {
      await ctx.react('🔍');

      logger.info(`[Wikipedia] Buscando: ${query}`);

      const response = await axios.get(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'VaniaBot/1.0 (WhatsApp Bot)',
            Accept: 'application/json',
          },
        },
      );

      const data = response.data;

      if (!data.extract) {
        await ctx.reply(`No encontré información sobre: ${query}`);
        return;
      }

      let message = `*📚 ${data.title}*\n\n`;
      message += `${data.extract}\n\n`;

      if (data.description) {
        message += `_${data.description}_`;
      }

      await ctx.reply(message);
      logger.info(`[Wikipedia] Éxito: ${query}`);
    } catch (error) {
      logger.error(`[Wikipedia] Error: ${query}`, error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          await ctx.reply(`No encontré información sobre: ${query}`);
        } else {
          await ctx.reply(`❌ Error de conexión: ${error.message}`);
        }
      } else {
        await ctx.reply('❌ Error al buscar en Wikipedia');
      }
    }
  }
}

export class DefineCommand extends Command {
  name = 'define';
  description = 'Definición de palabra';
  category = CommandCategory.UTILITY;
  aliases = ['definir', 'dictionary'];
  usage = '.define <palabra>';
  examples = ['.define hello', '.define love'];
  contexts = [CommandContext.BOTH];
  cooldown = 5000;

  async execute(ctx: MessageContext): Promise<void> {
    const word = ctx.args.join(' ');

    if (!word) {
      await ctx.reply('用法: .define <palabra>\nEjemplo: .define hello');
      return;
    }

    try {
      await ctx.react('📖');

      logger.info(`[Define] Buscando: ${word}`);

      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'VaniaBot/1.0 (WhatsApp Bot)',
          },
        },
      );

      if (response.data && response.data.length > 0) {
        const entry = response.data[0];
        const definition = entry.meanings?.[0]?.definitions?.[0];

        if (!definition) {
          await ctx.reply(`No encontré definición para: ${word}`);
          return;
        }

        let message = `*📖 ${entry.word}*\n\n`;

        if (entry.phonetic) {
          message += `🔊 ${entry.phonetic}\n\n`;
        }

        message += `_${entry.meanings?.[0]?.partOfSpeech || ''}_\n`;
        message += `${definition.definition}\n\n`;

        if (definition.example) {
          message += `📝 _Ejemplo: "${definition.example}"_`;
        }

        await ctx.reply(message);
        logger.info(`[Define] Éxito: ${word}`);
      } else {
        await ctx.reply(`No encontré definición para: ${word}`);
      }
    } catch (error) {
      logger.error(`[Define] Error: ${word}`, error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          await ctx.reply(`No encontré definición para: ${word}`);
        } else {
          await ctx.reply(`❌ Error de conexión: ${error.message}`);
        }
      } else {
        await ctx.reply('❌ Error al buscar definición');
      }
    }
  }
}
