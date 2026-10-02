export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

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

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\d+)/g);
  return mentions ? mentions.map(m => m.substring(1) + '@s.whatsapp.net') : [];
}

export function sanitize(str: string): string {
  return str.replace(/[^\w\s]/gi, '');
}

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

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export { isValidUrl } from './validators.js';

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

export function secondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s].map(v => (v < 10 ? '0' + v : v)).join(':');
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
