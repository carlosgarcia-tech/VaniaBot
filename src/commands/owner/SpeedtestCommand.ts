/**
 * SpeedtestCommand.ts
 *
 * owner command `speedtest` — Mide ping, descarga y subida del internet del bot
 * Usage: !speedtest
 *
 * @author **Carlos G**
 */

import { Command } from '../Command.js';
import { CommandCategory, PermissionLevel } from '@/types/index.js';
import type { MessageContext } from '@/types/index.js';
import { logError } from '@/utils/logger.js';

const TEST_HOST = 'https://speed.cloudflare.com';
const TRACE_HOST = 'https://1.1.1.1/cdn-cgi/trace';
const PING_SAMPLES = 3;
const DEFAULT_DOWNLOAD_BYTES = 16_000_000;
const DEFAULT_UPLOAD_BYTES = 4_000_000;
const REQUEST_TIMEOUT_MS = 45_000;
const TRACE_TIMEOUT_MS = 8_000;

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'es-419,es;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
};

const CF_HEADERS = {
  ...DEFAULT_HEADERS,
  origin: TEST_HOST,
  referer: `${TEST_HOST}/`,
};

const DOWNLOAD_FALLBACKS = [
  {
    name: 'Cloudflare',
    buildUrl: (bytes: number) => `${TEST_HOST}/__down?bytes=${bytes}&r=${Date.now()}`,
    headers: CF_HEADERS,
  },
  {
    name: 'Hetzner',
    url: 'https://speed.hetzner.de/100MB.bin',
    headers: DEFAULT_HEADERS,
    supportsRange: true,
  },
  {
    name: 'OVH',
    url: 'https://proof.ovh.net/files/100Mb.dat',
    headers: DEFAULT_HEADERS,
    supportsRange: true,
  },
  {
    name: 'Cachefly',
    url: 'https://cachefly.cachefly.net/100mb.test',
    headers: DEFAULT_HEADERS,
    supportsRange: true,
  },
];

const UPLOAD_FALLBACKS = [
  { name: 'Cloudflare', buildUrl: () => `${TEST_HOST}/__up?r=${Date.now()}`, headers: CF_HEADERS },
  { name: 'Postman', url: 'https://postman-echo.com/post', headers: DEFAULT_HEADERS },
  { name: 'Httpbin', url: 'https://httpbin.org/post', headers: DEFAULT_HEADERS },
];

let activeSpeedtest: Promise<unknown> | null = null;

