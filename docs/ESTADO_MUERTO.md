# Lo que sigue muerto o no sirve (18-nov-2026, post v7.4.11)

> Complemento de `APIS_MUERTAS.md` (seguimiento de migraciones) y `APIS_EXTERNAS.md` (inventario).
> Esta es la lista completa de lo que **aún no funciona** y por qué. Lo migrado está en `COMANDOS_PROBAR.md`.

---

## 1. Delirius API (`api.delirius.store`) — MUERTA Y ELIMINADA

El subdominio `api.` no tiene registro DNS. Desde **v7.4.11** ya no queda ninguna
referencia en el código: `DeliriusService`, `DeliriusAnimeBase` y el
`external/DownloadService` fueron borrados, igual que los comandos que no tenían
reemplazo gratuito (genius, pinterest search, pastebin, stickerly, stickerwiki,
telegramstories, telegramsticker, facebookphoto, ytmp3v2, loremflickr, hitomi,
pixiv, hentaitv, tiktoknsfw, characterlist, totalcharacters y `lolipc`).

Reemplazos vivos (todos verificados desde este servidor el 18-nov-2026):

| Antes (Delirius) | Ahora |
|---|---|
| `!animeinfo`, `!animeinfourl` | AniList GraphQL (`graphql.anilist.co`; `idMal` para links de MAL) |
| `!cat` | cataas.com (`/cat`, `/cat/says/<texto>`) |
| `!avatarrandom`, `!avatar` | DiceBear 9.x |
| `!ytsearch` | yt-dlp `ytsearch1` (thumbnail + link) |
| `!spotifysrc` | iTunes Search API (Spotify ya no es gratis) |
| `!tenor` / `!gif` | Giphy (`GIPHY_API_KEY`) |
| `!playstore` | `google-play-scraper` |
| `!newsanime` | ANN RSS |
| `!mailcreate`, `!mailmessages` | mail.tm |
| `!rule34` | Danbooru `rating:e` + lista negra |
| `!nhentai`, `!nhentaisearch` | nhentai API v2 + lista negra |
| `!gacha`, `!selfie` | Danbooru (`game_cg`, `selfie`) |
| `!hentaivid` | nekobot `pgif` (gate `!nsfw`) |

---

## 2. Prince Techn (`api.princetechn.com`) — MUERTA

Sin referencias desde v7.4.6: `megumin`, `konachan`, `milf`, `hneko`, `hwaifu`
migraron a Danbooru/nekobot. `loli` fue **eliminada** por política de contenido.

---

## 3. Waifu fallbacks del plan — MUERTAS también

`api.waifu.pics` y `api.waifu.im` (NXDOMAIN). Eran los *reemplazos* planeados; por
eso 8 reacciones quedaron deshabilitadas. Único sustituto vivo verificado: `pic.re`
(solo imágenes de waifu, sin GIFs de reacciones).

---

## 4. NSFW — sigue funcionando (gate `!nsfw`)

Ningún comando NSFW se eliminó por "NSFW": solo se borraron los que dependían de
una API muerta sin reemplazo o de personas reales, y `lolipc` por menores.

| Grupo | Comandos | Fuente viva |
|---|---|---|
| Reacciones (9) | `anal`, `blowjob`, `cum`, `fuck`, `nekonsfw`, `nekosfw`, `pussylick`, `solo`, `yuri` | Purrbot |
| Imágenes | `hneko`, `hwaifu`, `boobs`, `hentai`, `oppai`, `milf` | nekobot |
| Video | `hentaivid` | nekobot `pgif` |
| Booru | `rule34`, `!booru` | Danbooru + lista negra de menores |
| Doujins | `nhentai`, `nhentaisearch` | nhentai API v2 + lista negra |

Toda respuesta pasa por la lista negra de tags (`loli`, `lolicon`, `shota`,
`shotacon`, `child`, `toddler`, `underage`, `young`, `infant`, `baby`,
`flat_chest`): una galería/post marcado se descarta y el comando busca otro.

---

## 5. Bloqueos de infraestructura (no de APIs)

| Problema | Estado |
|----------|--------|
| **Deploy** | Contenedor en **7.4.4**; el código ya está en **7.4.11**. Falta `./deploy.sh develop update` |
| **Prueba real TikTok** (única permitida, `https://vt.tiktok.com/ZSpbg9pN4/`) | ⏳ Espera deploy de 7.4.11 |
| `GIPHY_API_KEY` en `.env` | Falta pegar la key (el usuario ya la tiene); sin ella `!tenor` avisa |
| `IMGUR_CLIENT_ID` en `.env` | Falta — `!imgur` no puede subir |
| `DEEPAI_API_KEY` en `.env` | Falta — `!enhance`/`!upscale` piden la key |
| `TMDB_API_KEY` en `.env` | Falta — `!movie` dice que no está configurada |
| `PEXELS_API_KEY` / `PIXABAY_API_KEY` | Faltan — `!gimage` cae a Picsum (random, no busca) |
| Sesión WhatsApp `badSession` | Inestabilidad de la sesión (~50 min), no del código; archivos más chicos reducen la ventana |

---

## 6. Verificación pendiente en vivo (requiere el bot corriendo)

Todo lo de v7.3.8–v7.4.11 está verificado a nivel de API y con tests (1273
pruebas), pero el envío real dentro de WhatsApp solo se puede probar con el
contenedor actualizado: el checklist está en `COMANDOS_PROBAR.md`.
