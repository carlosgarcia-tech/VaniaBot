# TikTok — Error 403 en descargas de OrbitBot

> Diagnóstico completo del fallo `!tiktok`, con la cadena de errores observados,
> la causa raíz identificada con evidencia, y las alternativas posibles (con y
> sin cookies). Estado al 15 nov 2026.

---

## 1. Síntoma

El comando `!tiktok <url>` en el bot (corriendo en Docker) falla:

```
❌ Download failed

ERROR: [TikTok] 7696749231666760967: Unable to download webpage:
HTTP Error 403: Forbidden (caused by <HTTPError 403: Forbidden>)
```

URL de prueba (falla consistentemente desde la máquina del bot):
`https://vt.tiktok.com/ZSpbg9pN4/` (video 7696749231666760967, @pepito_el_sigma67)

---

## 2. Cadena de errores observados (evolución del diagnóstico)

| # | Entorno | Error exacto | Causa de ese error |
|---|---------|--------------|--------------------|
| 1 | Host nativo (sin impersonación) | `Your IP address is blocked from accessing this post` | IP bloqueada por TikTok |
| 2 | Container Docker v1 (binario standalone yt-dlp) | `The extractor is attempting impersonation, but no impersonate target is available` + `Unexpected response from webpage request` | El binario standalone **no incluye `curl_cffi`** (librería de impersonación TLS) → TikTok responde basura/bot-check |
| 3 | Container Docker v2 (pip `yt-dlp[default,curl-cffi]`) | `HTTP Error 403: Forbidden` | Impersonación disponible pero **no aplicada automáticamente** al pedir la página |
| 4 | Container Docker v3 (config global `--impersonate chrome`) | `HTTP Error 403: Forbidden` — **intermitente** | Impersonación aplicada y aún así 403 → **la IP está siendo rechazada por reputación, no por fingerprint** |

Cada paso eliminó una capa del problema; el que queda es el de la IP.

---

## 3. Evidencia de los tests (todos dentro del container real)

El comando exacto que ejecuta el bot es:

```bash
yt-dlp --dump-json --no-download --no-playlist --quiet <url>
```

| Test | Resultado |
|------|-----------|
| `--impersonate chrome` explícito, como root, 1er intento | ✅ **FUNCIONÓ** — JSON completo con formatos 720p, ttwid cookies generadas |
| Sin `--impersonate` (comando del bot) | ❌ 403 |
| Con config `/etc/yt-dlp.conf` cargado (verificado con `-v`: `System config: ['--impersonate','chrome']`), usuario 1001 | ❌ 403 (el traceback muestra que la petición salió por el handler `curl_cffi`, o sea impersonada) |
| Root + `--impersonate chrome` explícito, minutos después | ❌ 403 |
| `--cookies <archivo inexistente>` | ✅ tolerado — yt-dlp arranca con jar vacío, no rompe |

**Lectura:** el mismo comando con la misma impersonación funcionó una vez y
después falló repetidamente. Eso descarta el fingerprint TLS como causa
principal y apunta a **reputación de IP con bloqueo intermitente / rate-limit**.

Contexto de la IP: la máquina tiene IP **residencial Vodafone**
(`244.22.37.188.rev.vodafone…`). No es una IP de datacenter, pero el volumen de
peticiones de prueba + bot acumuladas en pocas horas disparó la defensa de TikTok.

Antecedente: el día 14 el host ya había recibido
`Your IP address is blocked from accessing this post` para otro video —
el bloqueo de IP viene pasando desde antes de la migración a Docker.

---

## 4. Causa raíz

**TikTok rechaza intermitentemente las peticiones HTTP desde la IP de la
máquina**, con `403 Forbidden` en la petición de la página del video
(webpage request), incluso cuando:

- la petición sale con fingerprint TLS de Chrome real (`curl_cffi`),
- los headers son de navegador,
- hay reintentos.

La primera petición tras un rato de "enfriamiento" a veces pasa (genera un
`ttwid` fresco y baja el JSON completo); las siguientes en ráfaga dan 403.
Es un **bloqueo de reputación/limite de tasa por IP**, no un bug del
extractor ni del bot.

---

## 5. Alternativas posibles (sin cookies)

### 5.1. Esperar/enfriar (gratis, no resuelve)
Dejar pasar horas entre descargas. La evidencia sugiere que tras un periodo
sin peticiones la primera vuelve a pasar. **No es solución para un bot.**

### 5.2. Proxy saliente (efectivo, requiere proxy)
Rutear las peticiones de yt-dlp por otra IP:

```bash
# por invocación
yt-dlp --proxy "socks5://user:pass@host:1080" <url>
```

Se puede meter en el mismo `/etc/yt-dlp.conf` del Dockerfile:
```
--proxy socks5://user:pass@host:1080
```

- ✅ Cambia la IP percibida; si el proxy es residencial/móvil, TikTok trata la
  petición como usuario normal.
