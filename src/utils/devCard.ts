/**
 * devCard.ts
 *
 * Builds the "creator card" image used by `!dev`.
 *
 * The artwork (anime character, sakura, cat, icons, etc.) lives in
 * `assets/dev/dev-base.png` — the original illustration with ONLY the data
 * texts removed. Every piece of data (name, role, social handles, phone) is
 * drawn on top at runtime, so changing a username is just editing the profile
 * object: no need to regenerate any artwork.
 *
 * Text is converted to vector paths with opentype.js (fonts live in
 * `assets/dev/fonts`), so it renders identically on any server, even without
 * system fonts installed. The bottom panel of the artwork is in perspective, so
 * each element gets a local affine transform derived from the panel homography.
 *
 * @author **Carlos G**
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';

/** Bare usernames (no URLs, no @). Edit these when a handle changes. */
export interface DevProfile {
  name: string;
  role: string;
  subtitle: string;
  github: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  /** Phone shown as-is, e.g. "+52 951 652 6675" */
  whatsapp: string;
}

/** Full URLs derived from the profile (handy for captions). */
export function devLinks(p: DevProfile) {
  return {
    github: `https://github.com/${p.github}`,
    instagram: `https://www.instagram.com/${p.instagram}`,
    tiktok: `https://www.tiktok.com/@${p.tiktok}`,
    youtube: `https://www.youtube.com/@${p.youtube}`,
    whatsapp: `https://wa.me/${p.whatsapp.replace(/\D/g, '')}`,
  };
}

const ASSET_DIR = process.env.DEV_CARD_ASSETS ?? path.join(process.cwd(), 'data', 'assets');
const INK = '#171316';
const CRIMSON = '#9b2a3c';
const GRAY = '#77716F';

/**
 * Homography: flat panel coordinates (1200x580) → artwork pixels.
 * Calibrated once against the illustration; only changes if the artwork changes.
 */
const H = [
  [0.5878932764767051, -0.0709014160371694, 216.60430072147062],
  [-0.09533470121608575, 0.5803599352595812, 535.9014770837979],
  [-0.00011457691881599353, -8.064209307815027e-5, 0.8629653415198033],
] as const;

/** Slight lean of the art's vertical grid (divider and icons), in flat space. */
const LEAN = 0.016;
const LEAN_Y0 = 108;

type Mat = [number, number, number, number, number, number]; // SVG matrix(a b c d e f)

/** Local affine approximation of the homography around flat point (x, y), including lean. */
function localMatrix(x: number, y: number): Mat {
  const lx = x + LEAN * (y - LEAN_Y0);
  const w = H[2][0] * lx + H[2][1] * y + H[2][2];
  const X = (H[0][0] * lx + H[0][1] * y + H[0][2]) / w;
  const Y = (H[1][0] * lx + H[1][1] * y + H[1][2]) / w;
  // Jacobian of the homography wrt (lx, y)
  const dXdx = (H[0][0] - X * H[2][0]) / w;
  const dXdy = (H[0][1] - X * H[2][1]) / w;
  const dYdx = (H[1][0] - Y * H[2][0]) / w;
  const dYdy = (H[1][1] - Y * H[2][1]) / w;
  // chain with lean: lx = x + LEAN*y + c
  const a = dXdx;
  const b = dYdx;
  const c = dXdy + dXdx * LEAN;
  const d = dYdy + dYdx * LEAN;
  const e = X - a * x - c * y;
  const f = Y - b * x - d * y;
  return [a, b, c, d, e, f];
}

const mat = (m: Mat): string => `matrix(${m.map(v => +v.toFixed(5)).join(' ')})`;

// ---------- fonts ----------

type Font = opentype.Font;
const fontCache = new Map<string, Promise<Font>>();

function loadFont(file: string): Promise<Font> {
  let p = fontCache.get(file);
  if (!p) {
    p = readFile(path.join(ASSET_DIR, 'fonts', file)).then(buf =>
      opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    );
    p.catch(() => fontCache.delete(file));
    fontCache.set(file, p);
  }
  return p;
}

/** Number formatter for path data (2 decimals, no trailing zeros). */
const num = (v: number): string => (+v.toFixed(2)).toString();

