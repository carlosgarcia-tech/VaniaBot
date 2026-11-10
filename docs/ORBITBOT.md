# OrbitBot — Guía técnica completa

> Documentación generada desde el código fuente (noviembre 2026). Bot de WhatsApp construido con **Node.js + TypeScript + Baileys**.

---

## 1. Arquitectura general

```
npm start            → tsx src/orbit.ts   (supervisor: modo QR/pairing, reinicios, shutdown graceful)
npm run dev          → tsx watch src/index.ts   (sin supervisor, banner en index.ts)
```

**Orden de arranque de `src/index.ts`:**
1. `databaseSwitcher.initialize()` → decide Redis (solo Docker) o SQLite.
2. `initializeDatabase()` → SQLite `./storage/database/orbit.db`.
3. `subBotDatabase.initialize()` → carga slots y settings de subbots.
4. `new WhatsAppClient()` → registra servicios, plugins y comandos.
5. `panelServer.start()` → **el panel se levanta ANTES de conectar a WhatsApp**, para que el dashboard nunca dependa de la conexión (QR/pairing pueden tardar).
6. `client.initialize()` → conexión de Baileys del bot principal → dentro se lanza `subBotManager.initialize()` (relanza los subbots activos).

**Procesamiento de mensajes (`src/core/MainMessagePipeline.ts`):**
- Dos colas con concurrencia controlada (`RealTimeMessageProcessor`): **secuencial** (FIFO estricto, para comandos que mutan estado: economía, moderación) y **paralela** (cap 5, para lecturas y descargas de media).
- Cada comando tiene `cooldown` opcional y `timeout` (default 30s; los comandos de descarga de media usan 180s). El timeout es **soft**: el pipeline deja de esperar pero el comando sigue en background y entrega su resultado igual.
- Cadenas de middlewares: AutoRegister → Mute → Logger → Validation → Permission → AntiSpam → Cooldown, más guards de grupo (antilink, antispam, orbit toggle…).

---

## 2. Comandos de stickers — cómo funcionan

### 2.1 Comandos que producen stickers

| Comando | Aliases | Qué hace | Archivo |
|---|---|---|---|
| `sticker` | `s` | Convierte imagen/video citado (o directo) en sticker webp | `src/commands/media/StickerCommand.ts` |
| `take` | `tomar`, `robarsticker` | Roba un sticker citado y cambia pack/author (`pack\|author`) | `src/commands/media/sticker/TakeCommand.ts` |
| `qc` | — | Sticker de cita con avatar y texto (máx 40 chars, `@user` menciona) | `src/commands/media/sticker/QcCommand.ts` |
| `patsticker` | `patmeme` | Meme de Patrick con texto (fondos `pat1..4.jpg`) | `src/commands/media/sticker/PatCommand.ts` |
| `nota` | `note` | Nota con texto sobre `nota.jpg` (Comic Sans, máx 20 palabras) | `src/commands/media/sticker/NotaCommand.ts` |
| `stickerrandom` | `stickerandom`, `randsticker`, `memesticker` | Meme aleatorio de Imgflip como sticker | `src/commands/fun/StickerRandomCommand.ts` |
| `brat` | — | Texto estilo "brat" como sticker | `src/commands/creative/canvas/BratCommand.ts` |
| `petgif` | — | GIF animado (pet the user) como sticker animado | `src/commands/creative/canvas/PetgifCommand.ts` |
| `attp` | — | Texto animado (letras con colores) como sticker webp | `src/commands/creative/canvas/ATTPCommand.ts` |
| `telegramsticker` | `tgsticker` | Pack de stickers de Telegram | `src/commands/media/download/TelegramStickerCommand.ts` |
| `stickerly` | — | Pack de stickers de Sticker.ly | `src/commands/media/download/StickerlyCommand.ts` |
| `stickerwiki` | — | Pack de stickers de StickerWiki | `src/commands/media/download/StickerWikiCommand.ts` |

Los comandos canvas (`delete`, `tweet`, `changemymind`, `rip`, `phub`, `xnxxcard`, etc.) envían **imagen** normalmente, y sticker solo si la API devuelve contenido animado (webm/gif).

### 2.2 Pipeline interno de conversión

