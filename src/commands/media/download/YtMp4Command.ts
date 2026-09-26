import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class YtVideoPreview extends MediaPreviewBase {
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
        views: this.formatCount(info.viewCount),
        platform: 'youtube',
        author: info.author,
        quality: `${quality}p`,
      },
      { header: `✦ ˚₊· 𝙔𝙤𝙪𝙏𝙪𝙗𝙚 𝙑𝙞𝙙𝙚𝙤 ·₊˚ ✦`, quality: `${quality}p` },
      status,
    );
  }
}

export class YtMp4Command extends Command {
  name = 'ytmp4';
  description = 'Download YouTube video as MP4';
  category = CommandCategory.MEDIA;
  aliases = ['ytv', 'ytvideo', 'video'];
  usage = '!ytmp4 <search or URL> [calidad]';
  examples = [
    '!ytmp4 tutorial android',
    '!ytmp4 https://youtu.be/dQw4w9WgXcQ',
    '!ytmp4 bad bunny 1080',
  ];
  cooldown = 30000;

  private downloader: YouTubeDownloader;
  private preview = new YtVideoPreview();

  constructor() {
    super();
    this.downloader = new YouTubeDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una búsqueda o enlace* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!ytmp4* <búsqueda o URL> [calidad]\n` +
          `✩ ejemplo: *!ytmp4 tutorial* ✩\n` +
          `✩ calidad: 360, 480, 720, 1080 (default: 720)`,
      );
      return;
    }

    const { quality, remainingArgs } = this.downloader.getQualityFromArgs(ctx.args);
    const query = remainingArgs.join(' ') || ctx.args.join(' ');

    await ctx.react('🔍');

    try {
      const video = await this.downloader.searchVideo(query);

      if (!video) {
        await ctx.react('❌');
        await ctx.reply('❌ No results found');
        return;
      }

      await this.preview.send(
        ctx,
        {
          title: video.title,
          url: video.url,
          thumbnail: video.thumbnail,
          duration: video.duration,
          author: video.channel,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
        },
        '> 𝙑𝙖𝙣𝙞𝙖𝘽𝙤𝙩 𝘿𝙚𝙨𝙘𝙖𝙧𝙜𝙖𝙨 💕',
        quality,
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadVideo(video.videoId, quality);

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
      logError('[YtMp4Command] Error', error);
      await ctx.react('❌');
      await ctx.reply(`❌ Error: ${errorMessage(error)}`);
    }
  }
}
