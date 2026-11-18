# Comandos migrados / arreglados — checklist de prueba manual

> Todo lo de abajo quedó arreglado entre **v7.3.1 y v7.4.11**. Probar con el bot desplegado
> (`./deploy.sh develop update`).
> Leyenda: ✅ debe funcionar · ⚠️ depende de key/config · ❌ mensaje de error esperado (no crash)

---

## 1. Stickers (v7.3.5–7.3.7)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Sticker de imagen directa | envía foto + caption `!s` | ✅ sticker |
| Sticker citando imagen | responde una foto con `!sticker` | ✅ sticker (usa el cache de media) |
| Sticker citando video | responde un video con `!sticker` | ✅ sticker animado de los primeros 10 s |
| Video largo (1–3 min) | responde con `!sticker` | ✅ convierte en ~3–5 s (antes moría por timeout) |
| GIF | responde un GIF con `!sticker` | ✅ sticker animado |
| Sticker citando un media **anterior al restart** del bot | cita un media viejo | ❌ error claro (media no está en cache) → reenvíalo y cítalo |
| Citando algo que no es media | `!sticker` en un texto | ✅ mensaje de instrucciones |

## 2. Mute / unmute (v7.3.1)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Mute instantáneo | `!mute @usuario 5m` | ✅ silenciado al segundo (fuente de verdad = BD, no cache) |
| Unmute instantáneo | `!unmute @usuario` | ✅ desilenciado al segundo |
| Expiración | mute 1 min y esperar | ✅ se desmutea solo al expirar |

## 3. Fotos de perfil / avatares (v7.3.3–7.3.4)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Perfil con foto | `!profile` | ✅ muestra la foto real |
| Perfil sin foto | usuario sin foto de perfil | ✅ avatar por defecto (`default-profile.jpg`), no imagen rota |
| Menú / help / welcome | `!menu`, entrada a grupo | ✅ sin imágenes caídas (timeout de 8 s + fallback) |

## 4. Anime info (v7.3.8) — verificado en vivo contra AniList

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Recomendación | `!anime` | ✅ anime real del top de AniList (`*título* 📺 ep 📝 desc`) |
| Repetido seguido | `!anime` ×2 | ✅ 2ª vez instantáneo (cache 30 min) |
| Con fallback de cadena | (solo si AniList cae) | ✅ Kitsu responde; si ambos caen, lista estática |

## 5. Reacciones → nekos.best (v7.4.0) — verificado en vivo

Primera vez de cada gif tarda ~2–4 s (ffmpeg convierte gif→mp4 una vez y lo cachea; las siguientes son instantáneas).

| Comandos | Resultado esperado |
|----------|--------------------|
| `!hug` `!pat` `!kiss` `!cry` `!dance` `!angry` `!bonk` `!bite` `!blush` | ✅ gif animado con gifPlayback |
| `!cuddle` `!handhold` `!happy` `!highfive` `!nom` `!poke` `!pout` | ✅ gif animado |
| `!slap` `!smile` `!smug` `!tickle` `!wink` `!yeet` `!patear` | ✅ gif animado |
| `!lay` | ✅ gif de "sleep" (mapeo: no había categoría lay) |
| `!tail` | ✅ gif de "wag" (mapeo) |

## 6. Imágenes de anime / random (v7.4.0) — verificado en vivo

| Comando | Fuente | Resultado esperado |
|---------|--------|--------------------|
| `!neko` | nekos.best | ✅ imagen png |
| `!waifu` | nekos.best | ✅ imagen png |
| `!foxgirl` | nekos.best `kitsune` | ✅ imagen png |
| `!randomanime` | nekos.best (random entre neko/waifu/kitsune/husbando) | ✅ imagen png |
| `!dog` | dog.ceo | ✅ foto de perro |
| `!duck` | random-d.uk | ✅ foto de pato |
| `!coffee` | coffee.alexflipnote.dev | ✅ foto de café |
| `!picsum` | picsum.photos | ✅ imagen random |
| `!avataranime` | DiceBear pixel-art | ✅ avatar png |
| `!megumin` | — | ❌ deshabilitado (sin fuente viva) |
| `!loli` | — | comando eliminado (no existe) |
| `!bully` `!confy` `!cringe` `!eevee` `!fluff` `!glomp` `!kill` `!lick` | — | ❌ deshabilitados (waifu.pics murió; sin plan B para GIFs) |

## 7. TTS (v7.4.1) — verificado en vivo (mp3 válido en ~1.2 s)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Voz | `!tts Hola Orbit, ya tengo voz` | ✅ nota de voz (ptt) con voz neuronal Dalia (es-MX) |
| Texto largo | >500 caracteres | ✅ mensaje de límite |
| Sin texto | `!tts` | ✅ mensaje de uso |

## 8. Búsquedas (v7.4.3) — todas las fuentes verificadas en vivo

| Comando | Fuente | Resultado esperado |
|---------|--------|--------------------|
| `!wiki México` | Wikipedia REST | ✅ texto: título + resumen + link |
| `!wiki asdfasdfxyz` | — | ❌ "No encontré el artículo" |
| `!npm express` | npm registry | ✅ texto: top 5 con `nombre@versión` |
| `!animesearch Naruto` | AniList | ✅ imagen de portada + caption con score/episodios |
| `!mangasearch one piece` | MangaDex | ✅ portada + caption |
| `!movie Matrix` | TMDB | ⚠️ con `TMDB_API_KEY`: póster + caption · sin key: ❌ mensaje pidiéndola |
| `!google tecnologia` | DuckDuckGo (existente) | ✅ texto: 5 resultados con link y snippet |
| `!gimage gato` | Pexels/Pixabay→Picsum | ⚠️ con keys: imagen de la búsqueda · sin keys: imagen random de Picsum |
| `!genius` `!playstore` `!pinterestsrc` `!spotifysrc` `!tenor` `!ytsearch` | Delirius (muerta) | ❌ error — pendiente key/scraper |

