/**
 * WelcomeCard.ts
 *
 * Local space-themed welcome card generator. Renders the welcome sticker with
 * @napi-rs/canvas — no external API calls.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

export interface WelcomeOptions {
  image: string | Buffer;
  username: string;

  /** Person who invited the newcomer (defaults to the username). */
  inviter?: string;
  /** Bot signature at the bottom (defaults to "OrbitBot"). */
  bot?: string;

  output?: string;
  width?: number;
  height?: number;
}

const COLORS = {
  background: '#03030A',
  white: '#FFFFFF',
  pink: '#FF55D8',
  purple: '#A855F7',
  blue: '#448BFF',
};

type ImageType = Awaited<ReturnType<typeof loadImage>>;

function random(seed: number): () => number {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// Draws soft elliptical nebula clouds.
function drawNebula(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string,
  opacity: number,
): void {
  ctx.save();

  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

  gradient.addColorStop(0, color.replace('OPACITY', String(opacity)));
  gradient.addColorStop(0.35, color.replace('OPACITY', String(opacity * 0.65)));
  gradient.addColorStop(0.7, color.replace('OPACITY', String(opacity * 0.18)));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);

  ctx.restore();
}

// Space background with stars and colorful nebulae.
function drawUniverse(ctx: SKRSContext2D, width: number, height: number): void {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  const bandY = height * 0.46;

  // Large horizontal nebula clouds.
  drawNebula(ctx, width * 0.13, bandY, width * 0.4, height * 0.2, 'rgba(255,65,190,OPACITY)', 0.85);

  drawNebula(
    ctx,
    width * 0.38,
    bandY * 0.98,
    width * 0.35,
    height * 0.22,
    'rgba(160,55,255,OPACITY)',
    0.85,
  );

  drawNebula(ctx, width * 0.82, bandY, width * 0.36, height * 0.2, 'rgba(45,115,255,OPACITY)', 0.8);

  drawNebula(
    ctx,
    width * 0.53,
    bandY * 1.18,
    width * 0.4,
    height * 0.16,
    'rgba(255,65,180,OPACITY)',
    0.45,
  );

  // Smaller nebula details.
  drawNebula(
    ctx,
    width * 0.08,
    bandY * 1.12,
    width * 0.2,
    height * 0.1,
    'rgba(80,140,255,OPACITY)',
    0.55,
  );

  drawNebula(
    ctx,
    width * 0.92,
    bandY * 0.85,
    width * 0.18,
    height * 0.12,
    'rgba(80,220,255,OPACITY)',
    0.55,
  );

  // Dense starfield.
  const rng = random(20261110);

  for (let i = 0; i < 1100; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = rng() * 1.4 + 0.25;
    const alpha = rng() * 0.8 + 0.2;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();

    if (i % 55 === 0) {
      ctx.save();
      ctx.shadowColor = '#A9BFFF';
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore();
    }
  }

  // A few colorful stars.
  const starColors = ['#FF91E8', '#A78BFA', '#7DD3FC', '#FFFFFF'];

  for (let i = 0; i < 35; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = rng() * 2 + 1;

    ctx.save();
    ctx.shadowColor = starColors[i % starColors.length];
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = starColors[i % starColors.length];
    ctx.fill();

    ctx.restore();
  }
}

// Crescent moon in the upper-right corner.
function drawMoon(ctx: SKRSContext2D, width: number, height: number): void {
  const x = width * 0.82;
  const y = height * 0.295;
  const radius = width * 0.025;

  ctx.save();

  ctx.shadowColor = '#D8D4FF';
  ctx.shadowBlur = 22;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  ctx.fillStyle = '#E8E5FF';
  ctx.fill();

  ctx.shadowBlur = 0;

  // Dark circle creates the crescent shape.
  ctx.beginPath();
  ctx.arc(x + radius * 0.55, y - radius * 0.55, radius, 0, Math.PI * 2);

  ctx.fillStyle = COLORS.background;
  ctx.fill();

  ctx.restore();
}

