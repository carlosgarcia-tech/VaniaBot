# APIs externas de OrbitBot — puertas, consumidores y estado

> **Levantado:** 17-nov-2026 · **Método:** DNS verificado vía Google DNS (`dns.google`), HTTP probado con `curl -4` desde la máquina de desarrollo (red local restrictiva: los hosts con DNS activo pero inalcanzables aquí quedan marcados «sin verificar» y deben probarse en el servidor).
>
> **Leyenda de estado:** 🟢 viva (verificada) · 🔴 muerta (verificada) · 🟡 DNS activo, acceso no verificable desde esta máquina · ⚠️ viva pero requiere API key

---

## 1. Resumen ejecutivo

| # | Proveedor | Base URL | Estado | Consumo | Impacto si muere |
|---|-----------|----------|--------|---------|------------------|
| 1 | **Delirius API** | `api.delirius.store` | 🔴 **MUERTA** (dominio `api.` sin registro A/AAAA en el mundo) | ~45 comandos | NSFW, búsqueda, descargas, canvas remoto, reacciones |
| 2 | **Prince Techn** | `api.princetechn.com` | 🔴 **MUERTA** (TLS *unrecognized name* — app Heroku eliminada) | 9 comandos anime | neko/waifu/hneko/loli/milf… |
| 3 | **Laurine TTS** | `www.laurine.site` | 🔴 **MUERTA** (dominio NXDOMAIN — expirado) | cadena TTS | primer eslabón de TTS |
| 4 | Open-Meteo (+geocoding) | `api.open-meteo.com` | 🟢 viva | 1 comando | clima |
| 5 | Jikan (MyAnimeList) | `api.jikan.moe` | 🔴 **MUERTA** (cierre público 1-oct-2026) → **migrada a AniList + Kitsu** en `FallbackAPIService` | anime info/top | info anime |
| 6 | TMDB | `api.themoviedb.org` | 🟢 responde (204 sin key) ⚠️ necesita `TMDB_API_KEY` | películas | películas |
| 7 | Newsdata.io | `newsdata.io` | 🟢 responde (401 sin key) ⚠️ necesita `NEWSDATA_API_KEY` | noticias | noticias |
| 8 | Pexels | `api.pexels.com` | 🟢 responde (401 sin key) ⚠️ `PEXELS_API_KEY` | imágenes | cadena de imágenes |
| 9 | Pixabay | `pixabay.com` | 🟢 responde (400 sin key) ⚠️ `PIXABAY_API_KEY` | imágenes | cadena de imágenes |
| 10 | TTSmp3 | `ttsmp3.com` | 🟢 viva | TTS (2º eslabón) | voz |
| 11 | DuckDuckGo HTML | `html.duckduckgo.com` | 🟢 viva (202) | búsqueda web | AiCommand |
| 12 | Wikipedia ES | `es.wikipedia.org` | 🟢 viva | wiki | WikiCommand |
| 13 | ephoto360 | `en.ephoto360.com` | 🟢 viva | 17 textmaker | textos con estilo |
| 14 | QrServer | `api.qrserver.com` | 🟢 viva | QR | QrCommand |
| 15 | CoinGecko | `api.coingecko.com` | 🟢 viva | cripto | cripto |
| 16 | Frankfurter | `api.frankfurter.app` | 🟢 viva (301→200) | divisas | CurrencyCommand |
| 17 | MyMemory | `api.mymemory.translated.net` | 🟢 viva | traducción | TranslateCommand |
| 18 | DictionaryAPI | `api.dictionaryapi.dev` | 🟢 viva | diccionario | diccionario |
| 19 | UselessFacts | `uselessfacts.jsph.pl` | 🟢 viva | datos random | datos random |
| 20 | Jokes.one | `api.jokes.one` | ⚠️ responde 500 (intermitente) | chistes | ChisteCommand (con fallback) |
| 21 | ImgBB | `api.imgbb.com` | 🟢 viva ⚠️ key | subida de imágenes | ToAnime/Enhance |
| 22 | DeepAI | `api.deepai.org` | 🟢 responde ⚠️ key | upscale/mejora | Enhance/Upscale |
| 23 | Groq | SDK `groq-sdk` | 🟢 ⚠️ `GROQ_API_KEY` | IA conversacional | AiCommand, AiMentionHandler |
| 24 | Picsum | `picsum.photos` | 🟢 viva (302) | imagen aleatoria | último fallback de imágenes |
| 25 | Unsplash Source | `source.unsplash.com` | 🔴 responde 503 (servicio retirado por Unsplash) | cadena de imágenes | penúltimo fallback |
| 26 | Anime scrapers | `animekompi.cam`, `kusonime.com`, `kazefuri.vip`, `nimegami.id`, `riie.jp`, `meownime.ltd`, `huntersekaisub.blogspot.com`, `pendekarsubs.us`, `nontonanimeid.top` | 🟡 DNS activo, sin verificar desde esta máquina | AnimeLinkCommand | enlaces de anime |

