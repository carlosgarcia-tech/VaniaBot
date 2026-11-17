# APIs muertas de OrbitBot — estado vivo

> **Levantado:** 17-nov-2026 · **Complemento de:** `APIS_EXTERNAS.md` (inventario completo) y del plan de alternativas del usuario (§1–9).
>
> Esta lista contiene **solo APIs confirmadas muertas**. Cada vez que se migra una, sale de esta tabla (el historial de fixes queda en git). Validaciones hechas desde el servidor con `curl -4`.

## Muertas y pendientes de migrar

| # | API | Causa de muerte | Impacto | Reemplazo planeado | Estado |
|---|-----|-----------------|---------|--------------------|--------|
| 1 | **Delirius API** (`api.delirius.store`) | Subdominio `api.` sin registro A/AAAA en el mundo (su web dice ONLINE pero es falso) | ~45 comandos | §2–§6 del plan: nekos.best (reacciones), yt-dlp/cobalt (descargas), APIs oficiales por servicio (búsquedas), mail.tm (ia), cataas/dog.ceo/random-d/dicebear (random) | ⏳ Pendiente |
| 2 | **Prince Techn** (`api.princetechn.com`) | TLS *unrecognized name* (app Heroku eliminada) | 9 defs anime (neko, waifu, hneko, hwaifu, konachan, milf, loli…) | nekos.best (✅ verificada viva) para neko/waifu; §7 decide el resto; **loli se elimina, no se migra** | ⏳ Pendiente |
| 3 | **Laurine TTS** (`www.laurine.site`) | Dominio NXDOMAIN (expirado) | Primer eslabón de la cadena TTS | Edge TTS (`node-edge-tts`/`msedge-tts`) → ttsmp3 (🟢 viva) → local | ⏳ Pendiente |
| 4 | **Unsplash Source** (`source.unsplash.com`) | 503 permanente (servicio retirado por Unsplash) | Penúltimo fallback de imágenes | Quitarlo de la cadena; Picsum (🟢 viva) queda como último; opcional Openverse (🟢 verificada) antes | ⏳ Pendiente |
| 5 | **Waifu fallbacks** (`api.waifu.pics`, `api.waifu.im`) | NXDOMAIN en el mundo (verificado 17-nov-2026) | Ninguno directo: eran los *reemplazos* del plan, no dependencias | `pic.re` (🟢 verificada viva) como fallback de imágenes de waifu; para GIFs de reacciones nekos.best queda sin plan B | ⏳ Nota para §9.2 |

## Ya no muertas (migraciones hechas — fuera de esta lista)

| API | Fix | Versión |
|-----|-----|---------|
| ~~Jikan~~ | Reemplazada por AniList GraphQL + Kitsu fallback en `FallbackAPIService` (verificada en vivo) | 7.3.8 |

## Reglas de la migración (del plan del usuario)

- NSFW: sin reemplazo limpio → se elimina o queda `enabled: false`; `loli` se elimina siempre.
- Descargas: yt-dlp (ya en el container) es la vía principal; cobalt self-hosted si hace falta.
- Toda alternativa se valida desde el servidor antes de implementar.
