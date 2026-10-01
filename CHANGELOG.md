# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

## [7.1.3] - 2026-10-01

### Changed

- Convención de tags de la imagen Docker unificada sin prefijo `v` entre ambos pipelines: `ci.yml` (push a main) y `release.yml` (tags de Git) publican ahora los mismos formatos `X.Y.Z`, `X.Y`, `X` y `latest`, siguiendo la convención habitual de los registros Docker.

### Fixed

- El patrón `{{minor}}` de `metadata-action` producía solo el dígito minor (tags basura `1`, `6`, `12`... en ghcr.io) en lugar del minor flotante; ahora usa `{{major}}.{{minor}}` y cada release publica el tag `X.Y`.

### Removed

- El tag crudo de Git (`vX.Y.Z`) ya no se publica en la imagen Docker del release: los patrones semver cubren la versión completa y el crudo solo duplicaba el release con otra convención.

## [7.1.2] - 2026-10-01

### Added

- Script de instalación rápida `VaniaBot.sh` versionado en el repositorio, que reemplaza al gist externo del quick start: resuelve la versión a instalar del argumento (con o sin `v`), del `package.json` local o del último release publicado en GitHub, detecta apt/dnf/pacman, exige Node.js 20+, aplica el parche de `whatsapp-rust-bridge` y crea un `.env` inicial con autenticación por código de pareo.
- `VaniaBot.sh` incluido en el job de `shellcheck` del CI.

### Changed

- `install-termux.sh` muestra la versión del proyecto leída dinámicamente de `package.json` (header, ayuda, log y banner) en lugar de una versión fija que quedaba desactualizada en cada release, con el mismo mecanismo sin dependencias (`sed`) y fallback si el archivo no existe.

### Fixed

- La URL del quick start del README apuntaba a un gist inexistente (404); ahora sirve el script desde `raw.githubusercontent.com` y el ejemplo va fijado a la versión del release.

## [7.1.1] - 2026-10-01

### Added

- Job `shellcheck` en el pipeline de CI que valida los scripts `.sh` del repositorio (`deploy.sh`, `entrypoint.sh`, `install-termux.sh`, `stop.sh`) en cada push y PR, y bloquea la publicación de la imagen Docker si falla.
- Sección "Termux (Android)" en el README con la instalación en un solo comando y una sección de solución de problemas con los errores típicos de Termux (bot detenido al dormir el teléfono, `npm install` con OOM, arranque tras instalar, versión de Node, permisos de almacenamiento y conversiones sin LibreOffice).

### Changed

- `install-termux.sh` adaptado a la serie 7.x: requisito de Node.js 20+ con verificación explícita, instalación de PyMuPDF, pdf2docx y python-pptx para el puente de conversión de documentos, symlink `python3` para `PythonBridge`, `.env` inicial con `PHONE_NUMBER` y `USE_PAIRING_CODE` (pareo en lugar de QR), creación de los directorios `data/assets` y `data/backups`, y aviso de la limitación de LibreOffice en Android.
- Limpieza de formato en LICENSE (sin líneas decorativas) y tablas del README alineadas.

### Fixed

- `install-termux.sh`: el modo `--minimal` no aplicaba el parche de `whatsapp-rust-bridge` porque `--ignore-scripts` se salta el `postinstall` y el bot no arrancaba; ahora el parche se aplica siempre. Patrones `A && B || C` reemplazados por `if/else` explícitos (ShellCheck SC2015).
- `entrypoint.sh`: el shebang estaba en la segunda línea, por lo que ejecutar el entrypoint de Docker directamente fallaba al no encontrar el intérprete (ShellCheck SC1128).
- `deploy.sh`: variables sin uso eliminadas (`STEEL`, `DB_AFTER`, `mnt`) y declaraciones `local` separadas de sus asignaciones para no enmascarar códigos de salida (ShellCheck SC2034/SC2155).

## [7.1.0] - 2026-10-01

### Added

- Comando owner `!loteria reiniciar` (alias `reset`) que permite reiniciar la lotería desde el chat, con persistencia del estado entre reinicios del bot.
- Tickets de lotería con códigos únicos generados mediante `crypto.randomBytes`.
- Suite end-to-end del pipeline principal (`!ping` completo, comandos sin prefijo, deduplicación de mensajes, eco offline) construida sobre un harness con `FakeWASocket` inyectado a través de `WASocketFactory`.
- Job dedicado `e2e` en el pipeline de CI que bloquea la publicación de la imagen Docker hasta superar las pruebas end-to-end.
- Reporte de cobertura a Codecov y badges de CI y cobertura en el README.

### Fixed

- El alias `ping` quedaba eclipsado por `HealthCommand`; ahora responde `PingCommand`. Se añadió una prueba anti-colisión cruzada (nombre contra alias) al test de unicidad de comandos.
- Resueltas 14 colisiones de alias entre comandos (`kick` → moderación, `top` → leaderboards, `verdad` → juego, `search` → búsqueda web con `SearchCommand` renombrado a `encontrar`, `quote`, `backup`/`respaldar` separados, subbots, `health`, `votar`, `traducir`, `poesia`, `flirt`, `amor`, `patear`).

### Changed

- README reescrito para reflejar el estado real del proyecto (instalación, comandos, arquitectura y despliegue).
- La cobertura de pruebas se reporta en formato `lcov` para su envío a Codecov.

## [7.0.1] - 2026-06-26

### Fixed

- `parseCommand` solo aceptaba `config.prefix`, mientras que el pipeline detectaba comandos con `config.prefix`, `.` y `!`. Si el prefijo usado no coincidía exactamente, el comando se descartaba en silencio. Ahora `parseCommand` busca el primer prefijo coincidente entre `[config.prefix, '.', '!']`.
- Null-safety en `loadReminders`, `loadPolls` y `loadListas` de `PersistenceService`: los datos nulos o corruptos en Redis provocaban excepciones del tipo `Cannot read properties of null`. Se agregaron verificaciones antes de acceder a las propiedades.
- Los errores al instanciar comandos en `PluginLoader` se registraban sin identificar el archivo causante; ahora el contexto del error incluye el archivo.

## [7.0.0] - 2026-06-23

- Lanzamiento de la serie 7.x. Las versiones anteriores no cuentan con changelog detallado.
