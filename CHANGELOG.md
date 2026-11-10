# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/).

## [7.1.3] - 2026-10-01

### Changed

- Unified Docker image tag convention without the `v` prefix across both pipelines: `ci.yml` (push to main) and `release.yml` (Git tags) now publish the same `X.Y.Z`, `X.Y`, `X` and `latest` formats, following common Docker registry conventions.

### Fixed

- The `{{minor}}` pattern of `metadata-action` produced only the minor digit (junk tags `1`, `6`, `12`... on ghcr.io) instead of the floating minor; it now uses `{{major}}.{{minor}}` and each release publishes the `X.Y` tag.

### Removed

- The raw Git tag (`vX.Y.Z`) is no longer published on the release Docker image: the semver patterns cover the full version and the raw tag only duplicated the release under a different convention.

## [7.1.2] - 2026-10-01

### Added

- Quick install script `OrbitBot.sh` versioned in the repository, replacing the external gist from the quick start: resolves the version to install from the argument (with or without `v`), the local `package.json`, or the latest GitHub release; detects apt/dnf/pacman, requires Node.js 20+, applies the `whatsapp-rust-bridge` patch and creates an initial `.env` with pairing-code authentication.
- `OrbitBot.sh` included in the CI `shellcheck` job.

### Changed

- `install-termux.sh` now shows the project version read dynamically from `package.json` (header, help, log and banner) instead of a fixed version that went stale on every release, using the same dependency-free mechanism (`sed`) with a fallback when the file is missing.

### Fixed

- The README quick start URL pointed to a nonexistent gist (404); it now serves the script from `raw.githubusercontent.com` and the example is pinned to the release version.

## [7.1.1] - 2026-10-01

### Added

- `shellcheck` job in the CI pipeline validating the repository `.sh` scripts (`deploy.sh`, `entrypoint.sh`, `install-termux.sh`, `stop.sh`) on every push and PR, blocking the Docker image publication on failure.
- "Termux (Android)" section in the README with the one-command install and a troubleshooting section for typical Termux errors (bot stopped when the phone sleeps, `npm install` OOM, startup after install, Node version, storage permissions and conversions without LibreOffice).

### Changed

- `install-termux.sh` adapted to the 7.x series: Node.js 20+ requirement with explicit verification, installation of PyMuPDF, pdf2docx and python-pptx for the document conversion bridge, `python3` symlink for `PythonBridge`, initial `.env` with `PHONE_NUMBER` and `USE_PAIRING_CODE` (pairing instead of QR), creation of `data/assets` and `data/backups` directories, and a warning about the LibreOffice limitation on Android.
- Format cleanup in LICENSE (no decorative lines) and aligned README tables.

### Fixed

- `install-termux.sh`: `--minimal` mode did not apply the `whatsapp-rust-bridge` patch because `--ignore-scripts` skips the `postinstall` and the bot would not start; the patch is now always applied. `A && B || C` patterns replaced with explicit `if/else` (ShellCheck SC2015).
- `entrypoint.sh`: the shebang was on the second line, so running the Docker entrypoint directly failed because it could not find the interpreter (ShellCheck SC1128).
- `deploy.sh`: unused variables removed (`STEEL`, `DB_AFTER`, `mnt`) and `local` declarations separated from their assignments to avoid masking exit codes (ShellCheck SC2034/SC2155).

## [7.1.0] - 2026-10-01

### Added

- Owner command `!lottery reset` (alias `--reset`) that allows restarting the lottery from the chat, with state persistence across bot restarts.
- Lottery tickets with unique codes generated via `crypto.randomBytes`.
- End-to-end suite for the main pipeline (full `!ping`, prefixless commands, message deduplication, offline echo) built on a harness with a `FakeWASocket` injected through `WASocketFactory`.
- Dedicated `e2e` job in the CI pipeline that blocks Docker image publication until the end-to-end tests pass.
- Coverage report to Codecov plus CI and coverage badges in the README.

### Fixed

- The `ping` alias was shadowed by `HealthCommand`; it now resolves to `PingCommand`. A cross-collision test (command name vs alias) was added to the command uniqueness test.
- Fixed 14 alias collisions between commands (`kick` → moderation, `top` → leaderboards, `truth` → game, `search` → web search with `SearchCommand` renamed to `find`, `quote`, `backup`/`restore` split, subbots, `health`, `vote`, `translate`, `poetry`, `flirt`, `love`, `kickout`).

### Changed

- README rewritten to reflect the real state of the project (install, commands, architecture, deployment).
- Test coverage is reported in `lcov` format for Codecov submission.

## [7.0.1] - 2026-06-26

### Fixed

- `parseCommand` only accepted `config.prefix`, while the pipeline detected commands with `config.prefix`, `.` and `!`. If the used prefix did not match exactly, the command was silently dropped. `parseCommand` now looks for the first matching prefix among `[config.prefix, '.', '!']`.
- Null-safety in `loadReminders`, `loadPolls` and `loadLists` of `PersistenceService`: null or corrupted data in Redis caused exceptions of the type `Cannot read properties of null`. Property access is now pre-checked.
- Errors when instantiating commands in `PluginLoader` were logged without identifying the offending file; the error context now includes the file.

## [7.0.0] - 2026-06-23

- Launch of the 7.x series. Previous versions have no detailed changelog.
