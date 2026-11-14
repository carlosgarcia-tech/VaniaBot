# OrbitBot — Estructura de la base de datos

> Cómo persiste datos OrbitBot: capa principal, archivos JSON sueltos, sesiones y sub-bots.
> Generado el 14 nov 2026 a partir del código fuente. Los archivos marcados *lazy* se crean al primer uso.

## Resumen: 3 capas de persistencia

| Capa | Mecanismo | Ubicación | Qué guarda |
|---|---|---|---|
| **A. Base de datos principal** | `IDatabase` (SQLite por defecto, también JSON y MongoDB) | `storage/database/orbit.db` | usuarios/economía, grupos, sub-bots (slots), moderación, recordatorios, IA, estado del bot principal |
| **B. Stores JSON sueltos** | `JsonFileStore` (escritura atómica) | `database/*.json` y `data/*.json` | moderación específica, torneos, lotería, buffers de chat, configs de features |
| **C. Sesiones y artefactos** | Baileys + backups | `orbitsession/`, `data/subbot-sessions/`, `data/backups/` | credenciales de WhatsApp del bot principal y de cada sub-bot |

---

## A. Base de datos principal

### A.1. El motor

- **Abstracción:** `src/services/database/Database.ts` — interfaz `IDatabase` (colecciones clave/valor: `get/set/delete/find/update/getPaginated/count/clear/flush`).
- **Backend elegido por `env.DB_TYPE`** (`src/config/env.ts`, `src/services/system/Servicemanager.ts`):
  - `sqlite` (**default**) → `src/services/database/SQLiteAdapter.ts`
  - `json` → `src/services/database/JsonDatabase.ts` → escribe `data/database.json`
  - `mongodb` → `src/services/database/MongoDatabase.ts`
- **Motor SQLite real:** `src/repositories/Database.ts` — `getDatabase()`/`DatabaseManager` usa **sql.js en memoria** volcado a disco en `./storage/database/orbit.db` (guardado periódico + `forceSave()` al apagar, escritura atómica tmp+rename). Versionado de esquema en la tabla `_migrations`, migraciones append-only v1–v24.
- **Durabilidad en modo JSON:** `src/services/database/BatchWriter.ts` agrupa escrituras pequeñas (cada 2s, máx 50) en un WAL en `data/wal/pending_writes.json`, que se re-playa al arrancar (WAL corrupto se descarta).

### A.2. Tablas SQLite (por migración)

| Tabla | Versión | Contenido |
|---|---|---|
| `subbots` | v1 | Config legacy de sub-bots: id, phone_number, display_name, role, status, enabled, owner, session_path, prefix, bio, photo_url, autostart, safe_mode, feature_flags |
| `subbot_slots` | v2 | Los **50 slots** de sub-bots: slot_number PK, bot_id, owner_jid/name, phone_number, name, status (default `'free'`), requester, fechas de request/release/connect, bio, photo_url |
| `subbot_settings` | v3 | Clave/valor global de sub-bots (`maxSlots=50`, `publicRequests=true`) |
| `cooldowns` | v4 | Esquema existe pero **nadie lo escribe**; los cooldowns de comandos son solo en memoria (`CommandRegistry`) |
| `locks`, `jobs` | v5, v6+v12 | Cola de tareas y locks del sistema |
| `anticall_config`, `anticall_blocked_users` | v7, v8 | Espejo SQL legacy del store JSON de anticall |
| `bot_runtime_state` | v9+v13+v24 | Estado del **bot principal** para watchdog: is_connected, last_heartbeat, connection_state, reconnect_attempts, restart_count, último motivo de desconexión, memoria, latencia, errores, mensajes, cuarentena |
| `health_events` | v10 | Eventos del sistema de salud |
| `orchestrator_state` | v11 | Estado del orquestador |
| `processed_messages` | v14 | Deduplicación de mensajes por message_id |
| `users` | v15+v23 | **Registro principal de usuarios** (ver A.3) |
| `groups` | v16 | Configuración por grupo (ver A.4) |
| `orbit_toggle` | v17 | Bot activado/desactivado por chat |
| `reports` | v18 | Reportes/bugs/feedback de usuarios |
| `reminders`, `polls`, `listas` | v19+v22 | Recordatorios, encuestas y listas de juego |
| `mutes`, `bans`, `moderation_logs` | v21 | Moderación |
| `ai_sessions` | v21 | Historiales de conversación con IA |

