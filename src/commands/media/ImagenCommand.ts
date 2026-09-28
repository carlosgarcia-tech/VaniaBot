import { Command } from '../Command.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { primeService } from '@/services/system/PrimeService.js';
import { imageService } from '@/services/external/ImageService.js';
import { logger } from '@/utils/logger.js';

export class ImagenCommand extends Command {
  name = 'imagen';
  description = 'Busca imágenes en alta calidad';
  category = CommandCategory.MEDIA;
  aliases = ['imagen', 'foto'];
  usage = '!imagen <búsqueda>';
  examples = ['!imagen atardecer hermoso', '!imagen gato divertido', '!imagen paisaje montañas'];
  cooldown = 10000;
  contexts = [CommandContext.BOTH];

  async execute(ctx: MessageContext): Promise<void> {
    const query = ctx.args.join(' ').trim();

    if (!query) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *buscador de imágenes* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *cómo usar:* !imagen <búsqueda>\n\n` +
          `✩ *ejemplos:*\n` +
          `  ﹒!imagen atardecer\n` +
          `  ﹒!imagen gato\n` +
          `  ﹒!imagen paisaje`,
      );
      return;
    }

    await ctx.react('🔍');
    await ctx.reply('🔄 Buscando imágenes...');

    try {
      const images = await imageService.searchImages(query);

      if (images.length === 0) {
        await ctx.reply(`❌ No encontré imágenes para *"${query}"*.`);
        return;
      }

      const selected = images[Math.floor(Math.random() * images.length)];
      const imageUrl = selected.url;
      const footer = await primeService.formatFooter(ctx.sock, ctx.chat.jid, ctx.chat.isGroup);

      await ctx.sock.sendMessage(
        ctx.chat.jid,
        {
          image: { url: imageUrl },
          caption: `🖼️ *${query}*\n\n📷 Foto por: ${selected.photographer}\n\n${footer}`,
        },
        { quoted: ctx.message },
      );

      await ctx.react('✅');
    } catch (error) {
      logger.error('ImagenCommand error:', error);
      await ctx.reply('❌ Error al buscar imágenes.');
    }
  }
}
