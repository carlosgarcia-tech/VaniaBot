# OrbitBot — Auditoría de APIs externas y plan de migración local

> Fecha: 10 nov 2026 · Ejecutado con `scripts/test-external-apis.ts` (49 sondas, timeout 20s, validación por tipo de respuesta: JSON / imagen / HTML / binario).
> Verificación cruzada con `curl` para distinguir caída real del servicio vs. problemas de red del entorno de prueba.

---

## 1. Resumen ejecutivo

| Resultado | Cuenta |
|---|---|
| ✅ Operativos (respuesta válida) | **31** |
| 🔑 Alcanzables pero requieren API key (no configurada en `.env`) | 7 |
| ❌ Caídos / DNS muertos | **11** |

**⚠️ Hallazgo crítico: la API central `api.delirius.store` está MUERTA** (su dominio no resuelve en DNS público — verificado contra 1.1.1.1). De ella dependen **más de 50 comandos**: todo el módulo canvas, búsquedas, anime/NSFW/reacciones, y ~15 variantes de descarga (spotify, xnxx, xvideos, stickerly, gitclone, ytmp3v2…). **Esos comandos fallan ahora mismo en producción.**

### Servicios confirmados muertos

| Servicio | Comandos afectados | Diagnóstico |
|---|---|---|
| `api.delirius.store` | ~50+ (canvas, search, anime, nsfw, reactions, random, ia, download) | DNS sin registro — dominio muerto |
| `bot.lyo.su` (quote generator) | `.qc` | DNS muerto — **ya tiene fallback 100% local (SVG)** ✅ |
| `dv-yer-api.online` | `.apk`, `.cuevana` | DNS muerto |
| `api.princetechn.com` | `.neko`, `.waifu`, `.megumin`, `.milf`, … | TLS "unrecognized name" — ya no sirve esa API |
| `api.shizo.top` | `.flirt` | Resuelve pero no contesta |
| `www.laurine.site` (TTS primario) | `.tts` | Conexión rechazada — **fallback ttsmp3 vivo** ✅ |
| `api.jikan.moe` | fallback de `.anime` | TCP no conecta (temporeralmente caída) |
| `api.jokes.one` | fallback de `.chiste` | HTTP 500 |

---

## 2. Resultados detallados del test

### Delirius (multi-servicio) — ❌ TODO MUERTO
| Sonda | Estado | Detalle |
|---|---|---|
| canvas/brat (`.brat`) | ❌ | fetch failed (DNS muerto) |
| search/spotify | ❌ | fetch failed (DNS muerto) |
| random (avataranime…) | ❌ | fetch failed (DNS muerto) |
| reactions (.hug…) | ❌ | fetch failed (DNS muerto) |
| nsfw | ❌ | fetch failed (DNS muerto) |
| ia/mailcreate | ❌ | fetch failed (DNS muerto) |

### Stickers / Creative
| Sonda | Estado | Latencia | Detalle |
|---|---|---|---|
| imgflip (`.stickerrandom`) | ✅ | 438ms | JSON válido |
| ephoto360 vía mumaker (17 comandos de texto) | ✅ | 1.4s | HTML 200 |
| qu.ax (GIFs interacción) | ✅ | 2.1s | 200 |
| telegra.ph (GIFs interacción) | ✅ | 1.6s | 200 |
| catbox.moe (GIFs interacción) | ✅ | 1.4s | video/mp4 |
| bot.lyo.su (`.qc`) | ❌ | — | DNS muerto → **fallback local SVG ya lo cubre** |

### APIs de terceros (riesgo alto) — ❌ TODAS MUERTAS
| Sonda | Estado | Detalle |
|---|---|---|
| princetechn (`.neko`…) | ❌ | TLS "unrecognized name" |
| shizo (`.flirt`) | ❌ | sin respuesta |
| dv-yer (`.apk`) | ❌ | DNS muerto |
| dv-yer (`.cuevana`) | ❌ | DNS muerto |

### Descargas / scraping
| Sonda | Estado | Latencia | Detalle |
|---|---|---|---|
| yt-dlp (binario, `.ytmp3/.ytmp4/.tiktok/…`) | ✅ | 471ms | versión 2026.08.19 |
| ffmpeg (binario, stickers/audio) | ✅ | 199ms | versión 7.1.5 |
| Pinterest scraping (`.pinterest`) | ✅ | 2.3s | HTML |
| Mediafire scraping (`.mediafire`) | ✅ | 411ms | HTML |
| Mega / megajs (`.mega`) | ✅ | 985ms | 200 |
| codeload.github.com (`.gitclon`) | ✅ | 496ms | zip |