> Mapeo de colecciones del `SQLiteAdapter` (`SQLiteAdapter.ts`): `system:reminders`→`reminders`, `system:polls`→`polls`, `game:listas`→`listas`, más `bans`, `mutes`, `moderation_logs`. Columnas TEXT con JSON codificado, parseadas al leer.

### A.3. `users` — el registro central (economía, XP, RPG, quiz)

**Código:** `src/services/database/UserService.ts` — colección `'users'`, clave = JID del usuario. Auto-crea registros. Las cuentas **owner van fijadas** en `money=999999999`, `level=999`, `xp=999999`.

```
User {
  jid, name,
  isOwner, isBanned,
  level, xp,
  money,                    // wallet
  bank,
  lastDaily, lastWeekly, lastMonthly,   // cooldowns de reclamos
  weeklyStreak,
  totalCommands, warnings,
  inventory: InventoryItem[],
  achievements,
  createdAt, updatedAt,
  currentClass,             // clase RPG
  stats: RPGStats,
  pets, activeQuests, completedQuests, activeBuffs,
  // solo en SQL:
  premium, premium_expires_at, daily_streak, last_daily, quizStats
}

InventoryItem { itemId, name, type, rarity, quantity, stats,
                useEffect { heal|buff|restoreEnergy|restoreStamina|xpBoost },
                equipped, purchasedAt, expiresAt }

RPGStats { hp, maxHp, energy, stamina,
           atk, def, str, int, agi, vit, luck,
           critChance, dodgeChance }
```

**Quién lo usa:** todos los comandos de economía (`src/commands/economy/`: balance, bank, deposit/withdraw, daily/weekly/monthly, work, crime, mine, fish, hunt, beg, heist, pay, casino, spin, shop/buy, loans), servicios RPG (`src/services/rpg/`), profile/top/stats, y el sistema de quiz (`UserQuizStats` en `src/services/study/QuizTypes.ts`, escrito por QuizCommand/QuizStatsCommand/QuizTopCommand/QuizAnswerHandler).

### A.4. `groups` — configuración por grupo

**Código:** `src/services/database/GroupService.ts`, colección `'groups'`, clave = JID del grupo.

```
GroupSettings {
  name, isActive, onlyAdmin,
  welcome, goodbye         { enabled, message }
  antiSpam                 { enabled, maxMessages, timeWindow }
  antiLink                 { enabled, allowedDomains }
  antiWords                { enabled, words }
  levels                   { enabled, announceOnLevelUp }
  economy                  { enabled }
  audios, nsfw,
  prime                    { enabled }
  license                  { planType, paymentType, activatedAt, expiresAt,
                             renewAt, lastRenewAt, autoRenew, pricePaid }   // PrimeService/LicenseService
  autoMod,
  stats                    { totalMessages, totalCommands }
}
```

### A.5. Otras colecciones `IDatabase`

| Colección | Código | Forma | Usado por |
|---|---|---|---|
| `system:reminders` | `src/services/system/PersistenceService.ts` | `Reminder {id, userJid, chatJid, message, triggerAt, createdAt}` (cap 1000) | recordatorios |
| `system:polls` | idem | `Poll {id, chatJid, creatorJid, question, options[{label, votes[]}], allowMultiple, endsAt, closed}` | encuestas |
| `game:listas` | idem | `ListaPersistida {tipo, chatJid, messageId, horaTexto/horaMex/horaCol, liga, color, escuadras[{jugadores[{jid,nombre}], capacidad}], suplentes, maxSuplentes, creadoEn, activa}` | listas de juego (roster) |
| `bans` | `src/services/moderation/ModerationService.ts` | `BanRecord {userId, userName, bannedBy, reason, timestamp, groupId}` | ban |
| `mutes` | idem | `MuteRecord {... + duration, expiresAt}` | mute |
| `moderation_logs` | idem | `ModerationAction {userId, userName, action, reason, moderator, timestamp, duration?, expiresAt?}` | log de warn/ban/kick/mute |
| `reports` | `src/services/system/ReportService.ts` | `{id, type:'report'|'bugreport'|'feedback', fromJid, fromName, fromGroup, content, timestamp, status, readAt, resolvedAt, resolvedBy}` | reporte/bug |
| `orbit_toggle` | `src/services/system/OrbitToggleService.ts` | `ToggleRecord {key, chatJid, botId, enabled, enabledBy/At, disabledBy/At}` | activar/desactivar el bot por chat |
| `nsfw_toggle` | `src/services/system/NsfwToggleService.ts` | `{key, scope (jid de grupo o GLOBAL), enabled, changedBy, changedAt}` | nsfw on/off |
| `ai_sessions` | `src/services/external/AISessionStore.ts` (clave `chatJid::senderJid`) | `ConversationSession {chatJid, senderJid, history: AIMessage[{role, content}], createdAt, lastActivity}` | memoria de conversación con IA, persist periódica + TTL |
| `game_state` | `src/services/rpg/GameStateService.ts` (clave única `'state'`) | `PersistedGameState {marketOffers[], userMissions[], activeCombats[], loans[], savedAt}` — auto-save cada 60s si hay cambios | mercado de jugadores, misiones diarias, combates activos, préstamos (`LoanService`, `TradeService`, `DailyMissionService`, `CombatService`, `MobService`) |

