# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

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
