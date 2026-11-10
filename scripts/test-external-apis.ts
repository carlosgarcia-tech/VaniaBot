/**
 * External-API test runner for OrbitBot.
 * Hits every external service the bot depends on, records status/latency and
 * validates the response shape. Results go to /tmp/opencode/api-test-results.json
 */
import { writeFileSync } from 'fs';

type Expect = 'json' | 'image' | 'html' | 'any' | 'key-required';
interface Probe {
  group: string;
  service: string;
  url: string;
  method?: 'GET' | 'HEAD' | 'POST';
  body?: unknown;
  expect: Expect;
  note?: string;
}

const probes: Probe[] = [
  // --- Delirius (multi-service API) ---
  { group: 'Delirius', service: 'canvas (brat → comando .brat)', url: 'https://api.delirius.store/canvas/brat?text=OrbitBot', expect: 'image' },
  { group: 'Delirius', service: 'search/spotify (.gimage/.ytsearch…)', url: 'https://api.delirius.store/search/spotify?q=bad+bunny', expect: 'json' },
  { group: 'Delirius', service: 'random (avataranime/cat…)', url: 'https://api.delirius.store/random/randomavatar', expect: 'image' },
  { group: 'Delirius', service: 'reactions (.hug/.pat…)', url: 'https://api.delirius.store/reactions/hug', expect: 'image' },
  { group: 'Delirius', service: 'nsfw (alcance, sin descarga)', url: 'https://api.delirius.store/nsfw/hentai', expect: 'json', note: 'solo alcance' },
  { group: 'Delirius', service: 'ia/mailcreate (.mailcreate)', url: 'https://api.delirius.store/ia/mailcreate', expect: 'any' },

  // --- APIs específicas de stickers/creative ---
  { group: 'Stickers/Creative', service: 'quote generator (.qc)', url: 'https://bot.lyo.su/quote/generate', method: 'POST', body: { type: 'quote', format: 'png', backgroundColor: '#1b1425', width: 512, height: 512, scale: 2, messages: [{ entities: [], avatar: true, name: 'Test', text: 'Hola', media: [] }] }, expect: 'image' },
  { group: 'Stickers/Creative', service: 'imgflip (.stickerrandom)', url: 'https://api.imgflip.com/get_memes', expect: 'json' },
  { group: 'Stickers/Creative', service: 'ephoto360 (mumaker, 17 comandos de texto)', url: 'https://en.ephoto360.com/ice-text-effect-online-101.html', expect: 'html' },
  { group: 'Stickers/Creative', service: 'qu.ax (GIFs interacción)', url: 'https://qu.ax/', expect: 'any' },
  { group: 'Stickers/Creative', service: 'telegra.ph (GIFs interacción)', url: 'https://telegra.ph/', expect: 'any' },
  { group: 'Stickers/Creative', service: 'catbox.moe (GIFs interacción)', url: 'https://files.catbox.moe/6to3zj.mp4', method: 'HEAD', expect: 'any' },

  // --- APIs personales de terceros (riesgo) ---
  { group: 'APIs de terceros', service: 'princetechn (.neko/.waifu…)', url: 'https://api.princetechn.com/api/anime/neko?apikey=prince', expect: 'json' },
  { group: 'APIs de terceros', service: 'shizo (.flirt)', url: 'https://api.shizo.top/quote/flirt?apikey=shizo', expect: 'json' },
  { group: 'APIs de terceros', service: 'dv-yer (.apk)', url: 'https://dv-yer-api.online/apksearch?q=whatsapp&limit=1&lang=es', expect: 'json' },
  { group: 'APIs de terceros', service: 'dv-yer (.cuevana)', url: 'https://dv-yer-api.online/cuevana?mode=search&q=avatar&limit=1&type=auto', expect: 'json' },

  // --- Descargas ---
  { group: 'Descargas', service: 'scraping YouTubeDownloader (yt-dlp)', url: 'BINARY:yt-dlp --version', expect: 'any', note: 'binario local' },
  { group: 'Descargas', service: 'scraping Pinterest (página)', url: 'https://www.pinterest.com/', expect: 'html' },
  { group: 'Descargas', service: 'scraping Mediafire', url: 'https://www.mediafire.com/', expect: 'html' },
  { group: 'Descargas', service: 'Mega (megajs)', url: 'https://mega.nz/', expect: 'any' },
  { group: 'Descargas', service: 'GitHub codeload (.gitclon)', url: 'https://codeload.github.com/github/gitignore/zip/refs/heads/main', method: 'HEAD', expect: 'any' },

  // --- Búsqueda web ---
  { group: 'Búsqueda', service: 'DuckDuckGo scraping (.buscar)', url: 'https://lite.duckduckgo.com/lite/?q=test', expect: 'html' },
  { group: 'Búsqueda', service: 'Google (scraping .google)', url: 'https://www.google.com/search?q=test', expect: 'html' },
  { group: 'Búsqueda', service: 'GitHub API (.githubsearch)', url: 'https://api.github.com/search/repositories?q=baileys&per_page=1', expect: 'json' },

  // --- IA ---
  { group: 'IA', service: 'Groq (chat/traducción/whisper)', url: 'https://api.groq.com/openai/v1/models', expect: 'key-required', note: 'sin GROQ_API_KEY en .env' },
  { group: 'IA', service: 'DeepAI toonify (.toanime)', url: 'https://api.deepai.org/api/toonify', expect: 'key-required', note: 'DEEPAI_API_KEY' },
  { group: 'IA', service: 'ImgBB upload (.enhance/.upscale)', url: 'https://api.imgbb.com/1/upload', expect: 'key-required', note: 'IMGBB_API_KEY' },

  // --- Traducción / TTS ---
  { group: 'Traducción/TTS', service: 'MyMemory (.tsimple)', url: 'https://api.mymemory.translated.net/get?q=hello&langpair=en|es', expect: 'json' },
  { group: 'Traducción/TTS', service: 'laurine TTS (.tts)', url: 'https://www.laurine.site/api/tts/tts-nova?text=hola', expect: 'any' },
  { group: 'Traducción/TTS', service: 'ttsmp3 (fallback .tts)', url: 'https://ttsmp3.com/', expect: 'any' },

  // --- Utilidades ---
  { group: 'Utilidades', service: 'Open-Meteo geocoding (.clima)', url: 'https://geocoding-api.open-meteo.com/v1/search?name=Madrid&count=1', expect: 'json' },
  { group: 'Utilidades', service: 'Open-Meteo forecast (.clima)', url: 'https://api.open-meteo.com/v1/forecast?latitude=40.4&longitude=-3.7&current=temperature_2m', expect: 'json' },
  { group: 'Utilidades', service: 'Frankfurter (.moneda)', url: 'https://api.frankfurter.app/latest?from=USD&to=EUR', expect: 'json' },
  { group: 'Utilidades', service: 'CoinGecko (.moneda crypto)', url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', expect: 'json' },
  { group: 'Utilidades', service: 'NewsData (.noticias)', url: 'https://newsdata.io/api/1/news?apikey=missing&language=es', expect: 'key-required', note: 'NEWS_API_KEY' },
  { group: 'Utilidades', service: 'Pexels (.imagen)', url: 'https://api.pexels.com/v1/search?query=cat&per_page=1', expect: 'key-required', note: 'PEXELS_API_KEY' },
  { group: 'Utilidades', service: 'Pixabay (.imagen)', url: 'https://pixabay.com/api/?key=missing&q=cat', expect: 'key-required', note: 'PIXABAY_API_KEY' },
  { group: 'Utilidades', service: 'Picsum (.imagen fallback)', url: 'https://picsum.photos/seed/test/200/200', method: 'HEAD', expect: 'image' },
  { group: 'Utilidades', service: 'qrserver (.qr)', url: 'https://api.qrserver.com/v1/create-qr-code/?data=test&size=150x150', expect: 'image' },
  { group: 'Utilidades', service: 'TinyURL (.acortar)', url: 'https://tinyurl.com/api-create.php?url=https://github.com', expect: 'any' },
  { group: 'Utilidades', service: 'uselessfacts (welcome)', url: 'https://uselessfacts.jsph.pl/api/v2/facts/random', expect: 'json' },

  // --- Fallbacks de recomendaciones ---
  { group: 'Fallbacks', service: 'Jikan (fallback .anime)', url: 'https://api.jikan.moe/v4/top/anime?limit=1', expect: 'json' },
  { group: 'Fallbacks', service: 'TMDB (fallback .pelicula)', url: 'https://api.themoviedb.org/3/movie/550', expect: 'key-required', note: 'TMDB_API_KEY' },
  { group: 'Fallbacks', service: 'jokes.one (fallback .chiste)', url: 'https://api.jokes.one/joke', expect: 'json' },
  { group: 'Fallbacks', service: 'Wikipedia REST (.wikipedia)', url: 'https://es.wikipedia.org/api/rest_v1/page/summary/Bot', expect: 'json' },
  { group: 'Fallbacks', service: 'dictionaryapi (.wikipedia)', url: 'https://api.dictionaryapi.dev/api/v2/entries/en/hello', expect: 'json' },

  // --- Speedtest ---
  { group: 'Speedtest', service: 'Cloudflare trace (.speedtest)', url: 'https://1.1.1.1/cdn-cgi/trace', expect: 'any' },
  { group: 'Speedtest', service: 'Cachefly (.speedtest)', url: 'https://cachefly.cachefly.net/100mb.test', method: 'HEAD', expect: 'any' },

  // --- Binarios locales (ffmpeg para stickers/audio) ---
  { group: 'Binarios locales', service: 'ffmpeg (stickers/audio)', url: 'BINARY:ffmpeg -version', expect: 'any', note: 'binario local' },
];

interface Result {
  group: string;
  service: string;
  ok: boolean;
  status: number | string;
  latencyMs: number;
  detail: string;
}

async function runProbe(p: Probe): Promise<Result> {
  const start = Date.now();
  const done = (ok: boolean, status: number | string, detail: string): Result => ({
    group: p.group, service: p.service, ok, status, latencyMs: Date.now() - start, detail,
  });
  try {
    if (p.url.startsWith('BINARY:')) {
      const cmd = p.url.slice(7);
      const [bin, ...args] = cmd.split(' ');
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const out = await promisify(execFile)(bin, args, { timeout: 15000 });
      return done(true, 0, (out.stdout || '').trim().split('\n')[0].slice(0, 60));
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(p.url, {
      method: p.method ?? 'GET',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) OrbitBot-ApiTest/1.0', ...(p.body ? { 'content-type': 'application/json' } : {}) },
      body: p.body ? JSON.stringify(p.body) : undefined,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ct = res.headers.get('content-type') ?? '';
    if (p.expect === 'key-required') {
      const needsKey = [401, 402, 403].includes(res.status) || res.status === 400;
      return done(res.status < 500, res.status, needsKey ? `requiere API key (${p.note})` : `responde ${res.status}`);
    }
    if (p.method === 'HEAD') {
      return done(res.ok, res.status, ct.slice(0, 40) || 'sin body');
    }
    if (!res.ok) {
      return done(false, res.status, `HTTP ${res.status} ${ct.slice(0, 30)}`);
    }
    let verdict = '';
    if (p.expect === 'json') {
      const text = await res.text();
      try { JSON.parse(text); verdict = `json válido, ${text.length}B`; } catch { return done(false, res.status, 'respuesta no es JSON'); }
    } else if (p.expect === 'image') {
      const buf = await res.arrayBuffer();
      const isImg = ct.startsWith('image/') || (buf.byteLength > 1000 && !ct.includes('json') && !ct.includes('text'));
      verdict = isImg ? `imagen ${ct.split(';')[0]} ${(buf.byteLength / 1024).toFixed(1)}KB` : `NO imagen: ${ct.slice(0, 30)}`;
      if (!isImg) return done(false, res.status, verdict);
    } else if (p.expect === 'html') {
      const text = await res.text();
      const isHtml = ct.includes('html') || text.slice(0, 200).toLowerCase().includes('<!doctype') || text.slice(0, 200).includes('<html');
      verdict = isHtml ? `html ${text.length}B` : `NO html: ${ct.slice(0, 30)}`;
      if (!isHtml) return done(false, res.status, verdict);
    } else {
      const buf = await res.arrayBuffer();
      verdict = `${res.status} ${ct.split(';')[0] || 'sin ct'} ${(buf.byteLength / 1024).toFixed(1)}KB`;
    }
    return done(true, res.status, verdict);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return done(false, 'ERR', msg.includes('abort') ? 'timeout 20s' : msg.slice(0, 60));
  }
}

async function main(): Promise<void> {
  console.log(`Probando ${probes.length} servicios externos...\n`);
  const results: Result[] = [];
  for (const p of probes) {
    const r = await runProbe(p);
    results.push(r);
    const mark = r.ok ? 'OK  ' : 'FAIL';
    console.log(`${mark} [${r.latencyMs}ms] ${r.group} · ${r.service} → ${r.status} ${r.detail}`);
  }
  writeFileSync('/tmp/opencode/api-test-results.json', JSON.stringify(results, null, 2));
  const okCount = results.filter(r => r.ok).length;
  console.log(`\n${okCount}/${results.length} servicios operativos`);
}

main();