---

## B. Stores JSON sueltos (`JsonFileStore`)

**Mecanismo:** `src/utils/JsonFileStore.ts` — carga con defaults si el archivo falta o está corrupto (reset, nunca lanza), `validate()` opcional para normalizar archivos editados a mano, y **escritura atómica** (tmp en el mismo dir + rename). Sin TTL ni WAL: eso viven en los consumidores.

| Store | Código | Archivo | Forma | Usado por |
|---|---|---|---|---|
| Antilink | `src/services/moderation/AntilinkService.ts` | `database/antilink.json` *lazy* | `{ groups: { gid: { enabled, mode:'kick'\|'delete', blockWhatsappGroups, blockWhatsappChannels, blockOtherLinks, whitelist[] } } }` | antilink |
| AntiArab | `src/services/moderation/AntiArabService.ts` | `database/antiarab.json` *lazy* | `{ groups: { gid: { enabled, prefixes[] } } }` (16 prefijos país por defecto) | antiarab |
| Resumen de chat | `src/services/chat/ChatSummaryService.ts` | `database/resumirchat-buffer.json` | `{ trackedSince, groups: { gid: ChatMessage[{sender, text, at}] } }` (cap 260 msgs/grupo) — **runtime, nunca commitear** | `!resumir` |
| FreeFire torneos | `src/services/games/FreeFireService.ts` | `database/freefire-torneos.json` *lazy* | `{ groups: { gid: { activeTournamentId, tournaments: { id: Tournament{id, name, createdBy/At, status:'activo'\|'cerrado', scoreRules{win,draw,loss}, formatRules{mode,teamSize,roundsBestOf,roundsToWin,mapsBestOf}, clans: Clan[name, points, wins/draws/losses, killsFor/Against, players[{jid,number,nick,joinedAt}], lineup], matches[{id, clanA, clanB, round, status:'pendiente'\|'jugado', result, sformat}] } } } } }` | comandos de torneos FF |
| Resilience | `src/services/system/ResilienceService.ts` | `database/resilience.json` *lazy* | `{ enabled, threshold(4), windowMs(10min), cooldownMs(15min), commands: { cmd: { failures[], disabledUntil, lastError, lastFailureAt } } }` | circuit-breaker por comando (todos) |
| AntiDelete | `src/services/system/AntiDeleteService.ts` | `data/antidelete.json` | `{ enabled, groups: { gid: boolean } }` (validado) — el buffer de mensajes (500, 24h) es **solo RAM**; medios recuperados van a `tmp/antidelete` | antidelete |
| AntiCall | `src/services/system/AntiCallService.ts` | `data/anticall.json` | `{ enabled, blockedUsers[] }` (validado) | anticall (rechazar llamadas) |
| Lotería | `src/commands/economy/LotteryCommand.ts` | `data/lottery.json` | `LotteryState { tickets[{number, buyerJid, buyerName, purchasedAt}], prizePool, lastDraw, ticketPrice(1000) }` (validado) | `!loteria` |

> El directorio `database/` en disco solo tiene lo que se haya usado; los demás se crean lazy al primer uso de la feature.

---

## C. Sesiones y artefactos de autenticación

