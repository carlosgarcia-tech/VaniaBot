/**
 * ProfileCardService.ts
 *
 * VaniaBot services module exposing `ProfileCardService`, `ProfileCardOptions`.
 *
 * @author **Carlos G**
 */

import type { Canvas, CanvasRenderingContext2D } from 'canvas';
import { createCanvas, loadImage } from 'canvas';

export interface ProfileCardOptions {
  avatarUrl: string;
  backgroundUrl?: string;
  username: string;
  discriminator: string | number;
  money: number;
  xp: number;
  level: number;
  levelProgress?: number;
  accentColor?: string;
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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
}

async function safeLoadImage(src: string) {
  try {
    if (src.startsWith('data:')) {
      const base64Data = src.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      return await loadImage(buffer);
    }
    return await loadImage(src);
  } catch {
    return null;
  }
}

export class ProfileCardService {
  static async generate(opts: ProfileCardOptions): Promise<Buffer> {
    const W = 750;
    const H = 300;
    const accent = opts.accentColor ?? '#FFD700';

    const canvas: Canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bgImg = opts.backgroundUrl ? await safeLoadImage(opts.backgroundUrl) : null;

    if (bgImg) {
      const scale = Math.max(W / bgImg.width, H / bgImg.height);
      const sw = bgImg.width * scale;
      const sh = bgImg.height * scale;
      ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);

      ctx.fillStyle = 'rgba(10,10,15,0.72)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#111118');
      grad.addColorStop(1, '#1e1e2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    roundRect(ctx, 1, 1, W - 2, H - 2, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const avatarSize = 110;
    const avatarX = 48;
    const avatarY = H / 2 - avatarSize / 2;

    const avatarImg = await safeLoadImage(opts.avatarUrl);

    ctx.save();
    ctx.shadowColor = accent + '66';
    ctx.shadowBlur = 24;

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();

    if (avatarImg) {
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      ctx.fillStyle = '#555';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        opts.username.charAt(0).toUpperCase(),
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2 + 13,
      );
    }
    ctx.restore();

    const textX = avatarX + avatarSize + 28;
    const nameY = 90;

    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(opts.username, textX, nameY);

    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(`#${opts.discriminator}`, textX, nameY + 22);

    const divY = nameY + 38;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(textX, divY);
    ctx.lineTo(W - 40, divY);
    ctx.stroke();

    const statsY = divY + 30;
    const stats = [
      { label: 'Dinero', value: formatK(opts.money) },
      { label: 'Nivel', value: formatNum(opts.level) },
      { label: 'XP', value: formatNum(opts.xp) },
    ];

    const statWidth = (W - textX - 40) / stats.length;

    stats.forEach((stat, i) => {
      const sx = textX + i * statWidth + statWidth / 2;

      ctx.font = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(stat.label, sx, statsY);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(stat.value, sx, statsY + 28);

      if (i < stats.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(textX + (i + 1) * statWidth, statsY - 6);
        ctx.lineTo(textX + (i + 1) * statWidth, statsY + 34);
        ctx.stroke();
      }
    });

    const barY = statsY + 58;
    const barX = textX;
    const barW = W - textX - 40;
    const barH = 7;
    const progress = Math.min(Math.max(opts.levelProgress ?? 0, 0), 100) / 100;

    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    if (progress > 0) {
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      barGrad.addColorStop(0, accent + 'aa');
      barGrad.addColorStop(1, accent);
      roundRect(ctx, barX, barY, barW * progress, barH, barH / 2);
      ctx.fillStyle = barGrad;
      ctx.fill();
    }

    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(progress * 100)}%`, barX + barW, barY - 4);

    return canvas.toBuffer('image/png');
  }
}
