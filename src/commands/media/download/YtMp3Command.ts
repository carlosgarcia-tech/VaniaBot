import { errorMessage } from '@/utils/errors.js';
import { Command } from '../../Command.js';
import { CommandCategory, type MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';
import { YouTubeDownloader } from '@/services/download/YouTubeDownloader.js';
import { isRight } from '@/utils/either.js';
import { MediaPreviewBase, type PreviewInfo } from './MediaPreviewBase.js';

class YtAudioPreview extends MediaPreviewBase {
  async send(ctx: MessageContext, info: PreviewInfo, status: string): Promise<void> {
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
        quality: 'AUDIO',
      },
      { header: `✦ ˚₊· 𝙔𝙤𝙪𝙏𝙪𝙗𝙚 𝘼𝙪𝙙𝙞𝙤 ·₊˚ ✦` },
      status,
    );
  }
}

export class YtMp3Command extends Command {
  name = 'ytmp3';
  description = 'Download YouTube audio as MP3';
  category = CommandCategory.MEDIA;
  aliases = ['yta', 'ytaudio', 'play', 'audio'];
  usage = '!ytmp3 <search or URL>';
  examples = ['!ytmp3 bad bunny', '!ytmp3 https://youtu.be/dQw4w9WgXcQ'];
  cooldown = 30000;

  private downloader: YouTubeDownloader;
  private preview = new YtAudioPreview();

  constructor() {
    super();
    this.downloader = new YouTubeDownloader();
  }

  async execute(ctx: MessageContext): Promise<void> {
    if (!ctx.args.length) {
      await ctx.reply(
        `˚₊· ͟͟͞͞➳ *oops, necesito una búsqueda o enlace* ˚₊· ͟͟͞͞➳\n\n` +
          `✿ *!ytmp3* <búsqueda o URL>\n` +
          `✩ ejemplo: *!ytmp3 bad bunny* ✩`,
      );
      return;
    }

    const query = ctx.args.join(' ');

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
      );

      await ctx.react('⏳');

      const result = await this.downloader.downloadAudio(video.videoId);

      if (!isRight(result)) {
        await ctx.react('❌');
        await ctx.reply(`❌ Download failed\n\n${result.left.message}`);
        return;
      }

      const filePath = result.right.filePath;

      const sanitizeFilename = (title: string): string => {
        return title.replace(/[^\w\s]/gi, '');
      };

      try {
        // Stream from the file path: Baileys reads it in chunks, avoiding
        // loading the whole audio file into RAM.
        await ctx.sock.sendMessage(ctx.chat.jid, {
          audio: { url: filePath },
          mimetype: 'audio/mpeg',
          fileName: `${sanitizeFilename(video.title)}.mp3`,
        });

        await ctx.react('✅');
      } finally {
        await this.downloader.cleanup(filePath);
      }
    } catch (error: unknown) {
      logError('[YtMp3Command] Error', error);
      await ctx.react('❌');
      await ctx.reply(`❌ Error: ${errorMessage(error)}`);
    }
  }
}