| Qué | Dónde | Código |
|---|---|---|
| **Sesión Baileys del bot principal** | `orbitsession/` (`env.SESSION_PATH`, default `./orbitsession`) — `creds.json`, `pre-key-*.json`, `session-*.json`, `sender-key-*.json`, `app-state-sync-*.json`, `lid-mapping-*.json` (JSON plano) | `src/core/AuthManager.ts` (`useMultiFileAuthState`) |
| **Backups de sesión** | `data/backups/session_backup_<ts>/` — copia `creds.json`, `pre-key-*`, `session-*`, `app-state-*` cada **30 min**, rotando **5** snapshots + `backup_metadata.json` | `src/services/system/SessionBackupService.ts` |
| **Sesiones de sub-bots** | `data/subbot-sessions/<botId>/` (o `/app/subbot-sessions` en Docker) — con `SESSION_ENCRYPTION_KEY` los archivos van **AES-256-GCM** (`iv:authTag:ciphertext` hex, clave derivada con scrypt; acepta legacy plano) | `src/config/subbot.ts` (`SESSION_BASE_PATH`), `src/services/subbot/EncryptedAuthState.ts`, `src/utils/encryption.ts` |
| **Snapshot de DB JSON** | `data/backups/db_backup_<ts>.json` (solo si `DB_TYPE=json`, máx 5) | `JsonDatabase` |
| **Flag de arranque** | `data/.orbit-session` (`ORBIT_RUNNING`) — salta la animación del banner en boots repetidos | `src/orbit.ts`, `src/index.ts` |

---

## D. Sub-bots

| Capa | Dónde | Forma | Código |
|---|---|---|---|
| **Slots y configuración** | SQLite `orbit.db` (tablas `subbot_slots`, `subbot_settings`, `subbots`) | `SubBotSlot` (50 slots): slot, id, ownerJid/Name, phoneNumber, name, status (`'free'`/otros), requester, fechas, bio, photo | `src/services/subbot/SubBotDatabase.ts` (caches en memoria espejo de SQL) |
| **Estado runtime por bot** | `data/runtime/bot-states/<botId>.json` | `BotRuntimeState { id, recentMessageIds (dedup, TTL 60s, máx 4000), contactNameCache ({name, cachedAt}, TTL 10min, máx 3000), lastProfileAppliedAt, lastProfileSignature, pairingPendingAt }` — Maps serializados como arrays `[key, ts]` | `src/services/subbot/SubBotRuntimeStore.ts` (escritor atómico propio, TTL 120s, writes con debounce 5s) — **no** usa JsonFileStore |
| **Sesión WhatsApp de cada sub-bot** | `data/subbot-sessions/<botId>/` | auth state Baileys (cifrada si hay `SESSION_ENCRYPTION_KEY`) | `SubBotInstance.ts` + `EncryptedAuthState` |

---

## E. Mapa del directorio `data/` (y vecinos)

```
data/
├── assets/                  # imágenes estáticas (plantillas de cards, logos)
├── runtime/
│   └── bot-states/          # snapshot runtime de cada sub-bot (<botId>.json)
├── wal/
│   └── pending_writes.json  # WAL del BatchWriter (modo DB json)
├── temp/                    # efímero: downloads/, audio/, tmp de stickers/media
├── backups/
│   └── session_backup_*/    # backups rotativos de la sesión (5)
├── antidelete.json          # config antidelete
├── anticall.json            # config anticall
├── lottery.json             # estado de la lotería
├── .orbit-session           # flag de arranque
├── subbot-sessions/         # sesiones cifradas de sub-bots (lazy)
└── database.json            # solo si DB_TYPE=json

database/                    # stores JsonFileStore (lazy)
├── antilink.json
├── antiarab.json
├── freefire-torneos.json
├── resilience.json
└── resumirchat-buffer.json  # runtime, nunca commitear

storage/database/orbit.db    # SQLite (backend default)
orbitsession/                # credenciales Baileys del bot principal
tmp/antidelete/              # medios recuperados por antidelete
```

---

## F. Estado solo en memoria (NO se persiste)

| Estado | Dónde | Nota |
|---|---|---|
| Cooldowns de comandos | `src/core/CommandRegistry` (`Map`) | se pierden al reiniciar (la tabla `cooldowns` de SQLite existe pero está sin uso) |
| Cooldowns de poesía | `PoesiaService` (`Map`) | idem |
| Listados del mercado negro | `src/services/economy/BlackMarketService.ts` | ofertas en RAM |
| Contadores de antispam | `AntiSpamService` | rate counters en RAM |
| Buffer antidelete | `AntiDeleteService` | 500 mensajes / 24h en RAM; solo la *config* va a JSON |
| Leveling | `LevelService` | trabaja directamente sobre `users` |

---

*Fuente: inventario del código al 14 nov 2026. Verificado contra `src/` con grep; los JSON lazy no se verificados en disco salvo `resumirchat-buffer.json`.*
