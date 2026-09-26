import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { TikTokDownloader } from '@/services/download/TikTokDownloader.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class TikTokPreview extends MediaPreviewBase {
  async send(
    ctx: MessageContext,
    info: PreviewInfo,
    status: string,
    quality: string,
  ): Promise<void> {
    await this.sendPreview(
      ctx,
      info,
      {
        thumbnail: info.thumbnail,
        title: info.title,
        duration: info.duration,
        platform: 'tiktok',
        author: info.author,
        quality: `${quality}p`,
        music: 'Original Sound',
      },
      { header: '🎬', quality: `${quality}p` },
      status,
    );
  }
}

export class TiktokCommand extends Command {
  name = 'tiktok';
  description = 'Download TikTok videos without watermark';
  category = CommandCategory.MEDIA;
  aliases = ['tt', 'tk'];
  usage = '!tiktok <URL> [calidad]';
  examples = [
    '!tiktok https://www.tiktok.com/@user/video/123456789',
    '!tiktok https://vm.tiktok.com/XXXXXXXX/',
    '!tiktok https://vm.tiktok.com/XXXXXXXX/ 1080',
  ];
  cooldown = 30000;

  private downloader: TikTokDownloader;
  private preview = new TikTokPreview();

  constructor() {
    super();
    this.downloader = new TikTokDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito el enlace de TikTok* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!tiktok* <URL> [calidad]\n` +
          `✩ ejemplo: *!tiktok https://vm.tiktok.com/XXXXXXXX/* ✩\n` +
          `✩ calidad: 360, 480, 720, 1080 (default: 720)`,
      );
      return;
    }

    const { quality, remainingArgs } = this.downloader.getQualityFromArgs(ctx.args);
    const url = remainingArgs[0] || ctx.args[0];

    if (!this.downloader.isValidUrl(url)) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, ese enlace no me sirve* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ necesito un link válido de TikTok\n` +
          `✩ ejemplo: *https://www.tiktok.com/@user/video/123456789* ✩`,
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
          title: info?.title ?? 'TikTok video',
          author: info?.author ?? 'unknown',
          url,
          thumbnail: info?.thumbnailUrl,
          duration: info?.duration,
        },
        '\n> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
        quality,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(url, quality);

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
      logError('[TiktokCommand] Error', error);
      await ctx.react('❌');
      await ctx.reply(`❌ Error: ${errorMessage(error)}`);
    }
  }
}
