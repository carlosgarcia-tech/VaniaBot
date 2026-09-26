import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { InstagramDownloader } from '@/services/download/InstagramDownloader.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class InstagramPreview extends MediaPreviewBase {
  async send(
    ctx: MessageContext,
    info: PreviewInfo,
    status: string,
    isImage: boolean,
  ): Promise<void> {
    await this.sendPreview(
      ctx,
      info,
      {
        thumbnail: info.thumbnail,
        title: info.title,
        platform: 'instagram',
        author: info.author,
        duration: isImage ? undefined : '0:30',
        music: 'Original Sound',
      },
      { header: isImage ? '🖼️' : '🎬', extraLines: ['⬇️ descargando...'] },
      status,
    );
  }
}

export class InstagramCommand extends Command {
  name = 'instagram';
  description = 'Download Instagram Reels, posts and stories';
  category = CommandCategory.MEDIA;
  aliases = ['ig', 'insta', 'reel'];
  usage = '!instagram <URL>';
  examples = [
    '!instagram https://www.instagram.com/reel/XXXXXXXXXX/',
    '!ig https://www.instagram.com/p/XXXXXXXXXX/',
  ];
  cooldown = 30000;

  private downloader: InstagramDownloader;
  private preview = new InstagramPreview();

  constructor() {
    super();
    this.downloader = new InstagramDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de Instagram* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!instagram* <URL>\n` +
          `✩ ejemplo: *!instagram https://www.instagram.com/reel/XXXXXXXXXX/* ✩`,
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de Instagram\n` +
          `✩ acepto: */reel/*, */p/*, */tv/*, */stories/* ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const infoResult = await this.downloader.getMediaInfo(url);

      const info = infoResult._tag === 'Right' ? infoResult.right : null;
      const isImage = info?.type === 'image';

      await this.preview.send(
        ctx,
        {
          title: info?.title || 'Instagram post',
          url,
          thumbnail: info?.thumbnailUrl,
          author: info?.author,
        },
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
        isImage,
      );

      await ctx.react('⏳');

      const result = isImage
        ? await this.downloader.downloadImage(url)
        : await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const downloadSuccess = result.right;

      try {
        if (isImage) {
          await ctx.sock.sendMessage(ctx.chat.jid, {
            image: { url: downloadSuccess.filePath },
          });
        } else {
          // Stream from the file path: Baileys reads it in chunks, avoiding
          // loading the whole video into RAM.
          await ctx.sock.sendMessage(ctx.chat.jid, {
            video: { url: downloadSuccess.filePath },
            mimetype: 'video/mp4',
          });
        }

        await ctx.react('✅');
      } finally {
        await this.downloader.cleanup(downloadSuccess.filePath);
      }
    } catch (error: unknown) {
      logError('[InstagramCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply(`❌ Error: ${errorMessage(error)}`);
    }
  }
}
