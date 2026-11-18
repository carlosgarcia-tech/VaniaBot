# Lo que sigue muerto o no sirve (17-nov-2026, post v7.4.4)

> Complemento de `APIS_MUERTAS.md` (seguimiento de migraciones) y `APIS_EXTERNAS.md` (inventario).
> Esta es la lista completa de lo que **aún no funciona** y por qué. Lo migrado está en `COMANDOS_PROBAR.md`.

---

## 1. Delirius API (`api.delirius.store`) — MUERTA, parcialmente migrada

Subdominio `api.` sin registro DNS en el mundo. Lo que queda pegado a ella:

### Descargas — 21 comandos rotos (reemplazo: yt-dlp/cobalt, §6.1 del plan)

`facebook`, `facebookphoto`, `facebookv2`, `gitclone`, `gofile`, `imgur`, `pastebin`, `pornhub`, `snackvideo`, `soundcloud`, `spotify`, `spotifyalbum`, `spotifyinfo`, `spotifyplaylist`, `stickerly`, `stickerwiki`, `telegramsticker`, `telegramstories`, `threads`, `xnxx`, `xvideos`, `ytmp3v2`

### Búsquedas — 6 comandos rotos (necesitan key o scraper)

| Comando | Reemplazo posible |
|---------|-------------------|
| `!genius` | API oficial de Genius (token gratis, solo metadatos) |
| `!playstore` | librería `google-play-scraper` |
| `!pinterestsrc` | sin API estable — candidato a eliminar |
| `!spotifysrc` | Spotify Web API (client credentials gratis) |
| `!tenor` | Tenor API v2 (key de Google) o Giphy |
| `!ytsearch` | yt-dlp `ytsearch5:` o `youtubei.js` |

### IA correo — 2 comandos rotos (reemplazo: mail.tm, verificado vivo)

`!mailcreate`, `!mailmessages`

### Defs dinámicas en `AnimeCommand` — 3 rotas sin reemplazo (se eliminan en §8.6)

- `deliriusbase`: `gacha`, `hentaivid`, `lolipc`, `selfie` (4)
- ~~`anime`: `marin`, `mori`, `oppai`~~ → **Danbooru/nekobot (v7.4.6)**
- ~~`deliriusbase`: `maid`, `uniform`~~ → **Danbooru (v7.4.6)**
- ~~`animebase` (Prince): `megumin`, `konachan`, `milf`, `hneko`, `hwaifu`~~ → **nekobot/boorus (v7.4.6)**
- `anime`: `newsanime` (ANN RSS, pendiente §8.5)

### NSFW — estado tras v7.4.5–7.4.6

- Comandos propios pendientes de eliminar (§8.6): `nhentai`, `nhentaisearch`, `hitomi`, `pixiv`, `hentaitv`, `tiktoknsfw`, `characterlist`, `totalcharacters`, `rule34` (doujins con menores no filtrables, OAuth, personas reales; danbooru cubre rule34 vía `!booru`)
- ~~Defs `nsfw`: `boobs`, `corean`, `girls`, `hentai`~~ → `boobs`/`hentai` **nekobot (v7.4.6)**; `corean`/`girls` **eliminadas** (personas reales)
- ~~Reacciones NSFW-gif (9)~~ → **Purrbot (v7.4.5)**
- Nuevo: **`!booru <tag>`** (Danbooru SFW con lista negra, v7.4.6)

---

## 2. Prince Techn (`api.princetechn.com`) — MUERTA

Solo quedan sus 5 defs deshabilitadas listadas arriba (`megumin`, `hneko`, `hwaifu`, `konachan`, `milf`). `loli` fue **eliminada** por política de contenido (no migrada a propósito).

---

## 3. Waifu fallbacks del plan — MUERTAS también

`api.waifu.pics` y `api.waifu.im` (NXDOMAIN en el mundo). Eran los *reemplazos* planeados; por eso 8 reacciones quedaron deshabilitadas. Único sustituto vivo verificado: `pic.re` (solo imágenes de waifu, sin GIFs de reacciones).

---

## 4. Bloqueos de infraestructura (no de APIs)

| Problema | Estado |
|----------|--------|
| **Build Docker IPv6** — el daemon resuelve `registry-1.docker.io` por IPv6 inalcanzable | ❌ Bloquea el deploy desde v7.3.2. Fix sugerido: `sudo systemctl restart docker` o pin IPv4 en `/etc/hosts`. El container sigue en **7.3.1** |
| **Prueba real TikTok** (única permitida, `https://vt.tiktok.com/ZSpbg9pN4/`) | ⏳ Espera deploy exitoso |
| `DEEPAI_API_KEY` en `.env` | Falta — `!enhance`/`!upscale` responderán pidiéndola hasta que se agregue |
| `TMDB_API_KEY` en `.env` | Falta — `!movie` dirá que no se configuró |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Faltan — `!gimage` cae directo a Picsum (imagen random, no busca de verdad) |

---

## 5. Verificación pendiente en vivo (requiere el bot corriendo)

Stickers GIF→mp4, reacciones nekos.best, TTS Edge, y las demás migraciones de v7.3.8–v7.4.4 están verificadas a nivel de API y con tests, pero **no probadas dentro de WhatsApp** — el checklist para hacerlo está en `COMANDOS_PROBAR.md`.