```
mensaje (imagen/video citado o directo)
  → baileys downloadMediaMessage → buffer
  → StickerHelper (src/utils/StickerHelper.ts)  ← fachada; estampa pack/author "𝙊𝙧𝙗𝙞𝙩𝘽𝙤𝙩"
  → StickerService (src/services/media/StickerService.ts)
       imagen  → ffmpeg: scale 512×512 lanczos + pad transparente → webp q100
                 fallback: Jimp → ffmpeg → PNG sin convertir (cadena triple)
       video   → ffmpeg: 320×320 @ 15fps, transparencia (palettegen), -t 10s, loop 0, sin audio
  → addExif (node-webpmux): inserta sticker-pack-name / sticker-pack-publisher
  → ctx.sock.sendMessage(jid, { sticker: buffer })
```

Detalles clave:
- **Tamaño**: imágenes 512×512 con aspect ratio respetado y padding transparente; videos se reducen a 320×320 @ 15fps.
- **Videos**: ffmpeg recorta a 10s silenciosamente (no se valida la duración real del video entrante).
- **`!take`** no reconvierte nada: descarga el sticker citado y solo reescribe el EXIF con `node-webpmux`.
- **`!qc`**: primero intenta la API `https://bot.lyo.su/quote/generate` (avatar real vía `profilePictureUrl`); si falla, fallback 100% local: genera un SVG (gradiente + comillas + avatar/inicial), lo rasteriza con `@resvg/resvg-js` + `@napi-rs/canvas` (`src/utils/imageProcessor.ts`) y convierte a sticker.
- **`!patsticker` / `!nota`**: componen texto sobre assets locales con `ImageProcessor.compositeText` (cadena de fallbacks: ffmpeg `drawtext` → resvg+Jimp → canvas → imagen sin texto).
- **Packs externos** (`telegramsticker`, etc.): piden la URL del media a la API Delirius y envían `sticker: { url }` directamente — WhatsApp descarga el contenido, sin reconvertir en el bot.
- ⚠️ Todo depende de **ffmpeg binario** en el host; si no existe, la conversión de video falla sin fallback (solo imagen tiene fallback a Jimp).

---

## 3. Comandos con APIs y servicios externos

### 3.1 Descargas vía yt-dlp + ffmpeg (subproceso)

| Comando | Aliases | Plataforma | Archivo |
|---|---|---|---|
| `ytmp3` | `yta`, `ytaudio`, `play`, `playmp3` | YouTube audio (+ búsqueda `ytsearch1:`) | `src/commands/media/download/YtMp3Command.ts` |
| `ytmp4` | `ytv`, `ytvideo`, `video` | YouTube video | `src/commands/media/download/YtMp4Command.ts` |
| `tiktok` | `tt`, `tk` | TikTok | `src/commands/media/download/TiktokCommand.ts` |
| `instagram` | `ig`, `insta`, `reel` | Instagram | `src/commands/media/download/InstagramCommand.ts` |
| `facebook` | `fb`, `fbvideo` | Facebook | `src/commands/media/download/FacebookCommand.ts` |
| `twitter` | `tw`, `xvideo`, `xv` | Twitter/X | `src/commands/media/download/TwitterCommand.ts` |

Estos tienen `timeout = 180000` y `parallelizable = true` (se descargan en paralelo, sin bloquear el resto del bot, y nunca se "matan" por tardar: siguen en background).

### 3.2 Descargas vía scraping directo (axios)

| Comando | Aliases | Qué hace | Archivo |
|---|---|---|---|
| `pinterest` | `pin`, `pindl`, `pinterestdl` | Scraping de la página de Pinterest | `services/download/PinterestDownloader.ts` |
| `mediafire` | `mf`, `mediafiledl` | Scraping de mediafire.com | `services/download/MediafireDownloader.ts` |
| `mega` | `megadl` | Librería `megajs` | `services/download/MegaDownloader.ts` |
| `gitclon` | — | Zip directo de `codeload.github.com` | `src/commands/media/GitCloneCommand.ts` |
| `stickerrandom` | `stickerandom`, … | `api.imgflip.com/get_memes` | `src/commands/fun/StickerRandomCommand.ts` |

### 3.3 Descargas vía API Delirius (`https://api.delirius.store/download/*`)

