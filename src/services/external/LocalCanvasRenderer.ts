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
  changemymind: renderChangeMyMind,
  tweet: renderTweet,
  phub: renderPhub,
  xnxxcard: renderXnxxcard,
  welcard: renderWelcard,
  gaycard: renderGaycard,
  gay: renderGay,
  friendship: renderShipCard,
  ship: renderShipCard,
};

/** Hex color helpers. */
const WHITE = '#ffffff';

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws an avatar circle; falls back to a gray disc with the initial on fetch failure. */
async function drawAvatar(
  ctx: SKRSContext2D,
  url: string | undefined,
  x: number,
  y: number,
  d: number,
): Promise<void> {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
  ctx.clip();
  if (url) {
    try {
      const img = await fetchImage(url);
      const scale = Math.max(d / img.width, d / img.height);
      ctx.drawImage(
        img,
        x + (d - img.width * scale) / 2,
        y + (d - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
    } catch {
      avatarFallback(ctx, x, y, d);
    }
  } else {
    avatarFallback(ctx, x, y, d);
  }
  ctx.restore();
}

function avatarFallback(ctx: SKRSContext2D, x: number, y: number, d: number): void {
  ctx.fillStyle = '#3a3f4b';
  ctx.fillRect(x, y, d, d);
}

/** Vector heart via two bezier arcs. */
function drawHeart(ctx: SKRSContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const s = size / 16;
  ctx.moveTo(cx, cy + 4 * s);
  ctx.bezierCurveTo(cx, cy, cx - 8 * s, cy - 2 * s, cx - 8 * s, cy - 5 * s);
  ctx.bezierCurveTo(cx - 8 * s, cy - 9 * s, cx - 4 * s, cy - 10 * s, cx, cy - 6 * s);
  ctx.bezierCurveTo(cx + 4 * s, cy - 10 * s, cx + 8 * s, cy - 9 * s, cx + 8 * s, cy - 5 * s);
  ctx.bezierCurveTo(cx + 8 * s, cy - 2 * s, cx, cy, cx, cy + 4 * s);
  ctx.fill();
  ctx.restore();
}

/** Wrapped text lines with a given font. */
function layoutLines(
  ctx: SKRSContext2D,
  text: string,
  font: string,
  maxWidth: number,
  maxHeight: number,
  lineHeightFactor = 1.25,
): { lines: string[]; fontPx: number; lineHeight: number } {
  let fontPx = 30;
  let lines: string[] = [];
  while (fontPx > 14) {
    ctx.font = font.replace('%s', String(fontPx));
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * fontPx * lineHeightFactor <= maxHeight) break;
    fontPx -= 2;
  }
  return { lines, fontPx, lineHeight: fontPx * lineHeightFactor };
}

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

/** Brat album style: white bg, stretched bold lowercase black text. */
async function renderBrat(params: Record<string, string>): Promise<Buffer> {
  const text = (params.text ?? '').toLowerCase().slice(0, 120);
  const { canvas, ctx } = baseCanvas('#ffffff');
  ctx.fillStyle = '#000000';
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

/** Change My Mind meme: dark board, white sign with the text, caption below. */
async function renderChangeMyMind(params: Record<string, string>): Promise<Buffer> {
  const { canvas, ctx } = baseCanvas('#20242e');
  // sign
  ctx.fillStyle = WHITE;
  roundedRect(ctx, 56, 96, SIZE - 112, 268, 18);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const { lines, lineHeight } = layoutLines(
    ctx,
    (params.text ?? '').slice(0, 50),
    "bold %spx 'Liberation Sans', sans-serif",
    SIZE - 168,
    220,
  );
  const startY = 96 + 134 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, startY + i * lineHeight));
  // caption
  ctx.fillStyle = WHITE;
  ctx.font = "bold 40px 'Liberation Sans', sans-serif";
  ctx.fillText('CHANGE MY MIND', SIZE / 2, 432);
  return canvas.toBuffer('image/png');
}