function formatBytes(bytes: number): string {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatMbps(bytes: number, ms: number): string {
  const totalMs = Math.max(1, Number(ms || 0));
  const mbps = (Number(bytes || 0) * 8) / (totalMs / 1000) / 1_000_000;
  return `${mbps.toFixed(2)} Mbps`;
}

function formatMs(value: number): string {
  return `${Number(value || 0).toFixed(0)} ms`;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function clampNumber(value: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function stdDev(values: number[]): number {
  if (!values.length) return 0;
  const avg = average(values);
  const variance = average(values.map(v => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function formatPercent(value: number): string {
  const v = clampNumber(value, 0, 100);
  return `${v.toFixed(0)}%`;
}

async function readResponseBytesLimited(response: Response, limitBytes: number): Promise<number> {
  if (!response.body) {
    const payload = await response.arrayBuffer();
    return Math.min(payload.byteLength, limitBytes);
  }

  const reader = response.body.getReader();
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value?.byteLength || 0;
    if (total >= limitBytes) {
      try {
        await reader.cancel();
      } catch (error) {
        logError('[Speedtest]', error);
      }
      break;
    }
  }

  return total;
}

async function runTimedFetch(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; startedAt: bigint }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();

  try {
    const headers = { ...DEFAULT_HEADERS, ...(options?.headers || {}) };
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { response, startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function measurePing(): Promise<{
  samples: number[];
  averageMs: number;
  bestMs: number;
  jitterMs: number;
}> {
  const samples: number[] = [];
  let useFallback = false;

  for (let index = 0; index < PING_SAMPLES; index++) {
    try {
      const query = `${TEST_HOST}/__down?bytes=1&r=${Date.now()}-${index}`;
      const { response, startedAt } = await runTimedFetch(
        query,
        { method: 'GET', headers: CF_HEADERS },
        TRACE_TIMEOUT_MS,
      );
      await readResponseBytesLimited(response, 8192);
      const endedAt = process.hrtime.bigint();
      samples.push(Number(endedAt - startedAt) / 1_000_000);
    } catch (error) {
      logError('[Speedtest]', error);
      useFallback = true;
      break;
    }
  }

  if (useFallback) {
    samples.length = 0;
    for (let index = 0; index < PING_SAMPLES; index++) {
      try {
        const query = `${TRACE_HOST}?r=${Date.now()}-${index}`;
        const { response, startedAt } = await runTimedFetch(
          query,
          { method: 'GET', headers: DEFAULT_HEADERS },
          TRACE_TIMEOUT_MS,
        );
        await readResponseBytesLimited(response, 8192);
        const endedAt = process.hrtime.bigint();
        samples.push(Number(endedAt - startedAt) / 1_000_000);
      } catch (error) {
        logError('[Speedtest]', error);
        break;
      }
    }
  }

  return {
    samples,
    averageMs: average(samples),
    bestMs: samples.length ? Math.min(...samples) : 0,
    jitterMs: stdDev(samples),
  };
}

async function measureDownload(bytesToDownload: number): Promise<{
  ok: boolean;
  provider: string;
  bytes: number;
  elapsedMs: number;
  speedLabel: string;
  error?: string;
}> {
  const bytesWanted = Math.max(1_000_000, Number(bytesToDownload || DEFAULT_DOWNLOAD_BYTES));

  for (const provider of DOWNLOAD_FALLBACKS) {
    try {
      const url = provider.buildUrl ? provider.buildUrl(bytesWanted) : provider.url;
      const headers: Record<string, string> = { ...(provider.headers || {}) };
      if (provider.supportsRange) headers.range = `bytes=0-${bytesWanted - 1}`;

      const { response, startedAt } = await runTimedFetch(
        url,
        { method: 'GET', headers },
        REQUEST_TIMEOUT_MS,
      );
      const bytes = await readResponseBytesLimited(response, bytesWanted);
      const endedAt = process.hrtime.bigint();
      const elapsedMs = Number(endedAt - startedAt) / 1_000_000;

      return {
        ok: true,
        provider: provider.name,
        bytes,
        elapsedMs,
        speedLabel: formatMbps(bytes, elapsedMs),
      };
    } catch (error) {
      logError('[Speedtest]', error);
      continue;
    }
  }

  return {
    ok: false,
    provider: '',
    bytes: 0,
    elapsedMs: 0,
    speedLabel: '0.00 Mbps',
    error: 'No pude medir descarga',
  };
}

async function measureUpload(bytesToUpload: number): Promise<{
  ok: boolean;
  provider: string;
  bytes: number;
  elapsedMs: number;
  speedLabel: string;
  error?: string;
}> {
  const bytesWanted = Math.max(500_000, Number(bytesToUpload || DEFAULT_UPLOAD_BYTES));
  const payloadSize = clampNumber(bytesWanted, 500_000, 4_000_000);
  const payload = Buffer.alloc(payloadSize, 97);

  for (const provider of UPLOAD_FALLBACKS) {
    try {
      const url = provider.buildUrl ? provider.buildUrl() : provider.url;
      const headers = {
        ...(provider.headers || {}),
        'content-type': 'application/octet-stream',
        'content-length': String(payload.length),
      };

      const { response, startedAt } = await runTimedFetch(
        url,
        { method: 'POST', headers, body: payload },
        REQUEST_TIMEOUT_MS,
      );
      await response.text();
      const endedAt = process.hrtime.bigint();
      const elapsedMs = Number(endedAt - startedAt) / 1_000_000;

      return {
        ok: true,
        provider: provider.name,
        bytes: payload.length,
        elapsedMs,
        speedLabel: formatMbps(payload.length, elapsedMs),
      };
    } catch (error) {
      logError('[Speedtest]', error);
      continue;
    }
  }

  return {
    ok: false,
    provider: '',
    bytes: payload.length,
    elapsedMs: 0,
    speedLabel: '0.00 Mbps',
    error: 'No pude medir subida',
  };
}

function parseMbps(label: string): number {
  const match = String(label || '').match(/([\d.]+)\s*Mbps/i);
  if (!match?.[1]) return 0;
  return Number.isFinite(Number(match[1])) ? Number(match[1]) : 0;
}

function buildBar(valuePct: number, size = 18): string {
  const pct = clampNumber(valuePct, 0, 100);
  const total = Math.max(8, Math.min(30, Number(size || 18)));
  const filled = Math.round((pct / 100) * total);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, total - filled));
}

function padRight(text: string, width: number): string {
  const raw = String(text ?? '');
  if (raw.length >= width) return raw.slice(0, width);
  return raw + ' '.repeat(width - raw.length);
}

function box(lines: string[], width = 64): string {
  const w = Math.max(40, Math.min(80, Number(width || 64)));
  const top = `┏${'━'.repeat(w - 2)}┓`;
  const body = lines.map(line => `┃${padRight(line, w - 2)}┃`).join('\n');
  const bottom = `┗${'━'.repeat(w - 2)}┛`;
  return [top, body, bottom].join('\n');
}

async function executeSpeedtest(options: { downloadBytes?: number; uploadBytes?: number }) {
  const startedAt = Date.now();
  const downloadBytes = Number(options?.downloadBytes || DEFAULT_DOWNLOAD_BYTES);
  const uploadBytes = Number(options?.uploadBytes || DEFAULT_UPLOAD_BYTES);
  const ping = await measurePing();
  const download = await measureDownload(downloadBytes);
  const upload = await measureUpload(uploadBytes);

  return { startedAt, finishedAt: Date.now(), ping, download, upload };
}

function buildResultMessage(
  result: Awaited<ReturnType<typeof executeSpeedtest>>,
  modeLabel: string,
): string {
  const totalTimeMs = Math.max(0, Number(result?.finishedAt || 0) - Number(result?.startedAt || 0));
  const dl = parseMbps(result?.download?.speedLabel);
  const ul = parseMbps(result?.upload?.speedLabel);
  const ping = Number(result?.ping?.averageMs || 0);
  const jitter = Number(result?.ping?.jitterMs || 0);

  const dlPct = clampNumber((dl / 300) * 100, 0, 100);
  const ulPct = clampNumber((ul / 150) * 100, 0, 100);
  const pingPct = clampNumber(((300 - Math.min(300, ping)) / 300) * 100, 0, 100);
  const jitterPct = clampNumber(((100 - Math.min(100, jitter)) / 100) * 100, 0, 100);

  const header = `⟦ SPEEDTEST ⟧  Estado: ONLINE  Modo: ${modeLabel}`;
  const sources = `DL: ${result?.download?.provider || '?'}  |  UL: ${result?.upload?.provider || '?'}`;
  const time = `Duración: ${formatMs(totalTimeMs)}  |  Muestras ping: ${PING_SAMPLES}`;

  const dlLine = `Descarga  ${padRight(result?.download?.speedLabel || '0.00 Mbps', 12)} ${buildBar(dlPct)} ${formatPercent(dlPct)}${result?.download?.ok === false ? ' (fallo)' : ''}`;
  const ulLine = `Subida    ${padRight(result?.upload?.speedLabel || '0.00 Mbps', 12)} ${buildBar(ulPct)} ${formatPercent(ulPct)}${result?.upload?.ok === false ? ' (fallo)' : ''}`;
  const pingLine = `Ping      ${padRight(formatMs(ping), 12)} ${buildBar(pingPct)} ${formatPercent(pingPct)}`;
  const jitLine = `Jitter    ${padRight(formatMs(jitter), 12)} ${buildBar(jitterPct)} ${formatPercent(jitterPct)}`;
  const bytesLine = `Datos     DL ${formatBytes(result?.download?.bytes)} | UL ${formatBytes(result?.upload?.bytes)}`;

  return (
    '```\n' +
    box([header, ' ', dlLine, ulLine, pingLine, jitLine, ' ', sources, bytesLine, time], 72) +
    '\n```'
  );
}

/** Command handler for `!speedtest`: Mide ping, descarga y subida del internet del bot. */
export class SpeedtestCommand extends Command {
  name = 'speedtest';
  description = 'Mide ping, descarga y subida del internet del bot';
  category = CommandCategory.OWNER;
  aliases = ['test-speed', 'interno'];
  usage = '!speedtest';
  examples = ['!speedtest', '!speedtest lite', '!speedtest full'];
  permissions = {
    user: [PermissionLevel.OWNER],
  };

  async execute(ctx: MessageContext): Promise<void> {
    if (activeSpeedtest) {
      await ctx.reply('Ya hay un speedtest en progreso. Espera a que termine.');
      return;
    }

    const mode = ctx.args[0]?.toLowerCase() || '';
    const isFull = mode === 'full' || mode === 'pro' || mode === 'completo';
    const isLite = mode === 'lite' || mode === 'rapido' || mode === 'fast';
    const modeLabel = isFull ? 'COMPLETO' : isLite ? 'RAPIDO' : 'NORMAL';
    const downloadBytes = isFull ? 40_000_000 : isLite ? 8_000_000 : DEFAULT_DOWNLOAD_BYTES;
    const uploadBytes = isFull ? 12_000_000 : isLite ? 2_000_000 : DEFAULT_UPLOAD_BYTES;

    await ctx.reply(
      '*Iniciando speedtest del bot...*\n\n' +
        'Estoy midiendo ping, descarga y subida.\n' +
        `Modo: *${modeLabel}*`,
    );

    activeSpeedtest = executeSpeedtest({ downloadBytes, uploadBytes });

    try {
      const result = (await activeSpeedtest) as Awaited<ReturnType<typeof executeSpeedtest>>;
      await ctx.reply(buildResultMessage(result, modeLabel));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.reply(
        `No pude completar el speedtest.\n` +
          `Motivo: *${message}*\n\n` +
          `Posibles causas:\n` +
          `- El hosting bloquea pruebas de red\n` +
          `- La salida HTTP está limitada\n` +
          `- La conexión del servidor está inestable`,
      );
    } finally {
      activeSpeedtest = null;
    }
  }
}
