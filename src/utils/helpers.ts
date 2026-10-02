/**
 * helpers.ts
 *
 * Small, dependency-free utilities shared across commands and services:
 * formatting, array manipulation, text parsing and small HTTP helpers.
 *
 * Everything here is pure or trivially side-effecting, which is what makes it
 * safe to use from the hot message path.
 *
 * @author **Carlos G**
 * @created 2026-04-07
 */

/** Formats a number with thousands separators, e.g. 1234567 -> "1,234,567". */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a duration using its two largest non-zero units, e.g. "2d 5h".
 * Falls back to seconds for short durations.
 */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/** Uppercases the first character and lowercases the rest. */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Shortens a string to `maxLength` *including* the suffix.
 * The input is returned untouched when it already fits.
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Formats a remaining duration for display in the user's language.
 * Reports only the largest non-zero unit, e.g. "5 minutos".
 */
export function formatTimeRemaining(ms: number, locale: 'es' | 'en' = 'es'): string {
  if (ms <= 0) return locale === 'es' ? 'Expira inmediatamente' : 'Expires immediately';

  const l =
    locale === 'es'
      ? { day: 'día', hour: 'hora', minute: 'minuto', second: 'segundo' }
      : { day: 'day', hour: 'hour', minute: 'minute', second: 'second' };
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? (locale === 'es' ? 's' : 's') : ''}`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return plural(days, l.day);
  if (hours > 0) return plural(hours, l.hour);
  if (minutes > 0) return plural(minutes, l.minute);
  return plural(seconds, l.second);
}

/** Promise-based delay. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Uniformly random element. Returns undefined for an empty array. */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/** Uniformly random integer in the inclusive range [min, max]. */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Fisher-Yates shuffle. Returns a new array; the input is not mutated. */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Groups items by the stringified value of one property. */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    },
    {} as Record<string, T[]>,
  );
}

/** Removes duplicates, preserving first-seen order. */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/** Splits an array into consecutive chunks of at most `size` items. */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extracts `@123456` mentions from text and expands them into full user JIDs,
 * which is the format Baileys expects in a `mentions` array.
 */
export function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\d+)/g);
  return mentions ? mentions.map(m => m.substring(1) + '@s.whatsapp.net') : [];
}

/** Strips punctuation, keeping only word characters and whitespace. */
export function sanitize(str: string): string {
  return str.replace(/[^\w\s]/gi, '');
}

/** Parses `key=value` arguments into a record; non-matching args are ignored. */
export function parseKeyValueArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  args.forEach(arg => {
    const match = arg.match(/^(\w+)=(.+)$/);
    if (match) {
      result[match[1]] = match[2];
    }
  });

  return result;
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export { isValidUrl } from './validators.js';

/** Removes Markdown/WhatsApp markup, keeping only the inner text. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]+?```/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Renders a text progress bar.
 * `current` is clamped to `total`, so an over-full bar never overflows.
 */
export function createProgressBar(
  current: number,
  total: number,
  length: number = 10,
  filledChar: string = '█',
  emptyChar: string = '░',
): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * length);
  const empty = length - filled;

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/** Formats seconds as zero-padded HH:MM:SS. */
export function secondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s].map(v => (v < 10 ? '0' + v : v)).join(':');
}

/**
 * Escapes the five XML entities.
 * The ampersand is replaced first, otherwise it would double-escape the entities
 * introduced by the later replacements.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Greedy word wrap to a maximum line length.
 * Words longer than the limit are emitted as their own (over-long) line rather
 * than being broken, so no characters are lost.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

/**
 * Uploads a PNG buffer to tmpfiles.org and returns the direct-download URL.
 *
 * The multipart body is assembled manually to avoid pulling in a form-data
 * dependency for a single call. Returns null on any failure: this is a best
 * effort convenience, not a critical path.
 */
export async function uploadToTmpfiles(buffer: Buffer): Promise<string | null> {
  try {
    const boundary = `----FormBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const header =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="profileDefault.png"${CRLF}` +
      `Content-Type: image/png${CRLF}` +
      `${CRLF}`;

    const footer = `${CRLF}--${boundary}--${CRLF}`;

    const body = Buffer.concat([
      Buffer.from(header, 'utf-8'),
      buffer,
      Buffer.from(footer, 'utf-8'),
    ]);

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { data?: { url?: string } };
    const pageUrl = data?.data?.url;
    if (!pageUrl) return null;

    return pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  } catch {
    return null;
  }
}

/**
 * Parses a compact duration such as `30s`, `5m`, `2h`, `7d` into milliseconds.
 * @returns Milliseconds, or 0 when the format does not match.
 */
export function parseDuration(str: string): number {
  const match = str.match(/^(\d+)([smhd])$/);

  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}