---

## 2. Delirius API — la espina dorsal (🔴 MUERTA)

`https://api.delirius.store` — gratuita, sin API key. El sitio `delirius.store` sigue online y dice «STATUS: ONLINE», pero **el subdominio `api.` no resuelve**: Google DNS devuelve `NOERROR` sin registros A ni AAAA. Es una caída DNS de su lado; nadie puede alcanzarla.

**Servicio:** `src/services/external/DeliriusService.ts` — categorías: `anime`, `nsfw`, `canvas`, `download`, `random`, `reactions`, `search`, `ia`.

### Consumo por categoría

| Categoría (método) | Comandos |
|--------------------|----------|
| `search` (`deliriusService.search`) | AnimeSearch, Genius, Gimage, GoogleSearch, MangaSearch, Movie, Npm, Pinterest, PlayStore, SpotifySearch, Tenor, Wiki, YoutubeSearch |
| `download` (`getJson('download')`) | Facebookphoto, Facebookv2, Gitclone, Snackvideo, Spotify, Spotifyalbum, Spotifyinfo, Spotifyplaylist, Ytmp3v2, Tiktok (neko), DownloadService (gofile, imgur, pastebin, stickerwiki, stickerly, telegram-sticker, telegram-stories, threads, xnxx, xvideos, pornhub, soundcloud) |
| `nsfw` (`getNsfwImage`) | rule34, nhentai, nhentaisearch, hitomi, pixiv, hentaitv, tiktok-nsfw, Characterlist/TotalCharacters (helpers), AnimeCommand: boobs, corean, girls, hentai |
| `reactions` (AnimeCommand dinámico, 42 defs: hug, pat, kiss… y los NSFW-gif anal, blowjob, cum, fuck, nekonsfw, nekosfw, pussylick, solo, yuri) |AnimeCommand |
| `anime` (`getAnimeImage`/`getJson('anime')`) | Animeinfo, Animeinfourl, AnimeCommand (9 defs animebase→migrables), AnimeSearch |
| `random` (`getRandomImage`) | AvatarRandom, Cat, LoremFlickr, AnimeCommand (coffee, dog, duck, picsum) |
| `ia` (`getIa`) | Enhance, Upscale, Mailcreate, Mailmessages |
| `canvas` | `CanvasService` (remoto, con fallback local — ver §5) |

**Síntoma en runtime:** los comandos responden `❌ No pude obtener la imagen` / error genérico; los 18 dinámicos con `enabled: false` (§7) ni siquiera llegan a intentar.

**Recuperación:** cuando Delirius arregle su DNS, los comandos activos vuelven solos; los 18 deshabilitados necesitan flip manual (decisión pendiente del owner).

---

## 3. Prince Techn (🔴 MUERTA — permanente)

`https://api.princetechn.com/api/anime?apikey=prince` — `AnimeBase.ts` (`src/commands/anime/AnimeBase.ts`).

TLS responde *unrecognized name*: la app de Heroku detrás del dominio fue eliminada. **No tiene arreglo del lado del bot** — requiere migrar a otra API.

**Consumo:** `AnimeCommand.ts` — 9 defs `service: 'animebase'`: neko, megumin, waifu, randomanime (🟢 activos pero fallarán) + hneko, hwaifu, konachan, loli, milf (🔴 `enabled: false`).

---

## 4. APIs vivas y sus comandos