### Búsqueda web
| Sonda | Estado | Detalle |
|---|---|---|
| DuckDuckGo scraping (`.buscar`) | ✅ | 202 |
| Google scraping (`.google`) | ❌ | 429 Too Many Requests (rate limit del entorno de prueba; puede funcionar con menos frecuencia) |
| GitHub API (`.githubsearch`) | ✅ | JSON |

### IA / Traducción / TTS
| Sonda | Estado | Detalle |
|---|---|---|
| Groq (`ai`, `traductor`, `transcribe`) | 🔑 | Requiere `GROQ_API_KEY` — **no configurada** |
| DeepAI toonify (`.toanime`) | 🔑 | Requiere `DEEPAI_API_KEY` |
| ImgBB (`.enhance`, `.upscale`) | 🔑 | Requiere `IMGBB_API_KEY` |
| MyMemory (`.tsimple`) | ✅ | JSON |
| laurine TTS (`.tts` primario) | ❌ | Conexión rechazada → **fallback ttsmp3 vivo** |
| ttsmp3 (`.tts` fallback) | ✅ | 200 |

### Utilidades
| Sonda | Estado | Detalle |
|---|---|---|
| Open-Meteo geocoding (`.clima`) | ✅* | Verificado por curl (Node fetch falló por entorno local) |
| Open-Meteo forecast (`.clima`) | ✅ | JSON |
| Frankfurter (`.moneda`) | ✅ | JSON |
| CoinGecko (`.moneda crypto`) | ✅ | JSON |
| NewsData (`.noticias`) | 🔑 | Requiere `NEWS_API_KEY` |
| Pexels (`.imagen`) | 🔑 | Requiere `PEXELS_API_KEY` |
| Pixabay (`.imagen`) | 🔑 | Requiere `PIXABAY_API_KEY` |
| Picsum (`.imagen` último fallback) | ✅ | GET 200 (HEAD devuelve 405) |
| qrserver (`.qr`) | ✅ | PNG |
| TinyURL (`.acortar`) | ✅ | 200 |
| uselessfacts (welcome) | ✅ | JSON |

### Fallbacks / recomendaciones / speedtest
| Sonda | Estado | Detalle |
|---|---|---|
| Jikan (fallback `.anime`) | ❌ | TCP no conecta (temporeral) |
| TMDB (fallback `.pelicula`) | 🔑 | Requiere `TMDB_API_KEY` |
| jokes.one (fallback `.chiste`) | ❌ | HTTP 500 |
| Wikipedia REST (`.wikipedia`) | ✅ | JSON |
| dictionaryapi (`.wikipedia`) | ✅ | JSON |
| Cloudflare trace (`.speedtest`) | ✅ | 200 |
| Cachefly (`.speedtest`) | ✅ | 200 |

### Alternativas evaluadas como candidatos de migración
| API | Estado | Uso potencial |
|---|---|---|
| `nekos.best` (waifu + GIFs reacciones) | ✅ 200 | Reemplazo de anime random + interacciones de Delirius |
| `popcat.xyz` (pickuplines) | ✅ 200 (lento ~5s) | Parcial |
| `waifu.pics` / `waifu.im` / `popcat brat` / `luminai` / `caliph` | ❌ | Descartados en esta prueba |

---

## 3. Inventario completo: comando → API externa

### 3.1 Bloque muerto por Delirius (prioridad 1 de migración)

| Comando | Aliases | Endpoint Delirius | Qué hace |
|---|---|---|---|
| `spotify` | `sp`, `spotdl`, `spotifydl` | `download/spotifydl` | Descarga track como MP3 |
| `spotifyalbum` / `spotifyplaylist` | `spalbum` / `spplaylist` | `download/spotifyalbum\|playlist` | Descarga álbum/playlist |
| `spotifyinfo` | `spinfo` | `download/spotifyinfo` | Info de track |
| `ytmp3v2` | — | `download/ytmp3v2` | Audio de YouTube (variante API) |
| `facebookv2` / `facebookphoto` | `fbv2` / `fbphoto` | `download/facebookv2\|photo` | Video/foto de Facebook |
| `snackvideo` | `snack` | `download/snackvideo` | Video de SnackVideo |
| `gitclone` | `ghclone` | `download/gitclone` | Repo como zip |
| `soundcloud` | `scdl` | `download/soundcloud` | Audio de SoundCloud |
| `threads` | `thread` | `download/threads` | Media de Threads |
| `xnxx`, `xvideos`, `pornhub` | `ph` | `download/*` | Video adulto |
| `gofile`, `imgur`, `pastebin` | `paste` | `download/*` | Archivos/imagen/texto |
| `stickerly`, `stickerwiki`, `telegramsticker`, `telegramstories` | `tgsticker` | `download/*` | Packs de stickers / stories |
| `brat` | — | `canvas/brat` | Texto estilo brat → sticker |
| ~35 comandos canvas | `affect`, `bed`, `hitler`, `tweet`, `changemymind`, `rip`, `phub`, `welcard`, `petgif`, `attp`, `ttp`, `quote`, `gay`, `ship`… | `canvas/*` | Memes/imágenes generadas |
| `google`, `gimage`, `ytsearch`, `wiki`, `genius`, `tenor`, `npm`, `playstore`, `pinterestsrc`, `animesearch`, `mangasearch`, `movie` | varios | `search/*` | Búsquedas |
| `hug`, `pat`, `kiss`, `cry`, `slap`… (35 reacciones) | alias español | `reactions/*` | GIFs de interacción |
| `neko`, `foxgirl`, `maid`, `selfie`…, anime/NSFW (`hentai`, `waifu`, `hneko`…, `nhentai`, `rule34`…) | varios | `random\|anime\|nsfw/*` | Imágenes/GIFs |
| `enhance`, `upscale`, `mailcreate`, `mailmessages` | `hd`, `tempemail` | `ia/*` | Mejora de imagen / email temporal |