## 9. IA imágenes (v7.4.4)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Sin key | `!enhance` citando imagen | ❌ mensaje claro pidiendo `DEEPAI_API_KEY` |
| Con key | `!enhance https://...jpg` | ✅ imagen mejorada (torch-srgan) |
| Con key, citada | `!upscale` respondiendo una imagen | ✅ imagen upscaled (usa el cache de media citado) |

## 10. Regresiones a vigilar (cosas tocadas indirectamente)

| Prueba | Por qué |
|--------|---------|
| `!s` (sticker directo) | el filtro de video de ffmpeg cambió (`-t` por entrada) |
| Reacciones de `!InteractionCommand` (agarrarnalgas, etc.) | comparten patrón gifPlayback — no se tocaron, pero conviene smoke-test |
| `!pelicula` (recomendación) | usa el mismo `FallbackAPIService` que se tocó para AniList |
| `!chiste` | mismo servicio (no debió cambiar) |

## 11. Reacciones y boorus (v7.4.5–7.4.6)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Reacciones SFW | `!hug`, `!pat`, `!kiss` | ✅ gif como video `gifPlayback` |
| Reacciones NSFW | `!nsfw on` + `!fuck`, `!yuri`, `!solo` | ✅ video NSFW (Purrbot) |
| Imágenes NSFW | `!boobs`, `!hneko`, `!hentai` | ✅ imagen (nekobot) |
| Booru por tag | `!booru marin_kitagawa` | ✅ imagen SFW; tag prohibido → mensaje de filtrado |
| Personajes | `!megumin`, `!marin`, `!mori`, `!maid`, `!uniform` | ✅ imagen (Danbooru) |

## 12. Descargas y TTS (v7.4.7–7.4.10)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| TTS | `!tts hola mundo` | ✅ **nota de voz** (OGG/Opus) en ~2–5 s; antes se quedaba muda |
| TTS largo | `!tts <texto de 400 caracteres>` | ✅ audio o ❌ error a los 60 s, nunca silencio |
| Canción | `!play bad bunny` | ✅ mp3 ~1.5–3 MB y se **envía** (antes moría a los 145 s por `spawnSync`) |
| Canción en enlace lento | `!play <algo poco popular>` | ✅ espera hasta 10 min sin tumbar la sesión |
| Video | `!ytmp4 <url>` | ✅ video ≤480p |
| Otras descargas | `!soundcloud`, `!threads`, `!snackvideo`, `!facebookv2`, `!xnxx`, `!xvideos`, `!pornhub` | ✅ archivo enviado |
| Enlaces de archivo | `!gofile <url>`, `!imgur <url>` | ✅ archivo (imgur necesita `IMGUR_CLIENT_ID`) |
| Spotify | `!spotify <canción>` | ✅ audio (oEmbed + ytsearch1) |

## 13. Búsquedas nuevas (v7.4.9–7.4.11)

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Correo temporal | `!mailcreate` | ✅ dirección mail.tm guardada |
| Bandeja | `!mailmessages` | ✅ lista (o vacía si aún no llega nada) |
| Play Store | `!playstore whatsapp` | ✅ ficha de la app |
| Noticias anime | `!newsanime` | ✅ titulares de ANN |
| GIFs Giphy | `!tenor happy` (requiere `GIPHY_API_KEY`) | ✅ gif como video; sin key → aviso claro |
| Anime por nombre | `!animeinfo naruto` | ✅ portada + episodios + score (AniList) |
| Anime por link MAL | `!animeinfourl https://myanimelist.net/anime/20/Naruto` | ✅ misma ficha |
| Gatos | `!cat` y `!cat cute` | ✅ imagen (cataas) |
| Avatar aleatorio | `!avatarrandom` y `!avatarrandom pixel-art` | ✅ avatar DiceBear |
| Buscar video | `!ytsearch coqueta bocchi` | ✅ miniatura + título + link |
| Buscar canción | `!spotifysrc despacito` | ✅ portada + artista + álbum (iTunes) |

## 14. NSFW que debe seguir vivo (v7.4.11)

> Gate: primero `!nsfw on` en el chat. Sin gate, todos responden con el aviso 🔞.

| Prueba | Cómo | Resultado esperado |
|--------|------|--------------------|
| Regla 34 | `!rule34 anime` | ✅ imagen explícita (Danbooru `rating:e`) |
| Regla 34 tag inexistente | `!rule34 hentai` | ✅ igual responde con un post explícito (fallback) |
| Doujin por código | `!nhentai 696728` | ✅ portada del doujin |
| Doujin bloqueado | `!nhentai 698288` (tag `shotacon`) | ❌ mensaje de bloqueo por lista negra (no se muestra) |
| Buscar doujin | `!nhentaisearch office lady` | ✅ portada del primer resultado limpio |
| Video hentai | `!hentaivid` | ✅ video (nekobot `pgif`) |
| Agresiones | `!anal`, `!blowjob`, `!cum`, `!pussylick` | ✅ video NSFW |

---

> **Nota de rendimiento:** la primera conversión gif→mp4 por reacción cuesta ~2–4 s de CPU; el cache persiste en el volumen `orbit_temp` (sobrevive restarts). Si el disco se llena, borrar `data/temp/nk-*.mp4` es seguro (se regeneran).
