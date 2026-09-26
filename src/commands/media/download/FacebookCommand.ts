import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { FacebookDownloader } from '@/services/download/FacebookDownloader.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class FacebookPreview extends MediaPreviewBase {
  async send(ctx: MessageContext, info: PreviewInfo, status: string): Promise<void> {
    await this.sendPreview(
      ctx,
      info,
      {
        thumbnail: info.thumbnail,
        title: info.title,
        platform: 'facebook',
        author: info.author,
        quality: 'HD',
      },
      { header: '📺 *Facebook*', extraLines: ['⬇️ descargando...'] },
      status,
    );
  }
}

export class FacebookCommand extends Command {
  name = 'facebook';
  description = 'Download Facebook videos and Reels';
  category = CommandCategory.MEDIA;
  aliases = ['fb', 'fbvideo'];
  usage = '!facebook <URL>';
  examples = [
    '!facebook https://www.facebook.com/watch/?v=123456789',
    '!fb https://fb.watch/XXXXXXXXXX/',
  ];
  cooldown = 30000;

  private downloader: FacebookDownloader;
  private preview = new FacebookPreview();

  constructor() {
    super();
    this.downloader = new FacebookDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de Facebook* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!facebook* <URL>\n` +
          `✩ ejemplo: *!facebook https://fb.watch/XXXXXXXXXX/* ✩`,
      );
      return;
    }

    const url = ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de Facebook\n` +
          `✩ solo videos públicos, por favor ✩`,
      );
      return;
    }

    await ctx.react('🔍');

    try {
      const infoResult = await this.downloader.getVideoInfo(url);
      const info = infoResult._tag === 'Right' ? infoResult.right : null;

      await this.preview.send(
        ctx,
        {
          title: info?.title || 'Facebook video',
          url,
          thumbnail: info?.thumbnailUrl,
          author: info?.author,
        },
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(url);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const downloadSuccess = result.right;
      const filePath = downloadSuccess.filePath;

      try {
        // Stream from the file path: Baileys reads it in chunks, avoiding
        // loading the whole video into RAM.
        await ctx.sock.sendMessage(ctx.chat.jid, {
          video: { url: filePath },
          mimetype: 'video/mp4',
        });

        await ctx.react('✅');
      } finally {
        await this.downloader.cleanup(filePath);
      }
    } catch (error: unknown) {
      logError('[FacebookCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply(`❌ Error: ${errorMessage(error)}`);
    }
  }
}