/** Fake tweet card (delirius `tweet`). */
async function renderTweet(params: Record<string, string>): Promise<Buffer> {
  const bg = params.theme === 'light' ? '#ffffff' : '#15202b';
  const fg = params.theme === 'light' ? '#0f1419' : WHITE;
  const muted = params.theme === 'light' ? '#536471' : '#8899a6';
  const canvas = createCanvas(SIZE, 380);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, 380);

  await drawAvatar(ctx, params.image, 28, 28, 64);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = fg;
  ctx.font = "bold 26px 'Liberation Sans', sans-serif";
  ctx.fillText((params.name ?? 'User').slice(0, 24), 108, 50);
  ctx.fillStyle = muted;
  ctx.font = "20px 'Liberation Sans', sans-serif";
  ctx.fillText((params.username ?? '@user').slice(0, 24), 108, 76);

  ctx.fillStyle = fg;
  const { lines, lineHeight } = layoutLines(
    ctx,
    (params.comment ?? '').slice(0, 100),
    "26px 'Liberation Sans', sans-serif",
    SIZE - 64,
    180,
  );
  lines.forEach((line, i) => ctx.fillText(line, 32, 130 + i * lineHeight));

  // footer icons (vector, no emoji font needed)
  ctx.strokeStyle = muted;
  ctx.lineWidth = 2.5;
  const rowY = 340;
  const cols = [64, 180, 296, 412];
  // reply bubble
  ctx.beginPath();
  ctx.ellipse(cols[0], rowY, 11, 9, 0, Math.PI, 0);
  ctx.lineTo(cols[0] - 16, rowY + 8);
  ctx.stroke();
  // retweet arrows
  ctx.beginPath();
  ctx.arc(cols[1], rowY, 8, Math.PI * 0.6, Math.PI * 2.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cols[1] + 10, rowY - 6);
  ctx.lineTo(cols[1] + 10, rowY + 1);
  ctx.stroke();
  // heart
  drawHeart(ctx, cols[2], rowY, 22, muted);

  return canvas.toBuffer('image/png');
}

/** Pornhub-style comment card (delirius `phub`). */
async function renderPhub(params: Record<string, string>): Promise<Buffer> {
  const canvas = createCanvas(SIZE, 400);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(0, 0, SIZE, 400);
  // logo
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE;
  ctx.font = "bold 34px 'Liberation Sans', sans-serif";
  ctx.fillText('Porn', 28, 44);
  const pornW = ctx.measureText('Porn').width;
  ctx.fillStyle = '#ff9000';
  roundedRect(ctx, 30 + pornW, 20, 68, 46, 6);
  ctx.fill();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillText('hub', 34 + pornW, 44);

  await drawAvatar(ctx, params.image, 28, 96, 56);
  ctx.fillStyle = '#ff9000';
  ctx.font = "bold 22px 'Liberation Sans', sans-serif";
  ctx.fillText((params.username ?? 'user').slice(0, 26), 100, 110);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = "24px 'Liberation Sans', sans-serif";
  ctx.textAlign = 'left';
  const { lines, lineHeight } = layoutLines(
    ctx,
    (params.text ?? '').slice(0, 120),
    "24px 'Liberation Sans', sans-serif",
    SIZE - 64,
    190,
  );
  lines.forEach((line, i) => ctx.fillText(line, 32, 180 + i * lineHeight));
  drawHeart(ctx, 40, 356, 26, WHITE);
  return canvas.toBuffer('image/png');
}

/** XNXX-style video card (delirius `xnxxcard`). */
async function renderXnxxcard(params: Record<string, string>): Promise<Buffer> {
  const canvas = createCanvas(SIZE, 512);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SIZE, 512);
  ctx.fillStyle = '#ff6c00';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = "bold 44px 'Liberation Sans', sans-serif";
  ctx.fillText('XNXX', 28, 46);
  if (params.image) {
    try {
      const img = await fetchImage(params.image);
      const scale = Math.max((SIZE - 56) / img.width, 300 / img.height);
      ctx.save();
      roundedRect(ctx, 28, 88, SIZE - 56, 300, 12);
      ctx.clip();
      ctx.drawImage(
        img,
        28 + (SIZE - 56 - img.width * scale) / 2,
        88 + (300 - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
      ctx.restore();
    } catch {
      ctx.fillStyle = '#222';
      roundedRect(ctx, 28, 88, SIZE - 56, 300, 12);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#222';
    roundedRect(ctx, 28, 88, SIZE - 56, 300, 12);
    ctx.fill();
  }
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  const { lines, lineHeight } = layoutLines(
    ctx,
    (params.title ?? '').slice(0, 90),
    "bold 30px 'Liberation Sans', sans-serif",
    SIZE - 64,
    100,
  );
  lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, 420 + i * lineHeight));
  ctx.fillStyle = '#ff6c00';
  ctx.font = "20px 'Liberation Sans', sans-serif";
  ctx.fillText((params.username ?? '').slice(0, 30), SIZE / 2, 490);
  return canvas.toBuffer('image/png');
}