| API | Servicio | Comandos |
|-----|----------|----------|
| Open-Meteo + geocoding | `WeatherService.ts` | `!temperatura` |
| TTSmp3 / Laurine | `TTSService.ts` (cadena: ~~laurine~~ → ttsmp3 → local) | `!tts` |
| TMDB | `FallbackAPIService.ts` | `!pelicula` (con fallback) |
| Newsdata.io | `NewsService.ts` | `!noticias` |
| Pexels → Pixabay → Unsplash → Picsum | `ImageService.ts` | `!imagen` |
| Jikan | `FallbackAPIService.ts` | top anime (fallback de anime info) |
| Groq | `AIService.ts` | AiCommand, AiMentionHandler, Amor, Facto, Chiste, Consejo, Horoscopo, Pelicula, VerdadReto, Rotacion |
| DuckDuckGo | `WebSearchService.ts` | AiCommand (con terreno web) |
| Wikipedia | delirius `search('wiki')` ⚠️ | WikiCommand (depende de Delirius también) |
| QrServer | inline en `QrCommand.ts` | `!qr` |
| CoinGecko / Frankfurter / MyMemory / DictionaryAPI / UselessFacts / Jokes.one | inline en `ExternalAPIsCommand.ts`, `CurrencyCommand.ts`, `TranslateCommand.ts`, `ChisteCommand.ts`, `FallbackAPIService.ts` | herramientas |
| ImgBB / DeepAI | inline en `ToAnimeCommand.ts`, `EnhanceCommand.ts`, `UpscaleCommand.ts` | edición IA |
| ephoto360 (scrape) | `creative/textmaker/Text*Command.ts` (17 comandos) | textos con estilo |
| imgflip | `StickerRandomCommand.ts` | memes |
| Hosts de stickers/monetización | `telegra.ph`, `files.catbox.moe`, `qu.ax`, `i.imgflip.com` | subida/referencias varias |

**Nota Unsplash:** `source.unsplash.com` fue retirado por Unsplash (503). `ImageService` lo usa como penúltimo fallback; el último (picsum) sigue vivo, así que la cadena nunca queda coja.

---

## 5. Generadores LOCALES (no tocan la red) — 🟢 siempre funcionan

| Generador | Qué produce | Usado por |
|-----------|-------------|-----------|
| `LocalCanvasRenderer.ts` (@napi-rs/canvas) | gay, gaycard, pet, phub, xnxxcard, circle, invert, brat… | CanvasBase (fallback cuando `api.delirius.store/canvas` no responde — hoy es el camino principal de facto) |
| `TweetPost.ts` | tarjeta de tweet/X | interacciones |
| `FriendshipCard.ts`, `WelcomeCard.ts` | tarjetas amistad/bienvenida | WelcomeService |
| `devCard.ts` (opentype.js + sharp) | card `!dev` | DevCommand |
| `ProfileCardService.ts` | card `!profile` | ProfileCommand |
| `StickerService`/`StickerHelper` | stickers, exif | StickerCommand |
| yt-dlp (binario en el container) | descargas TikTok/YouTube | TikTokGuard + breaker propio |

---

## 6. Claves de entorno (variables que deben existir)

| Variable | API | Dónde |
|----------|-----|-------|
| `GROQ_API_KEY` | Groq (IA) | AIService |
| `TMDB_API_KEY` | películas | FallbackAPIService |
| `NEWSDATA_API_KEY` | noticias | NewsService |
| `PEXELS_API_KEY` | imágenes | ImageService |
| `PIXABAY_API_KEY` | imágenes | ImageService |
| `ANIME_API_KEY` | Prince Techn (default `prince`) | AnimeBase — muerta, irrelevante hasta migrar |

---

## 7. Comandos deshabilitados (`enabled: false`) y por qué

18 defs en `src/commands/anime/AnimeCommand.ts`, todas por APIs muertas:

| Defs | Servicio (API) | Estado del backend |
|------|----------------|--------------------|
| hneko, hwaifu, konachan, loli, milf | animebase → Prince Techn | 🔴 muerta permanente |
| anal, blowjob, cum, fuck, nekonsfw, nekosfw, pussylick, solo, yuri | reactions → Delirius | 🔴 caída DNS |
| boobs, corean, girls, hentai | nsfw → Delirius | 🔴 caída DNS |

**Cadena de gates en la pipeline** (`MainMessagePipeline.checkCommandAvailability`):
1. `command.enabled === false` → «❌ Este comando está deshabilitado.» ← *esto es lo que ven los usuarios con `!nsfw on` activado*.
2. `command.nsfw === true` && toggle apagado → «🔞 Los comandos NSFW están deshabilitados…»

El toggle `!nsfw on` solo controla la puerta 2; no puede revivir la puerta 1.

---

## 8. Qué vigilar / próximas decisiones

1. **Delirius DNS** — revisar `api.delirius.store` periódicamente (un `getent` o Google DNS basta). Al volver: considerar re-activar los 13 delirius-backed de la §7 (`loli` queda fuera por política de contenido).
2. **Prince Techn** — migrar los 9 comandos animebase a otra API o eliminarlos.
3. **Unsplash Source** — retirar de la cadena de `ImageService` (503 permanente).
4. **TTS Laurine** — dominio expirado; el eslabón está muerto, la cadena sigue con ttsmp3.
5. **Jikan** — accesible solo vía IPv6 desde la máquina de dev; verificar desde el server antes de darlo por roto.