*(Archivo por comando en `src/commands/media/download/`, `src/commands/creative/canvas/`, `src/commands/anime/`, `src/commands/ia/`; servicios en `src/services/external/DeliriusService.ts`, `DownloadService.ts`, `CanvasService.ts`.)*

### 3.2 Bloque muerto por APIs de terceros

| Comando | Aliases | API muerta | Qué hace |
|---|---|---|---|
| `.apk` | `app`, `apksearch` | `dv-yer-api.online/apksearch` | Busca APKs |
| `.cuevana` | `cv`, `serie` | `dv-yer-api.online/cuevana` | Busca/descarga pelis y series |
| `.neko`, `.megumin`, `.waifu`, `.randomanime`, `.hneko`, `.hwaifu`, `.konachan`, `.loli`, `.milf` | varios | `api.princetechn.com/api/anime/*` | Imágenes anime random |
| `.flirt` | `pickup`, `coquetear` | `api.shizo.top/quote/flirt` | Frases de coqueteo |

### 3.3 Comandos con APIs vivas (sin acción urgente)

| Comando | Aliases | API | Estado |
|---|---|---|---|
| `ytmp3` (`play`), `ytmp4`, `tiktok`, `instagram`, `facebook`, `twitter` | `yta/play`, `ytv`, `tt`, `ig`, `fb`, `tw` | **yt-dlp local** (binario) | ✅ |
| `pinterest`, `mediafire`, `mega`, `gitclon` | `pin`, `mf`, `megadl` | Scraping directo / megajs | ✅ |
| `githubsearch` | `ghsearch` | api.github.com | ✅ |
| `buscar` | `search`, `g` | Scraping DuckDuckGo | ✅ |
| `stickerrandom` | `randsticker` | api.imgflip.com | ✅ |
| `tsimple` | — | MyMemory | ✅ |
| `tts` | `speak`, `hablar` | laurine ❌ → **ttsmp3 ✅** (fallback ya activo) | ✅ parcial |
| `clima` | `weather` | Open-Meteo | ✅ |
| `moneda` | `currency`, `crypto` | Frankfurter + CoinGecko | ✅ |
| `imagen` | `foto` | Pexels/Pixabay 🔑 → Picsum ✅ (último fallback) | ✅ parcial |
| `qr` | `qrcode` | api.qrserver.com | ✅ |
| `acortar` | `short` | TinyURL | ✅ |
| `wikipedia` | — | Wikipedia REST + dictionaryapi | ✅ |
| `qc` | — | bot.lyo.su ❌ → **SVG local ✅** (fallback ya activo) | ✅ |
| `speedtest` | — | Cloudflare/Cachefly/OVH | ✅ |
| welcome/goodbye | — | uselessfacts.jsph.pl | ✅ |
| GIFs de interacción (CDNs estáticos) | — | qu.ax / telegra.ph / catbox | ✅ |

### 3.4 Comandos que requieren API key (no configurada)

| Comando | API | Variable necesaria |
|---|---|---|
| `ai`, `traductor`, `transcribe`, `poema`, `amor`, `facto`, `consejo`, `horoscopo`, `verdad` | Groq | `GROQ_API_KEY` |
| `toanime` | DeepAI | `DEEPAI_API_KEY` |
| `enhance`, `upscale` | ImgBB | `IMGBB_API_KEY` |
| `noticias` | NewsData.io | `NEWS_API_KEY` |
| `imagen` (primario) | Pexels / Pixabay | `PEXELS_API_KEY` / `PIXABAY_API_KEY` |
| `pelicula` (fallback) | TMDB | `TMDB_API_KEY` |

---

## 4. Plan de migración a integración local

> Objetivo: que el bot deje de depender de APIs de terceros que mueren sin aviso (como pasó con Delirius). Ordenado por impacto.