/** Serializes an opentype path with explicit separators (toPathData output gets truncated by librsvg). */
function pathData(p: opentype.Path): string {
  return p.commands
    .map(c => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${num(c.x)} ${num(c.y)}`;
        case 'Q':
          return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
        case 'C':
          return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
        default:
          return 'Z';
      }
    })
    .join(' ');
}

interface TextRun {
  d: string;
  width: number;
}

/** Lays out text as one SVG path (left edge at x=0, baseline at y=0). */
function layout(font: Font, text: string, size: number, spacingEm = 0): TextRun {
  const scale = size / font.unitsPerEm;
  const spacing = spacingEm * size;
  let x = 0;
  let prev: opentype.Glyph | null = null;
  const parts: string[] = [];
  for (const ch of Array.from(text)) {
    const glyph = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, glyph) * scale;
    parts.push(pathData(glyph.getPath(x, 0, size)));
    x += (glyph.advanceWidth ?? 0) * scale + spacing;
    prev = glyph;
  }
  return { d: parts.join(' '), width: x - spacing };
}

/** Same as layout, but shrinks the font size so the run fits maxWidth. */
function fit(font: Font, text: string, size: number, maxWidth: number, spacingEm = 0): TextRun {
  let run = layout(font, text, size, spacingEm);
  if (run.width > maxWidth) {
    run = layout(font, text, (size * maxWidth) / run.width, spacingEm);
  }
  return run;
}

// ---------- svg pieces (positions are in flat panel coordinates) ----------

/**
 * Places a text run so its left edge lands on flat (ox, baselineY).
 * The affine is anchored at the run's center to keep perspective error minimal.
 */
function place(run: TextRun, ox: number, baselineY: number, fill: string, boldness = 0): string {
  const m = localMatrix(ox + run.width / 2, baselineY);
  const stroke = boldness
    ? ` stroke="${fill}" stroke-width="${boldness}" stroke-linejoin="round"`
    : '';
  return `<g transform="${mat(m)}"><path transform="translate(${ox.toFixed(2)} ${baselineY})" d="${run.d}" fill="${fill}"${stroke}/></g>`;
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  width: number,
  opacity = 1,
): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const m = localMatrix(cx, cy);
  return (
    `<g transform="${mat(m)}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ` +
    `stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-opacity="${opacity}"/></g>`
  );
}

/** Tapered crimson brush stroke under the name. */
function brushStroke(cx: number, y: number, width: number): string {
  const x1 = cx - width / 2;
  const x2 = cx + width / 2;
  const m = localMatrix(cx, y);
  const r = (px: number, py: number) => `${px.toFixed(1)} ${py.toFixed(1)}`;
  const main =
    `M ${r(x1, y + 4)} ` +
    `C ${r(x1 + width * 0.25, y - 2)} ${r(x1 + width * 0.6, y - 5)} ${r(x2, y - 8)} ` +
    `L ${r(x2 + 2, y - 3)} ` +
    `C ${r(x1 + width * 0.65, y + 1)} ${r(x1 + width * 0.3, y + 6)} ${r(x1, y + 4)} Z`;
  const thin =
    `M ${r(x1 + width * 0.12, y + 8)} ` +
    `C ${r(x1 + width * 0.4, y + 4)} ${r(x1 + width * 0.7, y + 1)} ${r(x2 - width * 0.08, y - 1)} ` +
    `C ${r(x1 + width * 0.7, y + 5)} ${r(x1 + width * 0.4, y + 9)} ${r(x1 + width * 0.12, y + 8)} Z`;
  return `<g transform="${mat(m)}"><path d="${main}" fill="${CRIMSON}"/><path d="${thin}" fill="${CRIMSON}" fill-opacity="0.55"/></g>`;
}

// ---------- main ----------

const NAME_CX = 338;
const ROW_X = 712;
const ROW_CENTERS = [108, 188, 268, 347, 427] as const;
const ROW_MAX_W = 344;

async function buildOverlay(p: DevProfile, width: number, height: number): Promise<string> {
  const [brush, sans500, sans600] = await Promise.all([
    loadFont('kaushan-script-latin-400-normal.woff'),
    loadFont('josefin-sans-latin-500-normal.woff'),
    loadFont('josefin-sans-latin-600-normal.woff'),
  ]);

  const out: string[] = [];

  // Name + brush stroke
  const name = fit(brush, p.name, 100, 430);
  out.push(place(name, NAME_CX - name.width / 2, 262, INK, 2.4));
  out.push(brushStroke(NAME_CX, 296, Math.min(300, Math.max(160, name.width * 0.7))));

  // Role + subtitle (with side dashes)
  const role = fit(sans600, p.role.toUpperCase(), 30, 380, 0.12);
  out.push(place(role, NAME_CX - role.width / 2, 348, INK));

  const sub = fit(sans600, p.subtitle.toUpperCase(), 30, 330, 0.12);
  const subX = NAME_CX - sub.width / 2;
  out.push(place(sub, subX, 390, INK));
  out.push(line(subX - 14 - 40, 383, subX - 14, 383, INK, 2.2));
  out.push(line(subX + sub.width + 14, 383, subX + sub.width + 14 + 40, 383, INK, 2.2));

  // Social rows
  const rows = [
    `github.com/${p.github}`,
    `instagram.com/${p.instagram}`,
    `tiktok.com/@${p.tiktok}`,
    `youtube.com/@${p.youtube}`,
    p.whatsapp,
  ];
  rows.forEach((text, i) => {
    const cy = ROW_CENTERS[i] ?? 0;
    out.push(place(fit(sans500, text, 32, ROW_MAX_W), ROW_X, cy + 3, INK));
    out.push(line(ROW_X, cy + 15, ROW_X + 344, cy + 15, GRAY, 1.6, 0.75));
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${out.join('')}</svg>`;
}

/** Renders the creator card as a JPEG buffer. */
export async function buildDevCard(profile: DevProfile): Promise<Buffer> {
  const base = sharp(path.join(ASSET_DIR, 'dev-base.png'));
  const { width, height } = await base.metadata();
  if (!width || !height) throw new Error('devCard: could not read base image size');

  const svg = await buildOverlay(profile, width, height);
  return base
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