| Comando | Aliases | Endpoint |
|---|---|---|
| `spotify` | `sp`, `spotdl`, `spotifydl` | `download/spotifydl` |
| `spotifyalbum` | `spalbum`, `sp-album` | `download/spotifyalbum` |
| `spotifyplaylist` | `spplaylist`, `sp-list` | `download/spotifyplaylist` |
| `spotifyinfo` | `spinfo` | `download/spotifyinfo` |
| `ytmp3v2` | — | `download/ytmp3v2` |
| `facebookv2` | `fbv2`, `fbvideo2` | `download/facebookv2` |
| `facebookphoto` | `fbphoto`, `fbpic` | `download/facebookphoto` |
| `snackvideo` | `snack`, `snackv` | `download/snackvideo` |
| `gitclone` | `ghclone`, `gitcl` | `download/gitclone` |
| `soundcloud` | `scdl` | `download/soundcloud` |
| `threads` | `thread` | `download/threads` |
| `xnxx`, `xvideos`, `pornhub` (`ph`) | — | `download/xnxx|xvideos|pornhub` |
| `gofile`, `imgur`, `pastebin` (`paste`) | — | gofile / imgur / pastebin |
| `stickerly`, `stickerwiki`, `telegramsticker`, `telegramstories` | — | stickerly / stickerwiki / t.me |

Archivos: `src/commands/media/download/*.ts` → `src/services/external/DownloadService.ts` / `DeliriusService.ts` (timeout 60s).

### 3.4 Búsquedas web

| Comando | Aliases | Fuente | Archivo |
|---|---|---|---|
| `buscar` | `search`, `g` | Scraping DuckDuckGo (lite/html) | `media/download/BuscarCommand.ts` |
| `google`, `gimage`, `ytsearch` (`yts`), `wiki`, `genius` (`letras`), `tenor` (`gif`), `npm`, `playstore`, `pinterestsrc`, `animesearch`, `mangasearch`, `movie`, `animeinfo`, `animeinfourl` | varias | Delirius `/search` y `/anime` | `src/commands/anime/delirius/search/*.ts` |
| `githubsearch` | `ghsearch`, `github` | `api.github.com/search/repositories` | `src/commands/media/GitHubSearchCommand.ts` |
| `wikipedia` | `wikipedia`, `wikipediab` | Wikipedia REST + dictionaryapi.dev | `src/commands/utility/tools/ExternalAPIsCommand.ts` |

### 3.5 Anime / NSFW / interacciones

| Grupo | Comandos | API |
|---|---|---|
| Imágenes anime random | `neko`, `megumin`, `waifu`, `randomanime`, `hneko`, `hwaifu`, `konachan`, `loli`, `milf` | `api.princetechn.com/api/anime/*` (con apikey) |
| Reacciones (GIFs) | `hug`, `pat`, `kiss`, `cry`, `dance`, `slap`, `bonk`, `bully`, … (con alias español: `abrazar`, `besar`…) | Delirius `/reactions` |
| NSFW | `hentai`, `anal`, `blowjob`, `yuri`, `nekonsfw`, … + `nhentai`, `hitomi`, `pixiv`, `rule34` | Delirius `/nsfw` |
| Random | `avataranime`, `cat` (`gato`), `foxgirl`, `maid`, `selfie`, `loremflickr` (`flickr`) | Delirius `/random` |

Archivo central: `src/commands/anime/AnimeCommand.ts` (+ `AnimeBase.ts`, `DeliriusAnimeBase.ts`).

### 3.6 IA y texto (Groq como proveedor principal)

| Comando | Aliases | Servicio | Qué hace |
|---|---|---|---|
| `ai` | `chat`, `orbit`, `ask` | Groq (`GROQ_API_KEY`) | Chat libre con IA |
| `poema` | `poem`, `verso` | Groq | Genera poesía |
| `amor` | `romance` | Groq | Cartas/frases románticas |
| `facto` | `facts` | Groq | Datos fríos |
| `anime` | `animerec` | Groq + fallback Jikan | Recomienda anime |
| `pelicula` | `pelis`, `cine` | Groq + fallback TMDB | Recomienda películas |
| `chiste` | `ch`, `joke` | Groq + fallback api.jokes.one | Chistes |
| `consejo`, `horoscopo`, `verdad` (`reto`) | — | Groq | Consejos / horóscopo / verdad-o-reto |
| `traductor` | — | Groq (TranslatorService) | Traduce texto |
| `transcribe` | — | Groq Whisper | Transcribe audios |
| `tsimple` | — | MyMemory API | Traducción simple sin IA |
| `toanime` | `toghibli` | DeepAI toonify | Foto → estilo anime |
| `enhance` / `upscale` | `hd` | ImgBB + Delirius `ia/*` | Mejora/escala imágenes |
| `flirt` | `pickup` | `api.shizo.top` | Frases de coqueteo |
| `mailcreate` / `mailmessages` | `tempemail` / `inbox` | Delirius `ia/*` | Email temporal y su bandeja |
| `tts` | `speak`, `hablar` | laurine.site + ttsmp3.com | Texto a voz |