// Crop and draw the user's image inside a circular mask.
function drawProfileImage(
  ctx: SKRSContext2D,
  image: ImageType,
  cx: number,
  cy: number,
  radius: number,
): void {
  const size = radius * 2;

  const sourceSize = Math.min(image.width, image.height);
  const sx = (image.width - sourceSize) / 2;
  const sy = (image.height - sourceSize) / 2;

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(image, sx, sy, sourceSize, sourceSize, cx - radius, cy - radius, size, size);

  ctx.restore();
}

// Glowing energy ring surrounding the profile.
function drawEnergyRing(ctx: SKRSContext2D, cx: number, cy: number, radius: number): void {
  // Outer glow.
  ctx.save();

  ctx.shadowColor = COLORS.pink;
  ctx.shadowBlur = 45;

  const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);

  gradient.addColorStop(0, '#FFB2F0');
  gradient.addColorStop(0.25, COLORS.pink);
  gradient.addColorStop(0.55, COLORS.purple);
  gradient.addColorStop(0.8, '#65B9FF');
  gradient.addColorStop(1, COLORS.pink);

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 9;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Inner bright edge.
  ctx.save();

  ctx.shadowColor = '#B98AFF';
  ctx.shadowBlur = 22;

  ctx.strokeStyle = 'rgba(255,210,255,0.85)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Secondary energy details.
  ctx.save();

  ctx.strokeStyle = 'rgba(255,150,245,0.65)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Energy particles around the ring.
  const rng = random(91234);

  for (let i = 0; i < 180; i++) {
    const angle = rng() * Math.PI * 2;
    const distance = radius + (rng() - 0.5) * 27;

    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;

    const particleRadius = rng() * 2.2 + 0.4;

    ctx.save();

    ctx.shadowColor = i % 2 === 0 ? COLORS.pink : COLORS.blue;
    ctx.shadowBlur = 12;

    ctx.fillStyle = i % 2 === 0 ? '#FFB5F1' : '#9DCBFF';

    ctx.beginPath();
    ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  size: number,
  color = COLORS.white,
): void {
  ctx.save();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = '#B68BFF';
  ctx.shadowBlur = 13;

  ctx.fillStyle = color;
  ctx.fillText(text, x, y, size);

  ctx.restore();
}

export async function generateWelcome(options: WelcomeOptions): Promise<Buffer> {
  const { image, username, inviter, bot, output, width = 1024, height = 1024 } = options;

  if (!image || !username?.trim()) {
    throw new Error('Image and username are required.');
  }

  if (width < 600 || height < 600) {
    throw new Error('Canvas dimensions must be at least 600px.');
  }

  const profile = await loadImage(image);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const centerX = width / 2;
  const centerY = height * 0.46;

  const profileRadius = width * 0.175;
  const ringRadius = width * 0.205;

  // 1. Universe background.
  drawUniverse(ctx, width, height);

  // 2. Crescent moon.
  drawMoon(ctx, width, height);

  // 3. Circular profile image.
  drawProfileImage(ctx, profile, centerX, centerY, profileRadius);

  // 4. Energy ring around the image.
  drawEnergyRing(ctx, centerX, centerY, ringRadius);

  // 5. Header.
  drawText(
    ctx,
    'WELCOME',
    centerX,
    height * 0.16,
    `bold ${Math.round(width * 0.105)}px Georgia`,
    width * 0.8,
  );

  // 6. Username.
  drawText(
    ctx,
    username.trim(),
    centerX,
    height * 0.75,
    `bold ${Math.round(width * 0.075)}px Georgia`,
    width * 0.85,
  );

  // 7. Invitation.
  drawText(
    ctx,
    `invitado por ${(inviter ?? username).trim()}`,
    centerX,
    height * 0.85,
    `${Math.round(width * 0.042)}px Georgia`,
    width * 0.9,
  );

  // 8. Bot signature.
  drawText(
    ctx,
    bot ?? 'OrbitBot',
    centerX,
    height * 0.92,
    `${Math.round(width * 0.042)}px Georgia`,
    width * 0.7,
  );

  const buffer = canvas.toBuffer('image/png');

  if (output) {
    await writeFile(output, buffer);
  }

  return buffer;
}