### P1 — Delirius canvas (~35 comandos) → **canvas 100% local con @napi-rs/canvas**
Ya existe infraestructura local probada: `ImageProcessor` (`src/utils/imageProcessor.ts`) + `@napi-rs/canvas` + ffmpeg que hoy usan `qc`-fallback, `nota` y `patsticker`. Los efectos (afect/bed/hitler/tweet/cmm/rip/welcard…) son composición de 2 avatares + texto sobre plantilla: se pueden replicar localmente con plantillas de fondo (como `nota.jpg`) sin API alguna. Esfuerzo: alto pero unificado (una clase `LocalCanvasService` con un método por efecto).

> **Progreso (10 nov 2026):** creado `src/services/external/LocalCanvasRenderer.ts` y conectado en `CanvasService.getResult` con prioridad local. **Migrados (13): `brat` (invertido: fondo blanco/letras negras), `ttp`, `circle`, `invert`, `changemymind`, `tweet`, `phub`, `xnxxcard`, `welcard`, `gaycard`, `gay`, `friendship`, `ship`** — todos renderizan 100% en la máquina con `@napi-rs/canvas`/Jimp, cero llamadas externas; verificados end-to-end y visualmente. Pendientes: efectos que requieren plantillas de foto real (`affect`, `bed`, `slap`, `bofetada`, `hitler`, `trash`, `simp`, `shit`, `facepalm`, `jokeoverhead`, `patrick`, `rip`, `delete`, `pokeview`, `book`), los animados (`petgif`, `attp`) y `createqr` (necesita librería QR local). Los endpoints aún no migrados siguen su path anterior.

### P1 — Delirius anime/reactions/random (~50 imágenes/GIFs) → **nekos.best + listas de CDN propias**
`nekos.best` está vivo (waifu + GIFs de hug/pat/kiss/…) y cubre reacciones e imágenes anime. Para lo que nekos no cubra, curar listas estáticas de GIFs (ya existe ese patrón en `InteractionCommand` con telegra.ph/catbox). El módulo NSFW queda deshabilitado o se apoya en las mismas listas.

### P2 — Delirius descargas (spotify/xnxx/stickerly/gitclone/…) → **consolidar todo en yt-dlp**
`yt-dlp` ya es el motor local de las 6 descargas principales y está vivo; soporta Spotify (con plugin), SoundCloud, Threads, TikTok, etc. nativamente. Las variantes `v2` de Delirius son redundantes: se pueden fusionar con los comandos primarios. Los packs de stickers (`stickerly`, `telegramsticker`) y `pastebin`/`imgur` requieren scrapers propios pequeños (scraping directo como ya hace `MediafireDownloader`).

### P2 — `.apk` y `.cuevana` → **scraper propio** (dv-yer muerto)
Reemplazar con scraping directo de apkpure.com y cuevana (mismo patrón `MediafireDownloader`), o deshabilitar los comandos.

### P3 — `.flirt` (shizo muerto) → **local**
Lista estática de frases en el código (60-100 frases), cero red. Trivial.

### P3 — `.tts` → **edge-tts/espeak-ng local** (opcional)
ttsmp3 fallback funciona; si quieres calidad tipo "nova", un binario local (`edge-tts` de Python o `espeak-ng`) elimina la dependencia.

### P4 — Texto ephoto360 (17 comandos) → **canvas local** (opcional)
Funciona hoy, pero es scraping frágil; los efectos son texto sobre plantilla, replicables con canvas como P1.

### Qué NO migrar (APIs públicas fiables, sin clave)
Open-Meteo, Frankfurter, CoinGecko, Wikipedia, dictionaryapi, GitHub API, TinyURL, qrserver, MyMemory, uselessfacts, Imgflip, cloudflare/cachefly (speedtest), y los CDNs de GIFs. Son APIs públicas gratuitas estables — mantener.

### IA
Groq **requiere** `GROQ_API_KEY` (hoy no está en `.env`): los comandos `ai`, `traductor`, `transcribe`, `poema`, etc. están sin servicio hasta configurarla. Alternativa local real: Ollama (pesado, otro servidor) — decisión del owner.

---

## 5. Cómo repetir el test

```bash
npx tsx scripts/test-external-apis.ts
```

- 49 sondas (todas las URLs base/endpoints del bot + binarios yt-dlp/ffmpeg), timeout 20s, ejecución secuencial.
- Valida la forma de la respuesta (JSON parseable, content-type de imagen, HTML) — no solo "responde 200".
- Los servicios con clave esperan 401/403/400 y se marcan 🔑 `key-required` (alcanzables pero sin credencial).
- Salida: tabla en consola + JSON en `/tmp/opencode/api-test-results.json`.
- Para distinguir "API muerta" de "problema de red del entorno", contrastar con `curl -sS -o /dev/null -w "%{http_code}" <url>` y `nslookup <host> 1.1.1.1`.