Archivos: `src/commands/utility/ai/`, `src/commands/creative/`, `src/commands/fun/`, `src/commands/ia/` → `src/services/external/AIService.ts`.

### 3.7 Utilidades con APIs

| Comando | Aliases | API |
|---|---|---|
| `moneda` | `currency`, `crypto`, `convert` | Frankfurter + CoinGecko |
| `clima` | `weather`, `temperatura` | Open-Meteo (geocoding + forecast) |
| `noticias` | `news` | NewsData.io |
| `imagen` | `foto` | Pexels + Pixabay + Unsplash/Picsum |
| `qr` | `qrcode`, `genqr` | api.qrserver.com |
| `acortar` | `short`, `tinyurl` | TinyURL |
| `speedtest` | `test-speed` | Cloudflare/Hetzner/OVH/Cachefly |
| `wikipedia` | — | Wikipedia REST + dictionaryapi |
| ephoto360 (`1917`, `blackpink`, `neon`, `matrix`, `fire`, …) | — | `en.ephoto360.com` vía librería `mumaker` |
| Canvas (~35 comandos: `affect`, `bed`, `hitler`, `tweet`, `welcard`, `petgif`, `gay`…) | — | Delirius `/canvas` vía `CanvasService` |

### 3.8 Servicios externos del backend (no son comandos)

- `src/services/external/AIService.ts` — Groq: chat, traducción, Whisper.
- `src/services/external/DeliriusService.ts` / `DownloadService.ts` / `CanvasService.ts` — api.delirius.store.
- `src/services/external/FallbackAPIService.ts` — Jikan, TMDB, jokes.one.
- `src/services/external/ImageService.ts`, `NewsService.ts`, `WeatherService.ts`, `TTSService.ts`.
- `src/services/download/APKSearchService.ts`, `CuevanaService.ts` — `dv-yer-api.online` (con API key).
- `src/services/download/WebSearchService.ts` — scraping DuckDuckGo.
- `src/handlers/AudioResponseHandler.ts` — audios estáticos de `qu.ax` para respuestas IA en audio.
- Los GIFs de interacción usan CDNs estáticos (`telegra.ph`, `qu.ax`, `files.catbox.moe`).

### 3.9 Comandos solo-locales (sin internet)

Administración/moderación (ban, kick, antilink, anticall, welcome…), owner/sistema (eval, exec, restart, backup, metrics), economía/RPG (work, crime, shop, bank, top…), minijuegos (blackjack, slot, roulette, dice…), stickers locales (`sticker`, `take`, `nota`), ayuda/ping, quiz, resumirchat, etc.

---

## 4. SubBots — cómo funcionan

### 4.1 Concepto

Un **subbot** es otro número de WhatsApp (una segunda sesión de Baileys) operado por el mismo proceso del bot. Cada subbot tiene **su propia sesión y su propio socket**, pero comparte proceso, registro de comandos y base de datos con el bot principal.

**Archivos clave** (`src/services/subbot/`):
- `SubBotManager.ts` — singleton `subBotManager`: ciclo de vida, health check cada 2 min, sincronización de settings cada 60s.
- `SubBotInstance.ts` — una instancia por slot: socket propio, reconexión (conflicto 440 → reintento; logout 401 solo tras 2 confirmaciones), pairing code automático.
- `SubBotMessageHandler.ts` — procesa los mensajes de cada subbot.
- `SubBotDatabase.ts` — capa sobre la DB principal para slots/settings (con caché en memoria).
- `EncryptedAuthState.ts` — si `SESSION_ENCRYPTION_KEY` está definida, cifra las sesiones de subbots con AES-256-GCM (la sesión del bot principal **no** se cifra).
- `SubBotRuntimeStore.ts` — snapshot JSON por subbot en `data/runtime/bot-states/<botId>.json` (dedup, caché de contactos), escritura atómica.

