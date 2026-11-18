# APIs muertas de OrbitBot — estado vivo

> **Actualizado:** 18-nov-2026 (v7.4.11) · **Complemento de:** `APIS_EXTERNAS.md` (inventario completo) y del plan de alternativas del usuario (§1–9).
>
> Esta lista contiene **solo APIs confirmadas muertas**. Cada vez que se migra una, sale de esta tabla (el historial de fixes queda en git). Validaciones hechas desde el servidor con `curl -4`.

## Muertas y pendientes de migrar

| # | API | Causa de muerte | Impacto | Reemplazo planeado | Estado |
|---|-----|-----------------|---------|--------------------|--------|
| 1 | **rule34.xxx** (`api.rule34.xxx`) | Exige autenticación ("Missing authentication") desde el servidor | `!rule34` | Danbooru `rating:e` + fallback `rating:e` (los tags de rule34 no existen en Danbooru) | ✅ Migrado 7.4.11 |
| 2 | **Genius API** (`genius.com/api`) | Devuelve HTML, no JSON (requiere token) | `!genius` | sin reemplazo gratuito | 🗑️ Comando eliminado 7.4.11 |
| 3 | **LoremFlickr** (`loremflickr.com`) | HTTP 500 permanente | `!loremflickr` | sin reemplazo (Picsum ya cubre random) | 🗑️ Comando eliminado 7.4.11 |
| 4 | **hentaivid.app** | HTTP 000 (dominio caído) | `!hentaivid` | nekobot `pgif` | ✅ Migrado 7.4.11 |
| 5 | **Hitomi / Pixiv / HentaiTV / Telegram stickers** | Sin API pública estable (solo scraping) | `!hitomi`, `!pixiv`, `!hentaitv`, `!telegramsticker` | sin reemplazo | 🗑️ Comandos eliminados 7.4.11 |
| 6 | **Waifu fallbacks** (`api.waifu.pics`, `api.waifu.im`) | NXDOMAIN en el mundo (verificado 17-nov-2026) | Ninguno directo: eran los *reemplazos* del plan, no dependencias | `pic.re` (🟢 verificada viva) como fallback de imágenes de waifu; para GIFs de reacciones nekos.best queda sin plan B | 📌 Nota |

## Ya no muertas (migraciones hechas — fuera de esta lista)

| API | Fix | Versión |
|-----|-----|---------|
| ~~Jikan~~ | Reemplazada por AniList GraphQL + Kitsu fallback en `FallbackAPIService` (verificada en vivo) | 7.3.8 |
| ~~Prince Techn (animebase)~~ | neko/waifu/foxgirl/randomanime → nekos.best; megumin y las NSFW sin reemplazo quedaron `enabled: false`; `loli` eliminada | 7.4.0 |
| ~~Delirius (reacciones + random)~~ | 25 reacciones SFW → nekos.best (gif→mp4 con cache); dog/duck/coffee/picsum → dog.ceo/random-d.uk/alexflipnote/picsum; avatar → DiceBear; 8 reacciones sin categoría quedaron deshabilitadas | 7.4.0 |
| ~~Laurine TTS~~ | Edge TTS (`msedge-tts`, voz es-MX-DaliaNeural, sin key) verificado en vivo; la cadena muerta de Laurine eliminada | 7.4.1 |
| ~~Unsplash Source~~ | Eliminado de la cadena de imágenes; Picsum queda como fallback final (503 permanente) | 7.4.2 |
| ~~Delirius (búsquedas, 7 comandos)~~ | !wiki→Wikipedia REST, !npm→registry, !animesearch→AniList, !mangasearch→MangaDex, !movie→TMDB, !google→DuckDuckGo (existente), !gimage→ImageService (existente) — todas verificadas en vivo | 7.4.3 |
| ~~Delirius (ia enhance/upscale)~~ | DeepAI `torch-srgan` (patrón existente de ToAnime); mensaje claro si falta `DEEPAI_API_KEY`; media citado resuelto con MediaMessageCache | 7.4.4 |
| ~~Purrbot (reacciones NSFW)~~ | 9 reacciones NSFW → `api.purrbot.site/v2` (gate `!nsfw` intacto) | 7.4.5 |
| ~~nekobot + boorus~~ | defs NSFW y tags de personaje → nekobot/Danbooru/Konachan; `!booru <tag>` con lista negra | 7.4.6 |
| ~~Delirius (descargas genéricas)~~ | yt-dlp genérico: soundcloud, threads, snackvideo, facebookv2, xnxx/xvideos/pornhub, gitclone, gofile, imgur | 7.4.7 |
| ~~Delirius (Spotify)~~ | oEmbed + tracklist + `ytsearch1` | 7.4.8 |
| ~~Delirius (mail/playstore/news)~~ | mail.tm, `google-play-scraper`, ANN RSS (`!mailcreate`, `!mailmessages`, `!playstore`, `!newsanime`) | 7.4.9 |
| ~~Delirius (TTS mp3)~~ | TTS Edge → mp3 → OGG/Opus con ffmpeg (WhatsApp descarta notas de voz mp3) + timeout 60 s | 7.4.10 |
| ~~Delirius (TTS, tenor, descargas lentas)~~ | `!tenor` → Giphy (`GIPHY_API_KEY`); descargas async 10 min (spawnSync bloqueaba el event loop) y bitrate 7; cache gif por id | 7.4.10 |
| ~~Delirius (resto de anime/nsfw/búsquedas)~~ | AniList, cataas, DiceBear, iTunes, Danbooru, nhentai v2 + lista negra; DeliriusService y 17 comandos muertos eliminados | 7.4.11 |

## Reglas de la migración (del plan del usuario)

- NSFW: sin reemplazo limpio → se elimina o queda `enabled: false`; `loli` se elimina siempre.
- Descargas: yt-dlp (ya en el container) es la vía principal; cobalt self-hosted si hace falta.
- Toda alternativa se valida desde el servidor antes de implementar.
