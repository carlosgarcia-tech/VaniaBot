/**
 * MediacardCommand.ts
 *
 * creative command `mediacard` — Genera una card de preview para medios (test)
 * Usage: !mediacard [plataforma] [titulo] [autor] [duracion] [vistas]
 *
 * @author **Carlos G**
 */

import { Command } from '../../Command.js';
import { MediaCardService, type MediaCardOptions } from '@/services/creative/MediaCardService.js';
import { CommandCategory, CommandContext, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

const THUMBNAILS = {
  youtube: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  tiktok:
    'https://p16-amd-va.tiktokcdn.com/img/maliva-cloud-us/amd/amiso/57e098d0fdd4b9ae1a43c8f32e7cc4ad~tplv-r4rbqk6m2o-jpeg.image',
  instagram: 'https://i.imgur.com/4MBNjTQ.jpeg',
  facebook: 'https://i.imgur.com/WtQBJ9Q.jpeg',
  twitter: 'https://pbs.twimg.com/media/EXAMPL_E2.jpg',
};

/** Command handler for `!mediacard`: Genera una card de preview para medios (test). */
export class MediacardCommand extends Command {
  name = 'mediacard';
  description = 'Genera una card de preview para medios (test)';
  category = CommandCategory.CREATIVE;
  aliases = ['mctest', 'testcard'];
  cooldown = 5000;
  contexts = [CommandContext.BOTH];
  usage = '!mediacard [plataforma] [titulo] [autor] [duracion] [vistas]';
  examples = [
    '!mediacard youtube',
    '!mediacard youtube Video de prueba Autor123 3:45 1.2M',
    '!mediacard tiktok',
  ];

  async execute(ctx: MessageContext): Promise<void> {
    const args = ctx.args || [];

    await ctx.react('🎨');

    const platform = (args[0] || 'youtube').toLowerCase() as MediaCardOptions['platform'];
    const title = args.slice(1).join(' ') || 'Video de Prueba para Media Card';
    const author = 'Autor del Video';
    const duration = '3:45';
    const views = '1.2M';
    const quality = '1080p';

    const validPlatforms: MediaCardOptions['platform'][] = [
      'youtube',
      'tiktok',
      'instagram',
      'facebook',
      'twitter',
    ];
    if (!validPlatforms.includes(platform)) {
      await ctx.reply(`❌ Plataforma no válida. Opciones: ${validPlatforms.join(', ')}`);
      return;
    }

    const opts: MediaCardOptions = {
      thumbnail: THUMBNAILS[platform],
      title,
      duration,
      views,
      platform,
      quality,
      author,
    };

    try {
      const filePath = await MediaCardService.generateAndSave(opts);

      await ctx.sock.sendMessage(
        ctx.chat.jid,
        {
          image: { url: `file://${filePath}` },
          caption: `📱 *${platform.toUpperCase()} Card Preview*\n\n📝 Título: ${title}\n⏱️ Duración: ${duration}\n👁️ Vistas: ${views}\n🎬 Calidad: ${quality}\n👤 Autor: ${author}\n\n📁 Guardado en:\n\`${filePath}\``,
        },
        { quoted: ctx.message },
      );

      await ctx.react('✅');
    } catch (error) {
      logError('[MediaCard] Error:', error);
      await ctx.react('❌');
      await ctx.reply(
        `❌ Error generando card: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