### 4.2 Creación (comando)

`.subbot` (alias `serbot`, `addbot`) — `src/commands/owner/subbot/SubBotCommand.ts`:

- **Usuario**: `.subbot <numero>` pide un slot libre y vincula su número (si `publicRequests` está activado; el owner lo alterna con `.subboton` / `.subbotoff`).
- **Owner**: `.subbot <slot> <numero>` (slot específico), `.subbot info|reconectar|liberar|reset <slot>`, `.subbots` (listado), `.reconbot` (reconecta su propio subbot).
- Flujo: slot libre → `reserved` → se genera `botId` (random hex) y nombre `OrbitBot-<owner>` → `pending` → se lanza la instancia → Baileys emite **pairing code** → el manager lo envía al owner por WhatsApp **con el socket del bot principal** → al conectar, slot `connected`.

### 4.3 Sesiones y almacenamiento por subbot

| Dato | Dónde vive |
|---|---|
| Creds Baileys del subbot | `./data/subbot-sessions/<botId>/` (local) o `/app/subbot-sessions` (Docker); override con `SUBBOT_SESSIONS_PATH` |
| Snapshot runtime (dedup, cachés) | `./data/runtime/bot-states/<botId>.json` |
| Config de slots/settings | Tabla `subbot_slots` + `subbot_settings` en la **DB principal** |

**No hay una DB separada para subbots**: todos los datos van al mismo `orbit.db` (ver §5). Lo único físico por subbot es su carpeta de sesión y su JSON de runtime.

### 4.4 Procesamiento de mensajes

- El bot principal usa `MainMessagePipeline` (completo: antilink, antidelete, resúmenes, PIN, MediaGroupBuffer).
- Los subbots usan `SubBotMessageHandler` con su propia cadena de middlewares (mismos pasos, un `AntiSpamService` por instancia).
- Ejecutan **prácticamente todos los comandos del `commandRegistry` global** (mismo catálogo que el principal), con `MessageContext` marcado como `subbot<slot>`.
- Filtros propios:
  - Los toggles del bot principal (`orbiton/orbitoff/orbitstatus`) sin argumento se ignoran en subbots.
  - En grupos, el usuario debe activar el bot para ese subbot concreto con `.orbiton` (tabla `orbit_toggle`, por `chatJid` + `botId`).
  - Dedup en memoria por instancia (TTL 60s) + ledger durable `processed_messages` en SQLite.
- `handleGroupUpdate`: bienvenidas/despedidas y AntiArab.

### 4.5 Ciclo de vida de un slot

```
free → reserved → pending → linking → connected
                  ↘ disconnected (espera .reconbot / .subbot reconectar)
```

- 50 slots numerados (`MAX_SLOTS_LIMIT = 50`); límite efectivo tunable en runtime vía `subBotDatabase.setMaxSlots()` (tabla `subbot_settings`, default del código 10).
- Al reiniciar el bot principal, `SubBotManager.initialize()` relanza automáticamente los slots `connected`/`linking`; los `disconnected` requieren acción manual.
- `recoverOrphanedSessions()` limpia carpetas de sesión sin slot asociado; el health check resetea estados `linking`/`pending` estancados >5 min.
- El panel web expone los slots vía `SlotRouter` (teléfono enmascarado, owner omitido).

---

## 5. Bases de datos

### 5.1 Motor y archivo

- **SQLite vía `sql.js` (WebAssembly)**, en memoria, volcada a disco — no es better-sqlite3.
- Archivo único: **`./storage/database/orbit.db`** (`DB_PATH`).
- Autosave cada 30s si hubo cambios + `forceSave()`; guardado atómico (tmp + rename).
- Migraciones append-only en tabla `_migrations` (versiones 1–24), `src/repositories/Database.ts`.

### 5.2 ¿Bot principal y subbots comparten DB?

**Sí — una sola `orbit.db` para todo el sistema.** `SubBotDatabase` usa el mismo `getDatabase()`. La separación por subbot es lógica (columna `bot_id`, `slot_number`, `subbot<N>` como `botId` en toggles), no física.

### 5.3 Tablas principales

