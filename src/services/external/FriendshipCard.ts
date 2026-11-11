/**
 * FriendshipCard.ts
 *
 * Local space-themed friendship/ship card generator. Renders the sticker with
 * @napi-rs/canvas — no external API calls.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

export interface FriendshipOptions {
  leftImage: string | Buffer;
  rightImage: string | Buffer;
  text: string;

  title?: string;
  number?: string | number;

  output?: string;
  width?: number;
  height?: number;
}

type ImageType = Awaited<ReturnType<typeof loadImage>>;

const COLORS = {
  background: '#05030D',
  white: '#FFFFFF',
  pink: '#FF80D5',
  purple: '#A855F7',
  blue: '#659AFF',
  silver: '#D9DCEB',
  darkSilver: '#46435E',
};

function seededRandom(seed: number): () => number {
  let value = seed;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

// --------------------------------------------------
// BACKGROUND
// --------------------------------------------------

function drawNebula(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

  gradient.addColorStop(0, color);
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(0.65, color.replace(/[\d.]+\)$/, '0.12)'));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);

  ctx.restore();
}

function drawSpace(ctx: SKRSContext2D, width: number, height: number): void {
  const background = ctx.createLinearGradient(0, 0, width, height);

  background.addColorStop(0, '#080519');
  background.addColorStop(0.5, '#100A27');
  background.addColorStop(1, '#03030B');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Nebula clouds.
  drawNebula(ctx, width * 0.2, height * 0.48, width * 0.42, height * 0.22, 'rgba(255,55,190,0.75)');

  drawNebula(ctx, width * 0.5, height * 0.48, width * 0.45, height * 0.25, 'rgba(155,65,255,0.65)');

  drawNebula(ctx, width * 0.85, height * 0.48, width * 0.4, height * 0.23, 'rgba(55,115,255,0.65)');

  drawNebula(ctx, width * 0.5, height * 0.7, width * 0.48, height * 0.18, 'rgba(200,55,220,0.4)');

  // Stars.
  const random = seededRandom(54321);

  for (let i = 0; i < 1500; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = random() * 1.4 + 0.25;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    ctx.fillStyle = `rgba(255,255,255,${random() * 0.8 + 0.2})`;
    ctx.fill();

    if (i % 70 === 0) {
      ctx.save();
      ctx.shadowColor = '#D6A5FF';
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.restore();
    }
  }

  // Colorful light particles.
  const starColors = ['#FF9AE8', '#BDA0FF', '#8DCBFF', '#FFFFFF'];

  for (let i = 0; i < 45; i++) {
    const x = random() * width;
    const y = random() * height;

    ctx.save();
    ctx.shadowColor = starColors[i % starColors.length];
    ctx.shadowBlur = 15;

    ctx.fillStyle = starColors[i % starColors.length];
    ctx.beginPath();
    ctx.arc(x, y, random() * 2 + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// --------------------------------------------------
// COSMIC ENERGY RIBBONS
// --------------------------------------------------

function drawEnergyRibbons(ctx: SKRSContext2D, width: number, height: number): void {
  const ribbons = [
    {
      color: 'rgba(255,110,220,0.75)',
      offset: -50,
    },
    {
      color: 'rgba(160,100,255,0.55)',
      offset: 0,
    },
    {
      color: 'rgba(100,160,255,0.5)',
      offset: 50,
    },
  ];

  for (const ribbon of ribbons) {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(-50, height * 0.62 + ribbon.offset);

    ctx.bezierCurveTo(
      width * 0.15,
      height * 0.25 + ribbon.offset,
      width * 0.3,
      height * 0.85 + ribbon.offset,
      width * 0.5,
      height * 0.46 + ribbon.offset,
    );

    ctx.bezierCurveTo(
      width * 0.72,
      height * 0.1 + ribbon.offset,
      width * 0.85,
      height * 0.8 + ribbon.offset,
      width + 50,
      height * 0.3 + ribbon.offset,
    );

    ctx.strokeStyle = ribbon.color;
    ctx.lineWidth = 2;

    ctx.shadowColor = ribbon.color;
    ctx.shadowBlur = 18;

    ctx.stroke();
    ctx.restore();
  }
}

// --------------------------------------------------
// CIRCULAR PORTRAIT FRAME
// --------------------------------------------------

function drawPortrait(
  ctx: SKRSContext2D,
  image: ImageType,
  cx: number,
  cy: number,
  radius: number,
): void {
  // External atmospheric glow.
  ctx.save();

  ctx.shadowColor = COLORS.pink;
  ctx.shadowBlur = 32;

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);

  ctx.strokeStyle = 'rgba(255,120,220,0.7)';
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.restore();

  // Metallic frame.
  const frameGradient = ctx.createLinearGradient(
    cx - radius,
    cy - radius,
    cx + radius,
    cy + radius,
  );

  frameGradient.addColorStop(0, '#FFFFFF');
  frameGradient.addColorStop(0.2, '#777B9E');
  frameGradient.addColorStop(0.45, '#E8D9FF');
  frameGradient.addColorStop(0.7, '#55516F');
  frameGradient.addColorStop(1, '#D8C8F5');

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);

  ctx.strokeStyle = frameGradient;
  ctx.lineWidth = 13;
  ctx.stroke();

  // Dark metallic inner border.
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 9, 0, Math.PI * 2);

  ctx.strokeStyle = '#29253D';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Profile image, cropped to a circle.
  const imageRadius = radius - 18;
  const sourceSize = Math.min(image.width, image.height);

  const sx = (image.width - sourceSize) / 2;
  const sy = (image.height - sourceSize) / 2;

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, imageRadius, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(
    image,
    sx,
    sy,
    sourceSize,
    sourceSize,
    cx - imageRadius,
    cy - imageRadius,
    imageRadius * 2,
    imageRadius * 2,
  );

  ctx.restore();

  // Outer metallic highlight.
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Decorative bolts.
  const boltCount = 12;

  for (let i = 0; i < boltCount; i++) {
    const angle = (i / boltCount) * Math.PI * 2;
    const boltX = cx + Math.cos(angle) * (radius - 2);
    const boltY = cy + Math.sin(angle) * (radius - 2);

    ctx.save();

    ctx.beginPath();
    ctx.arc(boltX, boltY, 4, 0, Math.PI * 2);

    ctx.fillStyle = '#AAA9C7';
    ctx.fill();

    ctx.strokeStyle = '#F7EFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(boltX - 1.5, boltY);
    ctx.lineTo(boltX + 1.5, boltY);

    ctx.strokeStyle = '#55516F';
    ctx.stroke();

    ctx.restore();
  }

  // Small highlights on the ring.
  ctx.save();

  ctx.shadowColor = '#FFB6F2';
  ctx.shadowBlur = 16;

  ctx.fillStyle = '#FFFFFF';

  for (const angle of [Math.PI * 1.5, Math.PI * 0.5]) {
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// --------------------------------------------------
// CENTRAL HEART
// --------------------------------------------------

function drawHeart(ctx: SKRSContext2D, cx: number, cy: number, size: number): void {
  ctx.save();

  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);

  // Heart outline.
  ctx.beginPath();

  ctx.moveTo(0, 40);

  ctx.bezierCurveTo(-100, -20, -50, -80, 0, -30);

  ctx.bezierCurveTo(50, -80, 100, -20, 0, 40);

  ctx.closePath();

  const gradient = ctx.createLinearGradient(-50, -50, 50, 50);

  gradient.addColorStop(0, '#FFB5EE');
  gradient.addColorStop(0.5, '#D17AFF');
  gradient.addColorStop(1, '#FF5EC8');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;

  ctx.shadowColor = COLORS.pink;
  ctx.shadowBlur = 28;

  ctx.stroke();

  // Inner heart glow.
  ctx.fillStyle = 'rgba(255,100,220,0.12)';
  ctx.fill();

  // Tiny light core.
  ctx.beginPath();
  ctx.arc(0, -15, 5, 0, Math.PI * 2);

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#FFFFFF';
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.restore();
}

// --------------------------------------------------
// NUMBER DECORATION
// --------------------------------------------------

function drawCelestialOrnament(ctx: SKRSContext2D, cx: number, cy: number, size: number): void {
  ctx.save();

  ctx.translate(cx, cy);

  const gradient = ctx.createLinearGradient(-size, -size, size, size);

  gradient.addColorStop(0, '#FFFFFF');
  gradient.addColorStop(0.5, '#D8B5FF');
  gradient.addColorStop(1, '#FF9BE9');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;

  // Vertical diamond.
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.35, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.35, 0);
  ctx.closePath();
  ctx.stroke();

  // Small decorative extensions.
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, direction * size * 0.65);
    ctx.lineTo(direction * size * 0.65, direction * size);
    ctx.stroke();
  }

  ctx.restore();
}

// --------------------------------------------------
// TEXT
// --------------------------------------------------

function drawCenteredText(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  maxWidth: number,
  color = COLORS.white,
  glow = 12,
): void {
  ctx.save();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = color;
  ctx.shadowColor = COLORS.pink;
  ctx.shadowBlur = glow;

  ctx.fillText(text, x, y, maxWidth);

  ctx.restore();
}

// --------------------------------------------------
// MAIN GENERATOR
// --------------------------------------------------

export async function generateFriendship(options: FriendshipOptions): Promise<Buffer> {
  const {
    leftImage,
    rightImage,
    text,
    title = 'Friends',
    number = '53',
    output,
    width = 1024,
    height = 1024,
  } = options;

  if (!leftImage || !rightImage || !text?.trim()) {
    throw new Error('leftImage, rightImage and text are required.');
  }

  if (width < 600 || height < 600) {
    throw new Error('Canvas dimensions must be at least 600px.');
  }

  const [left, right] = await Promise.all([loadImage(leftImage), loadImage(rightImage)]);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const centerX = width / 2;
  const portraitY = height * 0.44;

  const portraitRadius = width * 0.185;
  const distance = width * 0.255;

  const leftX = centerX - distance;
  const rightX = centerX + distance;

  // 1. Cosmic background.
  drawSpace(ctx, width, height);

  // 2. Flowing energy ribbons.
  drawEnergyRibbons(ctx, width, height);

  // 3. Left portrait.
  drawPortrait(ctx, left, leftX, portraitY, portraitRadius);

  // 4. Right portrait.
  drawPortrait(ctx, right, rightX, portraitY, portraitRadius);

  // 5. Central heart.
  drawHeart(ctx, centerX, portraitY, width * 0.105);

  // 6. Header.
  drawCenteredText(
    ctx,
    title,
    centerX,
    height * 0.135,
    `bold ${Math.round(width * 0.085)}px Georgia`,
    width * 0.9,
    '#FFF5FF',
    20,
  );

  // 7. Celestial ornament behind number.
  const numberY = height * 0.68;

  drawCelestialOrnament(ctx, centerX, numberY, width * 0.07);

  // 8. Main number.
  drawCenteredText(
    ctx,
    String(number),
    centerX,
    numberY,
    `bold ${Math.round(width * 0.125)}px Georgia`,
    width * 0.65,
    '#FFF5FF',
    24,
  );

  // 9. Footer text.
  drawCenteredText(
    ctx,
    text.trim(),
    centerX,
    height * 0.845,
    `${Math.round(width * 0.052)}px Georgia`,
    width * 0.85,
    '#F3A4CF',
    10,
  );

  const buffer = canvas.toBuffer('image/png');

  if (output) {
    await writeFile(output, buffer);
  }

  return buffer;
}
