/**
 * Formats a number with commas as thousands separators.
 *
 * @param num - The number to format.
 * @returns The formatted number string with commas.
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - The duration in milliseconds.
 * @returns A formatted string (e.g., "2d 5h", "3h 30m", "45m 30s", "120s").
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

/**
 * Capitalizes the first letter of a string and lowercases the rest.
 *
 * @param str - The string to capitalize.
 * @returns The capitalized string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncates a string to a maximum length, appending a suffix if truncated.
 *
 * @param str - The string to truncate.
 * @param maxLength - The maximum length of the result.
 * @param suffix - The suffix to append when truncating (default: '...').
 * @returns The truncated string with suffix, or the original string if within length.
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Formats a remaining time duration into a human-readable string.
 *
 * @param ms - The remaining time in milliseconds.
 * @param locale - The locale for formatting ('es' for Spanish, 'en' for English).
 * @returns A human-readable time string (e.g., "2 days", "3 hours").
 */
export function formatTimeRemaining(ms: number, locale: 'es' | 'en' = 'es'): string {
  if (ms <= 0) return locale === 'es' ? 'Expires immediately' : 'Expires immediately';

  const l =
    locale === 'es'
      ? { day: 'day', hour: 'hour', minute: 'minute', second: 'second' }
      : { day: 'day', hour: 'hour', minute: 'minute', second: 'second' };
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return plural(days, l.day);
  if (hours > 0) return plural(hours, l.hour);
  if (minutes > 0) return plural(minutes, l.minute);
  return plural(seconds, l.second);
}

/**
 * Creates a promise that resolves after a specified delay.
 *
 * @param ms - The delay in milliseconds.
 * @returns A promise that resolves after the delay.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns a random element from an array.
 *
 * @param array - The array to pick from.
 * @returns A randomly selected element from the array.
 * @throws Error if the array is empty.
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generates a random integer between min and max (inclusive).
 *
 * @param min - The minimum value (inclusive).
 * @param max - The maximum value (inclusive).
 * @returns A random integer between min and max.
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a shuffled copy of an array using the Fisher-Yates algorithm.
 *
 * @param array - The array to shuffle.
 * @returns A new array with elements in random order.
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Groups array elements by a key property.
 *
 * @param array - The array to group.
 * @param key - The property key to group by.
 * @returns An object mapping key values to arrays of elements.
 */
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

/**
 * Removes duplicate elements from an array.
 *
 * @param array - The array to deduplicate.
 * @returns A new array with unique elements.
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param array - The array to chunk.
 * @param size - The size of each chunk.
 * @returns An array of chunk arrays.
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Extracts WhatsApp user mentions from text.
 *
 * @param text - The text to extract mentions from.
 * @returns An array of WhatsApp user IDs in the format "number@s.whatsapp.net".
 */
export function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\d+)/g);
  return mentions ? mentions.map(m => m.substring(1) + '@s.whatsapp.net') : [];
}

/**
 * Sanitizes a string by removing non-alphanumeric characters except spaces.
 *
 * @param str - The string to sanitize.
 * @returns The sanitized string.
 */
export function sanitize(str: string): string {
  return str.replace(/[^\w\s]/gi, '');
}

/**
 * Parses key-value arguments from an array of strings.
 *
 * @param args - An array of strings in the format "key=value".
 * @returns An object mapping keys to values.
 */
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

/**
 * Formats a byte count into a human-readable string with appropriate units.
 *
 * @param bytes - The number of bytes.
 * @param decimals - The number of decimal places (default: 2).
 * @returns A formatted string (e.g., "1.5 MB", "500 KB").
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export { isValidUrl } from './validators.js';

/**
 * Strips Markdown formatting from text.
 *
 * @param text - The text to strip Markdown from.
 * @returns The plain text without Markdown formatting.
 */
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
 * Creates a visual progress bar string.
 *
 * @param current - The current progress value.
 * @param total - The total (maximum) value.
 * @param length - The length of the progress bar in characters (default: 10).
 * @param filledChar - The character for filled portion (default: '█').
 * @param emptyChar - The character for empty portion (default: '░').
 * @returns A string representing the progress bar.
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

/**
 * Converts seconds to HH:MM:SS format.
 *
 * @param seconds - The total seconds.
 * @returns A string in HH:MM:SS format with zero-padding.
 */
export function secondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s].map(v => (v < 10 ? '0' + v : v)).join(':');
}

/**
 * Escapes special XML characters in a string.
 *
 * @param text - The text to escape.
 * @returns The XML-escaped string.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

/**
 * Wraps text into lines of a maximum character length.
 *
 * @param text - The text to wrap.
 * @param maxChars - The maximum characters per line.
 * @returns An array of wrapped lines.
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
 * Uploads a buffer to tmpfiles.org and returns a direct download URL.
 *
 * @param buffer - The image buffer to upload.
 * @returns A promise that resolves to the download URL, or null on failure.
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
 * Parses a duration string (e.g., "5m", "2h", "1d") into milliseconds.
 *
 * @param str - The duration string with unit suffix (s, m, h, d).
 * @returns The duration in milliseconds, or 0 if invalid format.
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