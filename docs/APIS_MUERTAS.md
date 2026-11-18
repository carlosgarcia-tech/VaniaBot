# APIs muertas de OrbitBot — estado vivo

> **Levantado:** 17-nov-2026 · **Complemento de:** `APIS_EXTERNAS.md` (inventario completo) y del plan de alternativas del usuario (§1–9).
>
> Esta lista contiene **solo APIs confirmadas muertas**. Cada vez que se migra una, sale de esta tabla (el historial de fixes queda en git). Validaciones hechas desde el servidor con `curl -4`.

## Muertas y pendientes de migrar

| # | API | Causa de muerte | Impacto | Reemplazo planeado | Estado |
|---|-----|-----------------|---------|--------------------|--------|
| 1 | **Delirius API** (`api.delirius.store`) | Subdominio `api.` sin registro A/AAAA en el mundo (su web dice ONLINE pero es falso) | Descargas (§6.1), ia-mail, nsfw, 6 búsquedas sin key (Genius, PlayStore, Pinterest, SpotifySearch, Tenor, YoutubeSearch) y 8 defs sin reemplazo (gacha, hentaivid, lolipc, maid, selfie, uniform, marin, mori, oppai, newsanime) | yt-dlp/cobalt (descargas), mail.tm (ia), keys/scrapers para búsquedas restantes | ⏳ Pendiente (reacciones, random, foxgirl y 7 búsquedas ya migrados) |
| 2 | **Waifu fallbacks** (`api.waifu.pics`, `api.waifu.im`) | NXDOMAIN en el mundo (verificado 17-nov-2026) | Ninguno directo: eran los *reemplazos* del plan, no dependencias | `pic.re` (🟢 verificada viva) como fallback de imágenes de waifu; para GIFs de reacciones nekos.best queda sin plan B | 📌 Nota |

## Ya no muertas (migraciones hechas — fuera de esta lista)

| API | Fix | Versión |
|-----|-----|---------|
| ~~Jikan~~ | Reemplazada por AniList GraphQL + Kitsu fallback en `FallbackAPIService` (verificada en vivo) | 7.3.8 |
| ~~Prince Techn (animebase)~~ | neko/waifu/foxgirl/randomanime → nekos.best; megumin y las NSFW sin reemplazo quedaron `enabled: false`; `loli` eliminada | 7.4.0 |
| ~~Delirius (reacciones + random)~~ | 25 reacciones SFW → nekos.best (gif→mp4 con cache); dog/duck/coffee/picsum → dog.ceo/random-d.uk/alexflipnote/picsum; avatar → DiceBear; 8 reacciones sin categoría quedaron deshabilitadas | 7.4.0 |
| ~~Laurine TTS~~ | Edge TTS (`msedge-tts`, voz es-MX-DaliaNeural, sin key) verificado en vivo; la cadena muerta de Laurine eliminada | 7.4.1 |
| ~~Unsplash Source~~ | Eliminado de la cadena de imágenes; Picsum queda como fallback final (503 permanente) | 7.4.2 |
| ~~Delirius (búsquedas, 7 comandos)~~ | !wiki→Wikipedia REST, !npm→registry, !animesearch→AniList, !mangasearch→MangaDex, !movie→TMDB, !google→DuckDuckGo (existente), !gimage→ImageService (existente) — todas verificadas en vivo | 7.4.3 |

## Reglas de la migración (del plan del usuario)

- NSFW: sin reemplazo limpio → se elimina o queda `enabled: false`; `loli` se elimina siempre.
- Descargas: yt-dlp (ya en el container) es la vía principal; cobalt self-hosted si hace falta.
- Toda alternativa se valida desde el servidor antes de implementar.
