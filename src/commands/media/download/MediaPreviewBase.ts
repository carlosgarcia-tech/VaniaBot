/**
 * MediaPreviewBase.ts
 *
 * Shared preview-card logic for media download commands.
 *
 * Consolidates the `getPreviewImage` / `sendPreviewWithThumbnail` /
 * `formatCount` code previously copy-pasted across YtMp3, YtMp4, TikTok,
 * Twitter, Instagram and Facebook commands. Subclasses only describe
 * *what* to show; the base class handles *how* to render it:
 *
 * 1. Try to render a rich MediaCard; if that fails...
 * 2. ...send the raw thumbnail with a caption; if there is no thumbnail...
 * 3. ...send a plain text caption.
 *
 * @author **Carlos G** ⭐
 */

import type { MessageContext } from '@/types/index.js';
import type { MediaCardOptions } from '@/services/creative/MediaCardService.js';
import { MediaCardService } from '@/services/creative/MediaCardService.js';
import axios from 'axios';

export interface PreviewInfo {
  title: string;
  url?: string;
  thumbnail?: string;
  duration?: string;
  author?: string;
  viewCount?: number;
  likeCount?: number;
}

/** Describes the fallback caption card when MediaCardService fails. */
export interface PreviewCaptionConfig {
  /** Decorative header, e.g. `✦ ˚₊· 𝙔𝙤𝙪𝙩𝙪𝙗𝙚 𝘼𝙪𝙙𝙞𝙤 ·₊˚ ✦` */
  header: string;
  /** Quality label shown next to a film emoji, e.g. `1080p` */
  quality?: string;
  /** Custom extra lines appended before the footer. */
  extraLines?: string[];
}

export abstract class MediaPreviewBase {
  /** Downloads a preview thumbnail, returning null on any failure. */
  protected async getPreviewImage(thumbnailUrl?: string): Promise<Buffer | null> {
    if (!thumbnailUrl) return null;

    try {
      const response = await axios.get<ArrayBuffer>(thumbnailUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  protected formatCount(n?: number): string {
    if (!n) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }

  private truncateTitle(title: string, maxLength = 55): string {
    return title.length > maxLength ? title.substring(0, maxLength) + '…' : title;
  }

  /**
   * Renders and sends the preview: MediaCard first, then thumbnail+caption,
   * then plain caption. Never throws — rendering is best-effort.
   */
  protected async sendPreview(
    ctx: MessageContext,
    info: PreviewInfo,
    cardData: MediaCardOptions,
    caption: PreviewCaptionConfig,
    status: string,
  ): Promise<void> {
    try {
      const card = await MediaCardService.generate(cardData);
      await ctx.sock.sendMessage(ctx.chat.jid, { image: card, caption: status });
      return;
    } catch {
      // fall through to the plain-text fallbacks
    }

    const captionText = this.buildFallbackCaption(info, caption, status);

    const thumbnail = await this.getPreviewImage(info.thumbnail);
    if (thumbnail) {
      await ctx.sock.sendMessage(ctx.chat.jid, {
        image: thumbnail,
        caption: captionText,
        mimetype: 'image/jpeg',
      });
    } else {
      await ctx.reply(captionText);
    }
  }

  private buildFallbackCaption(
    info: PreviewInfo,
    caption: PreviewCaptionConfig,
    status: string,
  ): string {
    const lines = [
      caption.header,
      '',
      `꒰ 🎀 ꒱ ${this.truncateTitle(info.title)}`,
      ...(info.author ? [`꒰ 🌸 ꒱ ${info.author}`] : []),
      ...(info.duration ? [`꒰ ⏳ ꒱ ${info.duration}`] : []),
      ...(caption.quality ? [`꒰ 🎞️ ꒱ ${caption.quality}`] : []),
      ...(caption.extraLines ?? []),
      '',
      `꒰ 👁 ꒱ ${this.formatCount(info.viewCount)} vistas  ·  ꒰ 🤍 ꒱ ${this.formatCount(info.likeCount)} likes`,
      '',
      `꒰ ✨ ꒱ ${status}...`,
      '',
      ...(info.url ? [`🔗 ${info.url}`] : []),
    ];

    return lines.join('\n');
  }
}
