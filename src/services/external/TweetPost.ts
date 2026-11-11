/**
 * TweetPost.ts
 *
 * Local Twitter/X post card generator. Renders the tweet sticker with
 * @napi-rs/canvas — no external API calls.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

export interface PostOptions {
  avatar: string | Buffer;
  nickname: string;
  content: string;

  username?: string;
  timestamp?: string;

  replies?: number;
  reposts?: number;
  likes?: number;
  views?: number;

  output?: string;
  width?: number;
}

const COLORS = {
  background: '#000000',
  primary: '#E7E9EA',
  secondary: '#71767B',
  border: '#2F3336',
};

const FONT = 'Arial, sans-serif';

function drawAvatar(ctx: SKRSContext2D, image: Awaited<ReturnType<typeof loadImage>>): void {
  const x = 29;
  const y = 5;
  const size = 58;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  ctx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);

  ctx.restore();
}

function drawReply(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 11, y);
  ctx.bezierCurveTo(x - 11, y - 13, x + 11, y - 13, x + 11, y);
  ctx.bezierCurveTo(x + 11, y + 7, x + 5, y + 10, x, y + 10);
  ctx.lineTo(x - 6, y + 16);
  ctx.lineTo(x - 6, y + 10);
  ctx.bezierCurveTo(x - 9, y + 8, x - 11, y + 5, x - 11, y);
  ctx.stroke();
}

function drawRepost(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();

  ctx.moveTo(x - 7, y - 6);
  ctx.lineTo(x + 8, y - 6);
  ctx.lineTo(x + 4, y - 10);
  ctx.moveTo(x + 8, y - 6);
  ctx.lineTo(x + 4, y - 2);

  ctx.moveTo(x + 7, y + 6);
  ctx.lineTo(x - 8, y + 6);
  ctx.lineTo(x - 4, y + 2);
  ctx.moveTo(x - 8, y + 6);
  ctx.lineTo(x - 4, y + 10);

  ctx.stroke();
}

function drawLike(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 13);
  ctx.bezierCurveTo(x - 5, y + 9, x - 13, y + 3, x - 13, y - 4);
  ctx.bezierCurveTo(x - 13, y - 14, x - 1, y - 15, x, y - 6);
  ctx.bezierCurveTo(x + 1, y - 15, x + 13, y - 14, x + 13, y - 4);
  ctx.bezierCurveTo(x + 13, y + 3, x + 5, y + 9, x, y + 13);
  ctx.stroke();
}

function drawViews(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();

  ctx.moveTo(x - 10, y + 10);
  ctx.lineTo(x - 10, y - 1);

  ctx.moveTo(x, y + 10);
  ctx.lineTo(x, y - 8);

  ctx.moveTo(x + 10, y + 10);
  ctx.lineTo(x + 10, y - 15);

  ctx.stroke();
}

function drawBookmark(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 12);
  ctx.lineTo(x + 8, y - 12);
  ctx.lineTo(x + 8, y + 13);
  ctx.lineTo(x, y + 7);
  ctx.lineTo(x - 8, y + 13);
  ctx.closePath();
  ctx.stroke();
}

function drawShare(ctx: SKRSContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 8);
  ctx.lineTo(x, y - 13);
  ctx.moveTo(x - 7, y - 6);
  ctx.lineTo(x, y - 13);
  ctx.lineTo(x + 7, y - 6);

  ctx.moveTo(x - 10, y + 3);
  ctx.lineTo(x - 10, y + 13);
  ctx.lineTo(x + 10, y + 13);
  ctx.lineTo(x + 10, y + 3);

  ctx.stroke();
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    let currentLine = '';

    for (const word of paragraph.split(/\s+/)) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let result = text;

  while (result.length > 0 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}…`;
}

function drawInteractions(
  ctx: SKRSContext2D,
  width: number,
  footerY: number,
  options: PostOptions,
): void {
  const actions = [
    { x: 115, type: 'reply' },
    { x: 282, type: 'repost', count: options.reposts },
    { x: 466, type: 'like', count: options.likes },
    { x: 644, type: 'views', count: options.views },
    { x: width - 89, type: 'bookmark' },
    { x: width - 43, type: 'share' },
  ] as const;

  ctx.save();

  ctx.strokeStyle = COLORS.secondary;
  ctx.fillStyle = COLORS.secondary;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const action of actions) {
    const x = action.x;
    const y = footerY;

    switch (action.type) {
      case 'reply':
        drawReply(ctx, x, y);
        break;
      case 'repost':
        drawRepost(ctx, x, y);
        break;
      case 'like':
        drawLike(ctx, x, y);
        break;
      case 'views':
        drawViews(ctx, x, y);
        break;
      case 'bookmark':
        drawBookmark(ctx, x, y);
        break;
      case 'share':
        drawShare(ctx, x, y);
        break;
    }

    if ('count' in action && action.count !== undefined) {
      ctx.font = `19px ${FONT}`;
      ctx.fillText(String(action.count), x + 12, y + 7);
    }
  }

  ctx.restore();
}

export async function generatePost(options: PostOptions): Promise<Buffer> {
  const {
    avatar,
    nickname,
    content,
    username = '@username',
    timestamp = '14h',
    width = 907,
    output,
  } = options;

  if (!avatar || !nickname || !content) {
    throw new Error('avatar, nickname and content are required');
  }

  if (width < 500) {
    throw new Error('Width must be at least 500px');
  }

  const profileImage = await loadImage(avatar);

  // Initial canvas for text measurement.
  const measureCanvas = createCanvas(width, 100);
  const measureCtx = measureCanvas.getContext('2d');

  measureCtx.font = `23px ${FONT}`;

  const contentX = 100;
  const contentY = 58;
  const contentMaxWidth = width - contentX - 35;

  const lines = wrapText(measureCtx, content, contentMaxWidth);

  const lineHeight = 30;

  // Calculate dynamic image height.
  const footerY = Math.max(130, contentY + lines.length * lineHeight + 25);

  const height = footerY + 35;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background.
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Avatar.
  drawAvatar(ctx, profileImage);

  // Header.
  const headerX = 100;
  const headerY = 27;

  ctx.textBaseline = 'alphabetic';

  ctx.font = `bold 23px ${FONT}`;
  ctx.fillStyle = COLORS.primary;

  const nicknameText = truncateText(ctx, nickname, width - headerX - 180);

  ctx.fillText(nicknameText, headerX, headerY);

  const nicknameWidth = ctx.measureText(nicknameText).width;

  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = COLORS.secondary;

  const metadata = ` ${username} · ${timestamp}`;
  const metadataX = headerX + nicknameWidth + 4;
  const metadataMaxWidth = Math.max(0, width - metadataX - 20);

  ctx.fillText(truncateText(ctx, metadata, metadataMaxWidth), metadataX, headerY);

  // Post content.
  ctx.font = `23px ${FONT}`;
  ctx.fillStyle = COLORS.primary;
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, index) => {
    ctx.fillText(line, contentX, contentY + index * lineHeight);
  });

  // Interaction icons and counters.
  drawInteractions(ctx, width, footerY, options);

  // Bottom border.
  ctx.beginPath();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.moveTo(4, height - 1);
  ctx.lineTo(width - 4, height - 1);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');

  if (output) {
    await writeFile(output, buffer);
  }

  return buffer;
}