- ❌ Necesitas un proxy (residencial idealmente; los de datacenter también los
  bloquea TikTok a veces). Costo mensual o un VPS barato montando un SOCKS5.
- ⚠️ Todo el tráfico de yt-dlp (YouTube incluido) iría por el proxy si va en el
  config global — se puede limitar solo a TikTok con `--extractor-args`? No
  existe per-extractor proxy; sería global o filtrado por env var del bot.

### 5.3. Extractor alternativo / API móvil de TikTok (frágil)
yt-dlp tiene `--extractor-args "tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com"`
para usar la API móvil en vez de la web. Suele requerir `device_id` y también
acaba bloqueada. **No recomendado** como primario; puede ser un *fallback*
segundo método dentro de `TikTokDownloader.ts`.

### 5.4. Servicio tercero de descarga (API externa)
Servicios tipo tikwm.com, snaptik, etc. El bot ya tiene la arquitectura para
eso (otros downloaders usan APIs), pero va contra la regla del proyecto
("nada de apis externas, todo desde la misma máquina"). Descartado salvo
decisión explícita en contrario.

### 5.5. Reintentos con backoff (mitiga, ya parcialmente hecho)
`--extractor-retries 3` está en el config global (commit `d26d021`).
Con bloqueo por ráfaga ayuda poco: los 3 reintentos ocurren en segundos.

### 5.6. Cambiar la IP del servidor (no aplica acá)
Si esto corrió en un VPS con IP bloqueada de plano, la salida es otra IP
(reinicio de dial-up/dhcp del ISP, o VPS distinto). En una conexión residencial
con IP dinámica, **reiniciar el router** puede renovar la IP y desbloquear de
inmediato. Riesgo: la IP nueva también acaba bloqueada con uso.

---

## 6. Alternativa con cookies (la más robusta)

TikTok confía en sesiones con cookies aunque la IP sea sospechosa — una sesión
navegador con su `ttwid`/`sessionid` pasa donde un cliente anónimo recibe 403.

**Ya implementado en la imagen** (commit `d26d021`): el config global de
yt-dlp (`/etc/yt-dlp.conf`) incluye

```
--cookies /app/data/tiktok_cookies.txt
```

El archivo vive en el volume persistente `orbit_database` (montado en
`/app/data`), así que sobrevive deploys. Si no existe, yt-dlp arranca con jar
vacío (verificado, no rompe nada — YouTube/Instagram sin cambio).

Pasos:

1. Navegador con tiktok.com abierto (cuenta logueada ideal; sirve aunque el
   contenido sea público) → extensión **"Get cookies.txt LOCALLY"** → export
   Netscape → `tiktok_cookies.txt`.
2. `docker cp tiktok_cookies.txt orbit:/app/data/tiktok_cookies.txt`
3. `./deploy.sh develop update` (build de segundos, todo cacheado)
4. Probar `!tiktok <url>`

Mantenimiento: si vuelve el 403 meses después, re-exportar cookies (TikTok
rota `ttwid`; el `sessionid` dura más). Podría automatizarse más adelante.

Riesgo de cookies: la cuenta usada podría recibir un challenge/verificación de
TikTok si el volumen de peticiones es alto. Con uso normal de un bot de grupo,
es raro.

---

## 7. Estado del código y commits

| Commit | Cambio |
|--------|--------|
| `652b70c` | Dockerfile: RUN gigante dividido en 3 capas + retries pip/curl (build resistente a red lenta) |
| `455520f` | Dockerfile: `pip install "yt-dlp[default,curl-cffi]"` (impersonación real) + `/etc/yt-dlp.conf` con `--impersonate chrome` |
| `d26d021` | Dockerfile: config global con `--extractor-retries 3` + `--cookies /app/data/tiktok_cookies.txt` |
| `e7852bf` | deploy.sh: modos `develop` (build local) / `production` (pull registry) |

Imagen actual en la máquina: `ghcr.io/carlosgarcia-tech/orbit:6.12.18` con
yt-dlp 2026.10.26 (pip, curl_cffi 0.17.0), ffmpeg 5.1.9, pymupdf 2.1.

Nota aparte: el mensaje genérico «Descarga fallida. Verifica que yt-dlp y
ffmpeg estén instalados» ya no aparece — el bot ahora propaga el error real de
yt-dlp, que fue lo que permitió diagnosticar todo esto.

---

## 8. Recomendación

1. **Corto plazo y gratis:** probar la renovación de IP reiniciando el router
   (si aplica) + cookies del navegador (sección 6). Es la combinación con mejor
   ratio costo/efectividad y ya está soportada por la imagen.
2. **Si no quieres cookies:** proxy residencial (sección 5.2), una línea en el
   mismo config.
3. **Combinables:** cookies + reintentos ya activos. Proxy solo si el bloqueo
   vuelve a ser total y persistente.