/** Welcome card with gradient, avatar, name and inviter (delirius `welcard`). */
async function renderWelcard(params: Record<string, string>): Promise<Buffer> {
  const canvas = createCanvas(SIZE, 512);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, 512);

  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "bold 52px 'Liberation Sans', sans-serif";
  ctx.fillText('WELCOME', SIZE / 2, 96);

  ctx.beginPath();
  ctx.arc(SIZE / 2, 232, 92, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#a5b4fc';
  ctx.stroke();
  await drawAvatar(ctx, params.image, SIZE / 2 - 88, 144, 176);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 40px 'Liberation Sans', sans-serif";
  ctx.fillText((params.name ?? '').slice(0, 22), SIZE / 2, 384);
  ctx.fillStyle = '#c7d2fe';
  ctx.font = "22px 'Liberation Sans', sans-serif";
  ctx.fillText(`invitado por ${params.author ?? 'OrbitBot'}`.slice(0, 40), SIZE / 2, 432);
  ctx.fillText(`${params.server ?? 'OrbitBot'}`.slice(0, 34), SIZE / 2, 464);
  return canvas.toBuffer('image/png');
}

/** Rainbow "gay card": avatar, name and rank (delirius `gaycard`). */
async function renderGaycard(params: Record<string, string>): Promise<Buffer> {
  const canvas = createCanvas(SIZE, 512);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  ['#ff0040', '#ff8c00', '#ffee00', '#00d26a', '#00b4ff', '#8b5cf6'].forEach((c, i, arr) =>
    grad.addColorStop(i / (arr.length - 1), c),
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, 512);

  ctx.beginPath();
  ctx.arc(SIZE / 2, 218, 96, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  await drawAvatar(ctx, params.url, SIZE / 2 - 92, 126, 184);

  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "bold 42px 'Liberation Sans', sans-serif";
  ctx.fillText((params.name ?? '').slice(0, 22), SIZE / 2, 372);
  ctx.font = "bold 34px 'Liberation Sans', sans-serif";
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillText((params.rank ?? '').slice(0, 34), SIZE / 2, 430);
  ctx.shadowBlur = 0;
  return canvas.toBuffer('image/png');
}

/** Avatar with a rainbow tint overlay (delirius `gay`). */
async function renderGay(params: Record<string, string>): Promise<Buffer> {
  if (!params.url) throw new Error('gay: missing url');
  const img = await fetchImage(params.url);
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  const scale = Math.max(SIZE / img.width, SIZE / img.height);
  ctx.drawImage(
    img,
    (SIZE - img.width * scale) / 2,
    (SIZE - img.height * scale) / 2,
    img.width * scale,
    img.height * scale,
  );
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  [
    'rgba(255,0,64,0.45)',
    'rgba(255,140,0,0.45)',
    'rgba(255,238,0,0.45)',
    'rgba(0,210,106,0.45)',
    'rgba(0,180,255,0.45)',
    'rgba(139,92,246,0.45)',
  ].forEach((c, i, arr) => grad.addColorStop(i / (arr.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return canvas.toBuffer('image/png');
}

/** Shared renderer for `friendship` and `ship`: two avatars + heart + percentage. */
async function renderShipCard(params: Record<string, string>): Promise<Buffer> {
  const canvas = createCanvas(SIZE, 512);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, '#111318');
  grad.addColorStop(1, '#2b1055');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, 512);

  const label = (params.text ?? 'Ship').slice(0, 16);
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "bold 44px 'Liberation Sans', sans-serif";
  ctx.fillText(label, SIZE / 2, 72);

  const d = 168;
  await drawAvatar(ctx, params.image1, 52, 140, d);
  await drawAvatar(ctx, params.image2, SIZE - 52 - d, 140, d);
  drawHeart(ctx, SIZE / 2, 218, 120, '#ff2d78');

  ctx.fillStyle = WHITE;
  ctx.font = "bold 64px 'Liberation Sans', sans-serif";
  ctx.fillText((params.percentage ?? '0%').slice(0, 8), SIZE / 2, 352);
  ctx.fillStyle = '#ff9ecb';
  ctx.font = "26px 'Liberation Sans', sans-serif";
  const footer = params.footer ?? (label === 'Friends' ? 'amistad' : 'compatibilidad');
  ctx.fillText(footer.slice(0, 40), SIZE / 2, 430);
  return canvas.toBuffer('image/png');
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
