/**
 * WelcomeCard.ts
 *
 * Local welcome card: draws the user's photo and name over the pre-made
 * space template asset. Rendered with @napi-rs/canvas — no external APIs.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface WelcomeTemplateOptions {
  image: string | Buffer;
  username: string;
  output?: string;
}

// Plantilla original: no se modifica ni se reconstruye.
const TEMPLATE_PATH = resolve(process.cwd(), 'data/assets/plantillaWelcomeCard.jpeg');

const CONFIG = {
  width: 1024,
  height: 1024,

  profile: {
    x: 512,
    y: 420,
    radius: 185,
  },

  username: {
    x: 512,
    y: 715,
    maxWidth: 760,
    fontSize: 46,
    minFontSize: 24,
    color: '#FFFFFF',
  },
};

// Recorta la fotografía manteniendo su proporción.
function drawCircularImage(
  ctx: SKRSContext2D,
  image: Awaited<ReturnType<typeof loadImage>>,
  x: number,
  y: number,
  radius: number,
): void {
  const diameter = radius * 2;

  const scale = Math.max(diameter / image.width, diameter / image.height);

  const scaledWidth = image.width * scale;
  const scaledHeight = image.height * scale;

  ctx.save();

  // Máscara circular.
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Fondo de seguridad.
  ctx.fillStyle = '#050817';
  ctx.fillRect(x - radius, y - radius, diameter, diameter);

  // Centrado automático de la fotografía.
  ctx.drawImage(image, x - scaledWidth / 2, y - scaledHeight / 2, scaledWidth, scaledHeight);

  ctx.restore();
}

// Ajusta el tamaño del nombre si es demasiado largo.
function drawUsername(ctx: SKRSContext2D, username: string): void {
  const config = CONFIG.username;

  let fontSize = config.fontSize;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  while (fontSize > config.minFontSize) {
    ctx.font = `${fontSize}px Arial`;

    if (ctx.measureText(username).width <= config.maxWidth) {
      break;
    }

    fontSize -= 2;
  }

  ctx.save();

  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Iluminación sutil para mantener la estética espacial.
  ctx.shadowColor = '#79BFFF';
  ctx.shadowBlur = 16;

  ctx.fillStyle = config.color;

  ctx.fillText(username, config.x, config.y, config.maxWidth);

  ctx.restore();
}

// Generador principal.
export async function generateWelcomeTemplate(options: WelcomeTemplateOptions): Promise<Buffer> {
  const { image, username, output } = options;

  if (!image) {
    throw new Error('La fotografía del usuario es obligatoria.');
  }

  if (!username?.trim()) {
    throw new Error('El nombre del usuario es obligatorio.');
  }

  // Cargar plantilla y fotografía.
  const [template, profile] = await Promise.all([loadImage(TEMPLATE_PATH), loadImage(image)]);

  const canvas = createCanvas(CONFIG.width, CONFIG.height);

  const ctx = canvas.getContext('2d');

  // 1. Dibujar plantilla original sin modificaciones.
  ctx.drawImage(template, 0, 0, CONFIG.width, CONFIG.height);

  // 2. Insertar fotografía dentro del círculo.
  drawCircularImage(ctx, profile, CONFIG.profile.x, CONFIG.profile.y, CONFIG.profile.radius);

  // 3. Colocar nombre debajo de la fotografía.
  drawUsername(ctx, username.trim());

  // 4. Exportar PNG.
  const buffer = canvas.toBuffer('image/png');

  if (output) {
    await writeFile(output, buffer);
  }

  return buffer;
}
