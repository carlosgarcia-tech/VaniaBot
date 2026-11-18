/**
 * scripts/make-watermark.ts
 *
 * Generates ./data/assets/watermark.png (white text with a thin dark outline
 * on a transparent background). Run once:
 *
 *   npx tsx scripts/make-watermark.ts
 *
 * Change TEXT to whatever you want the mark to say.
 */

import { mkdirSync } from 'fs';
import sharp from 'sharp';

const TEXT = 'OrbitBot';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="48">
  <text x="110" y="33" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="26" font-weight="bold" fill="white"
        stroke="black" stroke-width="1.5" paint-order="stroke">${TEXT}</text>
</svg>`;

mkdirSync('./data/assets', { recursive: true });
await sharp(Buffer.from(svg)).png().toFile('./data/assets/watermark.png');
console.log('✅ data/assets/watermark.png generado');