| Tabla | Qué guarda |
|---|---|
| `subbot_slots` | Sistema de slots: número, bot_id, owner, teléfono, nombre, status, timestamps, bio/foto |
| `subbot_settings` | `maxSlots`, `publicRequests` |
| `subbots` | Registro legacy de subbots (los activos viven en `subbot_slots`) |
| `users` | Usuarios y economía: jid, nombre, ban, level/xp/money/bank, daily, inventory (JSON), achievements (JSON en columna TEXT), RPG, pets, premium, streaks |
| `groups` | Config por grupo (welcome, antilink, niveles, economía…) |
| `orbit_toggle` | Por (chatJid, botId): si el bot principal o `subbot<N>` está activado en ese chat |
| `processed_messages` | Ledger durable de mensajes ya procesados (por `message_id` + `bot_id`) |
| `bot_runtime_state` | Salud por bot: heartbeat, conexión, reconexiones, memoria, latencia, `last_startup_at` |
| `cooldowns`, `locks`, `jobs` | Cooldowns de comandos, locks, cola de trabajos |
| `anticall_config` / `anticall_blocked_users` | Anti-llamadas |
| `health_events`, `orchestrator_state` | Eventos de salud y estado del orquestador |
| `reports`, `reminders`, `polls`, `listas` | Reportes, recordatorios, encuestas, listas |
| `mutes`, `bans`, `moderation_logs`, `ai_sessions` | Moderación y sesiones de IA |

Los logros (achievements) **no tienen tabla propia**: viven como JSON dentro de la columna de `users` (los gestiona `AchievementService`).

### 5.4 `DatabaseSwitcher`

`src/services/system/DatabaseSwitcher.ts` — **no cambia el motor de datos**: SQLite es siempre la fuente de verdad. Solo intenta conectar **Redis como caché** si `DOCKER_MODE=true` **y** `USE_REDIS=true` (probando `orbit-redis`, `redis`, `localhost:6379` o `REDIS_URL`); si falla tras 3 reintentos, fallback silencioso a SQLite. Variables: `USE_REDIS` (default false), `REDIS_URL/HOST/PORT`, `DB_PATH`.

### 5.5 Mapa de persistencia en disco

```
storage/database/orbit.db          ← TODO el estado (principal + subbots)
orbitsession/                      ← sesión Baileys del bot principal (SESSION_PATH)
data/subbot-sessions/<botId>/      ← sesión Baileys de cada subbot (cifrable con SESSION_ENCRYPTION_KEY)
data/runtime/bot-states/<botId>.json ← snapshot runtime de cada subbot
data/.orbit-session                ← flag de arranque (banner/supervisor)
data/assets/                       ← logos, fondos para stickers, reglas, etc.
```

---

## 6. Panel web y arranque

- Panel: `panel/index.html` servido por `PanelServer` (`src/services/webhook/PanelServer.ts`) en `http://localhost:3000` (fallback 3001). Log al arrancar: `🌌 OrbitBot Panel listening on http://localhost:<puerto>`.
- Autenticación por token (`PANEL_WEBHOOK_TOKEN` en `.env`), gate overlay en el navegador.
- **Auto-refresh**: polls cada 30s a `/api/stats` (+ métricas, comandos, salud, logs, slots, grupos). Refresco manual con el botón Refresh.
- En `npm run dev` el banner CLI se dibuja en el primer arranque de la sesión (flag `data/.orbit-session`); el progreso por etapas aparece en dev y Docker.
- Supervisión de reinicios (`orbit.ts`): máx 5 reinicios rápidos en 120s, delay incremental hasta 30s, pausa forzada de 60s ante flood.

### Variables de entorno relevantes

| Variable | Uso |
|---|---|
| `SESSION_PATH` | Sesión del bot principal (default `./orbitsession`) |
| `SESSION_ENCRYPTION_KEY` | Cifra las sesiones de **subbots** (AES-256-GCM) |
| `SUBBOT_SESSIONS_PATH` / `DOCKER_MODE` | Ruta de sesiones de subbots |
| `USE_PAIRING_CODE`, `PHONE_NUMBER` | Modo de vinculación del bot principal |
| `DB_PATH`, `USE_REDIS`, `REDIS_URL/HOST/PORT` | Persistencia y caché |
| `GROQ_API_KEY` | IA (chat, traducción, Whisper) |
| `PANEL_WEBHOOK_TOKEN`, `PANEL_DISABLED` | Panel web |
| `MAX_SLOTS` | **No existe como env** — es constante de motor (50) + valor en `subbot_settings` |
