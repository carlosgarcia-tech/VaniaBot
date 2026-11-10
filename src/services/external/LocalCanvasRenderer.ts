/**
 * LocalCanvasRenderer.ts
 *
 * Local replacement for Delirius `/canvas` effects. Each endpoint is rendered
 * on-machine with @napi-rs/canvas / Jimp — no external API calls. Endpoints
 * not implemented here return null and the caller keeps its previous path.
 *
 * Implemented: brat, ttp, circle, invert.
 *
 * @author **Carlos G**
 */

import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { Jimp } from 'jimp';
import { logError } from '@/utils/logger.js';

const SIZE = 512;
const FETCH_TIMEOUT_MS = 20000;

/** Canvas-based effects: params in, PNG buffer out. Returns null when unknown. */
type LocalEffect = (params: Record<string, string>) => Promise<Buffer>;

const EFFECTS: Record<string, LocalEffect> = {
  brat: renderBrat,
  ttp: renderTtp,
  circle: renderCircle,
  invert: renderInvert,
};

export async function renderLocalCanvas(
  endpoint: string,
  params?: Record<string, string>,
): Promise<Buffer | null> {
  const effect = EFFECTS[endpoint];
  if (!effect) return null;
  return effect(params ?? {});
}

/** Downloads a resource into a raw buffer. */
async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Downloads an image URL (WhatsApp CDN profile pics, etc.) into a canvas image. */
async function fetchImage(url: string): Promise<ReturnType<typeof loadImage>> {
  return loadImage(await fetchBuffer(url));
}

function baseCanvas(bg: string) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return { canvas, ctx };
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Brat album style: black bg, stretched bold lowercase white text. */
async function renderBrat(params: Record<string, string>): Promise<Buffer> {
  const text = (params.text ?? '').toLowerCase().slice(0, 120);
  const { canvas, ctx } = baseCanvas('#000000');
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Pick the biggest font size whose wrapped block fits the canvas.
  let fontSize = 72;
  let lines: string[] = [];
  while (fontSize > 20) {
    ctx.font = `bold ${fontSize}px 'Liberation Sans', sans-serif`;
    lines = wrapText(ctx, text, SIZE * 0.82);
    const lineHeight = fontSize * 1.15;
    if (lines.length * lineHeight <= SIZE * 0.86) break;
    fontSize -= 4;
  }

  ctx.save();
  // The brat look: letters slightly stretched horizontally.
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.scale(1.08, 1);
  const lineHeight = fontSize * 1.15;
  const startY = -(lines.length - 1) * lineHeight * 0.5;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, startY + i * lineHeight);
  });
  ctx.restore();

  return canvas.toBuffer('image/png');
}

/** Text on a solid color background (delirius `ttp`). */
async function renderTtp(params: Record<string, string>): Promise<Buffer> {
  const color = /^[0-9a-f]{3,8}$/i.test(params.color ?? '') ? `#${params.color}` : '#000000';
  const { canvas, ctx } = baseCanvas(color);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = (params.text ?? '').slice(0, 50);
  let fontSize = 64;
  let lines: string[] = [];
  while (fontSize > 18) {
    ctx.font = `bold ${fontSize}px 'Liberation Sans', sans-serif`;
    lines = wrapText(ctx, text, SIZE * 0.84);
    if (lines.length * fontSize * 1.25 <= SIZE * 0.8) break;
    fontSize -= 4;
  }
  const lineHeight = fontSize * 1.25;
  const startY = SIZE / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, startY + i * lineHeight);
  });

  return canvas.toBuffer('image/png');
}

/** Circular crop of an avatar URL (delirius `circle`). */
async function renderCircle(params: Record<string, string>): Promise<Buffer> {
  if (!params.url) throw new Error('circle: missing url');
  const img = await fetchImage(params.url);
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  // cover-crop the source into the circle
  const scale = Math.max(SIZE / img.width, SIZE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  return canvas.toBuffer('image/png');
}

/** Color-inverted image (delirius `invert`). */
async function renderInvert(params: Record<string, string>): Promise<Buffer> {
  if (!params.url) throw new Error('invert: missing url');
  const image = await Jimp.fromBuffer(await fetchBuffer(params.url));
  image.invert();
  return image.getBuffer('image/png');
}

/** Self-check runnable via `npx tsx src/services/external/LocalCanvasRenderer.ts`. */
if (process.argv[1]?.endsWith('LocalCanvasRenderer.ts')) {
  (async () => {
    const brat = await renderBrat({ text: 'OrbitBot migrado a local' });
    console.info('brat:', brat.length, 'bytes PNG', brat.subarray(1, 4).toString());
    const ttp = await renderTtp({ text: 'Hola mundo', color: 'ff0055' });
    console.info('ttp:', ttp.length, 'bytes PNG');
    const unknown = await renderLocalCanvas('bed', { url: 'x' });
    console.info('unknown endpoint → null:', unknown === null);
  })().catch(err => {
    logError('[LocalCanvasRenderer self-check]', err);
    process.exit(1);
  });
}
