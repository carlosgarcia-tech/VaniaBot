/**
 * MediaCardService.ts
 *
 * VaniaBot services module exposing `MediaCardService`, `MediaCardOptions`.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import path from 'path';
import { findAssetFile } from '@/utils/assetHelper.js';
import { logError } from '@/utils/logger.js';

export interface MediaCardOptions {
  thumbnail?: string;
  title: string;
  duration?: string;
  views?: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'twitter';
  quality?: string;
  author?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  music?: string;
  outputPath?: string;
}

type Platform = MediaCardOptions['platform'];

const WIDTH = 720;
const HEIGHT = 480;

const PLATFORM_COLORS: Record<
  Platform,
  { bg: string; accent: string; text: string; secondary: string }
> = {
  youtube: { bg: '#FFFFFF', accent: '#FF0000', text: '#0F0F0F', secondary: '#606060' },
  tiktok: { bg: '#000000', accent: '#69C9D0', text: '#FFFFFF', secondary: '#69C9D0' },
  instagram: { bg: '#1a0a2e', accent: '#E1306C', text: '#FFFFFF', secondary: '#FCAF45' },
  facebook: { bg: '#FFFFFF', accent: '#1877F2', text: '#050505', secondary: '#6A7180' },
  twitter: { bg: '#000000', accent: '#1D9BF0', text: '#FFFFFF', secondary: '#536471' },
};

const PLATFORM_LOGO_FILES: Record<Platform, string> = {
  youtube: 'ytLogo.png',
  tiktok: 'tiktokLogo.png',
  instagram: 'instagramLogo.png',
  facebook: 'facebookLogo.png',
  twitter: 'xLogo.jpg',
};

export class MediaCardService {
  static async generate(opts: MediaCardOptions): Promise<Buffer> {
    switch (opts.platform) {
      case 'youtube':
        return this.generateYouTube(opts);
      case 'tiktok':
        return this.generateTikTok(opts);
      case 'instagram':
        return this.generateInstagram(opts);
      case 'facebook':
        return this.generateFacebook(opts);
      case 'twitter':
        return this.generateTwitter(opts);
    }
  }

  static async generateAndSave(opts: MediaCardOptions): Promise<string> {
    const buffer = await this.generate(opts);
    const fileName = `mediacard_${opts.platform}_${Date.now()}.jpg`;
    const outputPath = opts.outputPath || path.join(process.cwd(), 'cards-test', fileName);
    writeFileSync(outputPath, buffer);
    return outputPath;
  }

  private static async loadThumbnail(
    thumbnail?: string,
  ): Promise<ReturnType<typeof loadImage> | null> {
    if (!thumbnail) return null;
    try {
      return await loadImage(thumbnail);
    } catch (error) {
      logError('[MediaCardService]', error);
      return null;
    }
  }

  private static async loadLogoAsset(
    filename: string,
  ): Promise<Awaited<ReturnType<typeof loadImage>> | null> {
    const buf = findAssetFile(filename);
    if (!buf) return null;
    try {
      return await loadImage(buf);
    } catch (error) {
      logError('[MediaCardService]', error);
      return null;
    }
  }

  private static wrapText(text: string, maxWidth: number, maxChars: number = 40): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length > maxChars) {
        if (current) {
          lines.push(current);
          current = word;
        } else {
          current = word.substring(0, maxChars);
        }
      } else {
        current = test;
      }
    }
    if (current) {
      lines.push(current.length > maxChars ? current.substring(0, maxChars - 1) + '...' : current);
    }
    return lines.slice(0, 2);
  }

  private static roundRect(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  private static drawDurationBadge(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    duration: string,
    x: number,
    y: number,
    bgColor: string = 'rgba(0,0,0,0.8)',
    textColor: string = '#FFFFFF',
  ) {
    ctx.font = 'bold 12px sans-serif';
    const metrics = ctx.measureText(duration);
    const w = metrics.width + 12;
    const h = 18;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x - w, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText(duration, x - w + 6, y + 13);
  }

  private static drawCircularAvatar(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    x: number,
    y: number,
    size: number,
    avatar?: Awaited<ReturnType<typeof loadImage>> | null,
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(x, y, size, size);
    if (avatar) {
      ctx.drawImage(avatar, x, y, size, size);
    }
    ctx.restore();
  }

  private static drawImageCover(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    img: Awaited<ReturnType<typeof loadImage>>,
    destX: number,
    destY: number,
    destW: number,
    destH: number,
  ) {
    const imgRatio = img.width / img.height;
    const destRatio = destW / destH;
    let sx = 0,
      sy = 0,
      sw = img.width,
      sh = img.height;
    if (imgRatio > destRatio) {
      sw = img.height * destRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / destRatio;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
  }

  /**
   * Draws a pill/badge containing the platform logo and the VaniaBot logo side
   * by side. Both logos are rendered from real image assets so they look crisp.
   *
   * Sizes are larger than the old hand-drawn version so the logos are clearly
   * legible at a glance.
   */
  private static async drawPlatformAndVaniaLogos(
    ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
    platform: Platform,
    /** right-edge X of the badge */
    rightX: number,
    /** top Y of the badge */
    y: number,
    /** logo square size (each logo) */
    logoSize: number,
    vaniaLogo: Awaited<ReturnType<typeof loadImage>> | null,
    platformLogo: Awaited<ReturnType<typeof loadImage>> | null,
  ) {
    const gap = 6;
    const padding = 6;
    const radius = logoSize * 0.18;
    const badgeW = padding * 2 + logoSize * 2 + gap;
    const badgeH = padding * 2 + logoSize;
    const badgeX = rightX - badgeW;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeW, badgeH, radius * 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const imgY = y + padding;

    const platX = badgeX + padding;
    if (platformLogo) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(platX, imgY, logoSize, logoSize, radius);
      ctx.clip();
      ctx.drawImage(platformLogo, platX, imgY, logoSize, logoSize);
      ctx.restore();
    }

    const vaniaX = platX + logoSize + gap;
    if (vaniaLogo) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(vaniaX, imgY, logoSize, logoSize, radius);
      ctx.clip();
      ctx.drawImage(vaniaLogo, vaniaX, imgY, logoSize, logoSize);
      ctx.restore();
    }
  }

  private static async generateYouTube(opts: MediaCardOptions): Promise<Buffer> {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const { bg, accent, text, secondary } = PLATFORM_COLORS.youtube;

    const [vaniaLogo, platformLogo] = await Promise.all([
      this.loadLogoAsset('logo.png'),
      this.loadLogoAsset(PLATFORM_LOGO_FILES.youtube),
    ]);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, WIDTH, 8);
    ctx.fillRect(0, HEIGHT - 8, WIDTH, 8);

    const thumbH = 272;
    const thumb = await this.loadThumbnail(opts.thumbnail);
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(0, 8, WIDTH, thumbH);
    if (thumb) this.drawImageCover(ctx, thumb, 0, 8, WIDTH, thumbH);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 8, WIDTH, thumbH);

    if (opts.duration) {
      this.drawDurationBadge(ctx, opts.duration, WIDTH - 12, 8 + thumbH - 24);
    }

    const infoY = 8 + thumbH + 16;
    const avatarSize = 40;
    const avatarX = 16;
    const avatarY = infoY;
    const avatar = await this.loadThumbnail(opts.thumbnail);
    this.drawCircularAvatar(ctx, avatarX, avatarY, avatarSize, avatar);

    const textX = avatarX + avatarSize + 12;
    let textY = infoY + 16;

    ctx.font = '500 14px sans-serif';
    ctx.fillStyle = text;
    const titleLines = this.wrapText(opts.title, WIDTH - textX - 20, 45);
    titleLines.forEach((line, i) => ctx.fillText(line, textX, textY + i * 20));
    textY += titleLines.length * 20 + 4;

    if (opts.author) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = text;
      ctx.fillText(opts.author, textX, textY);
      textY += 16;
    }

    const meta: string[] = [];
    if (opts.views) meta.push(`${opts.views} views`);
    meta.push('YouTube');
    ctx.font = '12px sans-serif';
    ctx.fillStyle = secondary;
    ctx.fillText(meta.join(' • '), textX, textY);

    const LOGO_SIZE = 48;
    await this.drawPlatformAndVaniaLogos(
      ctx,
      'youtube',
      WIDTH - 12,
      HEIGHT - 8 - LOGO_SIZE - 8,
      LOGO_SIZE,
      vaniaLogo,
      platformLogo,
    );

    return canvas.toBuffer('image/jpeg', 92);
  }

  private static async generateTikTok(opts: MediaCardOptions): Promise<Buffer> {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const { bg, text } = PLATFORM_COLORS.tiktok;

    const [vaniaLogo, platformLogo] = await Promise.all([
      this.loadLogoAsset('logo.png'),
      this.loadLogoAsset(PLATFORM_LOGO_FILES.tiktok),
    ]);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const topGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
    topGrad.addColorStop(0, '#69C9D0');
    topGrad.addColorStop(0.5, '#EE1D52');
    topGrad.addColorStop(1, '#69C9D0');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, WIDTH, 6);

    const thumbH = 270;
    const thumb = await this.loadThumbnail(opts.thumbnail);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 6, WIDTH, thumbH);

    if (thumb) {
      ctx.save();
      this.drawImageCover(ctx, thumb, 0, 6, WIDTH, thumbH);
      ctx.restore();
      const grad = ctx.createLinearGradient(0, thumbH - 80, 0, thumbH + 6);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, thumbH - 80, WIDTH, 86);
    }

    if (opts.duration) {
      ctx.font = 'bold 13px sans-serif';
      const durW = ctx.measureText(opts.duration).width + 16;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.roundRect(WIDTH - durW - 16, thumbH - 30, durW, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillText(opts.duration, WIDTH - durW - 4, thumbH - 12);
    }

    const infoY = thumbH + 24;
    if (opts.author) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = text;
      ctx.fillText(`@${opts.author}`, 16, infoY + 16);
    }

    let metaY = infoY + 40;
    if (opts.title) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const descLines = this.wrapText(opts.title, WIDTH - 32, 50);
      descLines.forEach((line, i) => ctx.fillText(line, 16, metaY + i * 20));
      metaY += descLines.length * 20 + 8;
    }

    if (opts.music) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#69C9D0';
      ctx.fillText('♪', 16, metaY);
      ctx.fillStyle = text;
      ctx.fillText(` ${opts.music}`, 32, metaY);
      metaY += 28;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(16, HEIGHT - 52, WIDTH - 32, 1);

    const statsY = HEIGHT - 28;
    ctx.textAlign = 'left';
    let currentX = 16;

    if (opts.likes) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#EE1D52';
      ctx.fillText('♥', currentX, statsY);
      currentX += 20;
      ctx.fillStyle = text;
      ctx.fillText(`${opts.likes}`, currentX, statsY);
      currentX += ctx.measureText(opts.likes).width + 24;
    }
    if (opts.comments) {
      ctx.fillStyle = text;
      ctx.fillText('💬', currentX, statsY);
      currentX += 22;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(opts.comments, currentX, statsY);
      currentX += ctx.measureText(opts.comments).width + 24;
    }
    if (opts.shares) {
      ctx.fillStyle = text;
      ctx.fillText('↗', currentX, statsY);
      currentX += 20;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(opts.shares, currentX, statsY);
    }

    const LOGO_SIZE = 48;
    await this.drawPlatformAndVaniaLogos(
      ctx,
      'tiktok',
      WIDTH - 12,
      HEIGHT - 8 - LOGO_SIZE - 8,
      LOGO_SIZE,
      vaniaLogo,
      platformLogo,
    );

    ctx.textAlign = 'left';
    return canvas.toBuffer('image/jpeg', 92);
  }

  private static async generateInstagram(opts: MediaCardOptions): Promise<Buffer> {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    const [vaniaLogo, platformLogo] = await Promise.all([
      this.loadLogoAsset('logo.png'),
      this.loadLogoAsset(PLATFORM_LOGO_FILES.instagram),
    ]);

    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#405DE6');
    grad.addColorStop(0.25, '#833AB4');
    grad.addColorStop(0.5, '#C13584');
    grad.addColorStop(0.75, '#E1306C');
    grad.addColorStop(1, '#F77737');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const cardMargin = 12;
    const cardX = cardMargin;
    const cardY = 12;
    const cardW = WIDTH - cardMargin * 2;
    const thumbH = 260;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, HEIGHT - 24, 16);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, thumbH, 12);
    ctx.clip();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cardX, cardY, cardW, thumbH);
    const thumb = await this.loadThumbnail(opts.thumbnail);
    if (thumb) this.drawImageCover(ctx, thumb, cardX, cardY, cardW, thumbH);
    ctx.restore();

    if (opts.duration) {
      this.drawDurationBadge(
        ctx,
        opts.duration,
        cardX + cardW - 12,
        cardY + thumbH - 24,
        '#FFFFFF',
        '#000000',
      );
    }

    const infoY = cardY + thumbH + 16;
    const avatarSize = 36;
    const avatarX = cardX + 12;
    const avatarY = infoY;
    const avatar = await this.loadThumbnail(opts.thumbnail);
    this.drawCircularAvatar(ctx, avatarX, avatarY, avatarSize, avatar);

    const textX = avatarX + avatarSize + 12;
    let textY = infoY + 12;

    if (opts.author) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText(`@${opts.author}`, textX, textY);
      ctx.shadowBlur = 0;
      textY += 22;
    }
    if (opts.music) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`♪ ${opts.music}`, textX, textY);
      textY += 20;
    }
    if (opts.title) {
      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      const descLines = this.wrapText(opts.title, cardW - 40, 45);
      descLines.forEach((line, i) => ctx.fillText(line, cardX + 12, textY + i * 18));
      textY += descLines.length * 18 + 8;
    }
    if (opts.likes) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`♥ ${opts.likes} likes`, cardX + 12, textY + 16);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(cardX + 12, HEIGHT - 36, cardW - 24, 1);

    const LOGO_SIZE = 48;
    await this.drawPlatformAndVaniaLogos(
      ctx,
      'instagram',
      cardX + cardW - 12,
      HEIGHT - 8 - LOGO_SIZE - 8,
      LOGO_SIZE,
      vaniaLogo,
      platformLogo,
    );

    return canvas.toBuffer('image/jpeg', 92);
  }

  private static async generateFacebook(opts: MediaCardOptions): Promise<Buffer> {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const { bg, accent: _accent, text, secondary } = PLATFORM_COLORS.facebook;

    const [vaniaLogo, platformLogo] = await Promise.all([
      this.loadLogoAsset('logo.png'),
      this.loadLogoAsset(PLATFORM_LOGO_FILES.facebook),
    ]);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const headerH = 56;
    ctx.fillStyle = '#F0F2F5';
    ctx.fillRect(0, 0, WIDTH, headerH);

    const avatarSize = 40;
    const avatar = await this.loadThumbnail(opts.thumbnail);
    this.drawCircularAvatar(ctx, 16, 8, avatarSize, avatar);

    const nameX = 16 + avatarSize + 12;
    ctx.font = '600 14px sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(opts.author || 'Facebook Page', nameX, 20);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = secondary;
    ctx.fillText('2 hours ago · 🌐', nameX, 38);

    const thumbY = headerH + 1;
    const thumbH = 260;
    ctx.fillStyle = '#E5E5E5';
    ctx.fillRect(0, thumbY, WIDTH, thumbH);
    const thumb = await this.loadThumbnail(opts.thumbnail);
    if (thumb) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, thumbY, WIDTH, thumbH);
      ctx.clip();
      this.drawImageCover(ctx, thumb, 0, thumbY, WIDTH, thumbH);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(WIDTH / 2, thumbY + thumbH / 2, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 8, thumbY + thumbH / 2 - 12);
    ctx.lineTo(WIDTH / 2 + 12, thumbY + thumbH / 2);
    ctx.lineTo(WIDTH / 2 - 8, thumbY + thumbH / 2 + 12);
    ctx.closePath();
    ctx.fill();

    if (opts.quality) {
      ctx.font = 'bold 11px sans-serif';
      const hdText = opts.quality.toUpperCase();
      const hdW = ctx.measureText(hdText).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.roundRect(WIDTH - hdW - 8, thumbY + thumbH - 28, hdW, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(hdText, WIDTH - hdW, thumbY + thumbH - 14);
    }
    if (opts.duration) {
      this.drawDurationBadge(
        ctx,
        opts.duration,
        WIDTH - 12,
        thumbY + thumbH - 28,
        'rgba(0,0,0,0.7)',
      );
    }

    const infoY = thumbY + thumbH + 16;
    if (opts.views) {
      ctx.font = '13px sans-serif';
      ctx.fillStyle = secondary;
      ctx.fillText(`${opts.views} views`, 16, infoY);
    }

    ctx.fillStyle = '#DCE0E8';
    ctx.fillRect(0, infoY + 16, WIDTH, 1);

    const statsY = infoY + 36;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = secondary;
    let currentX = 16;
    if (opts.likes) {
      ctx.fillText(`👍 ${opts.likes}`, currentX, statsY);
      currentX += ctx.measureText(`👍 ${opts.likes}`).width + 24;
    }
    if (opts.comments) {
      ctx.fillText(`💬 ${opts.comments}`, currentX, statsY);
      currentX += ctx.measureText(`💬 ${opts.comments}`).width + 24;
    }
    if (opts.shares) {
      ctx.fillText(`↗ ${opts.shares}`, currentX, statsY);
    }

    ctx.fillStyle = '#DCE0E8';
    ctx.fillRect(0, statsY + 16, WIDTH, 1);

    const actionsY = statsY + 40;
    const actionW = WIDTH / 3;
    ctx.font = '14px sans-serif';
    ctx.fillStyle = secondary;
    ctx.fillText('👍 Like', WIDTH / 2 - actionW * 1.5 + 20, actionsY);
    ctx.fillText('💬 Comment', WIDTH / 2 - 20, actionsY);
    ctx.fillText('↗ Share', WIDTH / 2 + actionW / 2 + 20, actionsY);

    ctx.strokeStyle = '#DCE0E8';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 20, actionsY - 10);
    ctx.lineTo(WIDTH / 2 - 20, actionsY + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 + actionW / 2 + 20, actionsY - 10);
    ctx.lineTo(WIDTH / 2 + actionW / 2 + 20, actionsY + 4);
    ctx.stroke();

    const LOGO_SIZE = 48;
    await this.drawPlatformAndVaniaLogos(
      ctx,
      'facebook',
      WIDTH - 12,
      HEIGHT - 8 - LOGO_SIZE - 8,
      LOGO_SIZE,
      vaniaLogo,
      platformLogo,
    );

    return canvas.toBuffer('image/jpeg', 92);
  }

  private static async generateTwitter(opts: MediaCardOptions): Promise<Buffer> {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    const { bg, text, secondary } = PLATFORM_COLORS.twitter;

    const [vaniaLogo, platformLogo] = await Promise.all([
      this.loadLogoAsset('logo.png'),
      this.loadLogoAsset(PLATFORM_LOGO_FILES.twitter),
    ]);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const thumbH = 260;
    const thumb = await this.loadThumbnail(opts.thumbnail);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, WIDTH, thumbH);
    if (thumb) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, thumbH);
      ctx.clip();
      this.drawImageCover(ctx, thumb, 0, 0, WIDTH, thumbH);
      ctx.restore();
      const grad = ctx.createLinearGradient(0, thumbH - 60, 0, thumbH);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, thumbH - 60, WIDTH, 60);
    }

    if (opts.duration) this.drawDurationBadge(ctx, opts.duration, WIDTH - 12, thumbH - 24);

    if (opts.author) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = text;
      ctx.fillText(`@${opts.author}`, 16, thumbH + 24);
    }

    const titleY = thumbH + 52;
    if (opts.title) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = text;
      const titleLines = this.wrapText(opts.title, WIDTH - 32, 50);
      titleLines.forEach((line, i) => ctx.fillText(line, 16, titleY + i * 22));
    }

    const statsY = HEIGHT - 44;
    ctx.fillStyle = '#222222';
    ctx.fillRect(16, statsY, WIDTH - 32, 1);

    let currentX = 16;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = secondary;
    if (opts.shares) {
      ctx.fillText('↺', currentX, statsY + 20);
      currentX += 16;
      ctx.fillText(opts.shares, currentX, statsY + 20);
      currentX += ctx.measureText(opts.shares).width + 28;
    }
    ctx.fillStyle = '#F91880';
    ctx.fillText('♥', currentX, statsY + 20);
    currentX += 16;
    ctx.fillStyle = secondary;
    ctx.fillText(opts.likes || '0', currentX, statsY + 20);
    currentX += ctx.measureText(opts.likes || '0').width + 28;
    ctx.fillStyle = '#AAB8C2';
    ctx.fillText('👁', currentX, statsY + 20);
    currentX += 18;
    ctx.fillStyle = secondary;
    ctx.fillText(opts.views || '0', currentX, statsY + 20);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#536471';
    const domain = 'x.com';
    ctx.fillText(domain, WIDTH - ctx.measureText(domain).width - 56, statsY + 20);

    const LOGO_SIZE = 48;
    await this.drawPlatformAndVaniaLogos(
      ctx,
      'twitter',
      WIDTH - 12,
      HEIGHT - 8 - LOGO_SIZE - 8,
      LOGO_SIZE,
      vaniaLogo,
      platformLogo,
    );

    return canvas.toBuffer('image/jpeg', 92);
  }
}
