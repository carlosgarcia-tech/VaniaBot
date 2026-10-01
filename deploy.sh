#!/bin/bash
set -e
NEON_GREEN='\033[38;5;82m'
MATRIX='\033[38;5;46m'
ELECTRIC='\033[38;5;51m'
HOT_PINK='\033[38;5;198m'
PURPLE='\033[38;5;129m'
VIOLET='\033[38;5;93m'
NEON_ORANGE='\033[38;5;214m'
NEON_YELLOW='\033[38;5;226m'
LIME='\033[38;5;154m'
WHITE='\033[38;5;231m'
GHOST='\033[38;5;240m'
RED='\033[38;5;196m'
CRIMSON='\033[38;5;160m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

VERSION="${1:-6.12.18}"
RAW_MODE="${2:-}"
IMAGE="ghcr.io/carlosgrciagrcia/vaniabot:${VERSION}"
START_TIME=$(date +%s%3N 2>/dev/null || echo 0)
UPDATE_MODE=false
[[ "$RAW_MODE" == "update" || "$RAW_MODE" == "--update" || "$RAW_MODE" == "-u" ]] \
  && UPDATE_MODE=true

if $UPDATE_MODE; then
  TOTAL_STEPS=5
  STEP_COLORS=("$NEON_ORANGE" "$HOT_PINK" "$LIME" "$ELECTRIC" "$PURPLE")
  STEP_PROTO=("IMAGE·PULL" "BACKUP·CHECK" "HOT·SWAP" "DATA·VERIFY" "SYS·VERIFY")
else
  TOTAL_STEPS=8
  STEP_COLORS=("$ELECTRIC" "$NEON_GREEN" "$VIOLET" "$HOT_PINK" "$NEON_ORANGE" "$LIME" "$PURPLE" "$ELECTRIC")
  STEP_PROTO=("NETWORK·INIT" "VOLUME·MOUNT" "PERM·FIX" "CONTAINER·PURGE" "REDIS·BOOT" "HEALTH·PROBE" "DATA·INIT" "BOT·DEPLOY")
fi

_HOST=$(hostname 2>/dev/null || echo "docker-host")
_USER=$(whoami  2>/dev/null || echo "root")
_DATE=$(date '+%Y.%m.%d %H:%M')
_DOCKER=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "?.?.?")

blank() { echo ""; }
elapsed() {
  local now ms
  now=$(date +%s%3N 2>/dev/null || echo 0)
  ms=$(( now - START_TIME ))
  (( ms < 1000 )) && echo "${ms}ms" || echo "$(( ms/1000 )).$(( (ms%1000)/100 ))s"
}
ok()   { echo -e "  ${NEON_GREEN}${BOLD}▶${NC}  ${WHITE}$1${NC}  ${GHOST}+$(elapsed)${NC}"; }
info() { echo -e "  ${GHOST}╌  $1${NC}"; }
warn() { echo -e "  ${NEON_YELLOW}${BOLD}◈  WARN${NC}  $1${NC}"; }
dim_()  { echo -e "  ${GHOST}${DIM}$1${NC}"; }
fail() {
  blank
  echo -e "  ${RED}${BOLD}╔══[ FATAL ]═══════════════════════════════════════╗${NC}"
  echo -e "  ${RED}${BOLD}║${NC}  ${WHITE}${BOLD}$1${NC}"
  echo -e "  ${RED}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
  blank
  exit 1
}
strip_ansi() { echo -e "$1" | sed 's/\x1b\[[0-9;]*[mK]//g'; }
typewrite() {
  local text="$1" delay="${2:-0.018}"
  for ((c=0; c<${#text}; c++)); do
    echo -ne "${text:$c:1}"
    sleep "$delay"
  done
}
hex_trace() {
  local label="$1" color="${2:-$GHOST}"
  echo -ne "  ${color}${DIM}${label}${NC}  "
  for i in $(seq 1 9); do
    printf "${GHOST}%04X${NC}" $(( RANDOM % 65536 ))
    echo -ne " "
    sleep 0.035
  done
  echo -e "  ${NEON_GREEN}${BOLD}✓${NC}"
}
matrix_rain() {
  local rows="${1:-6}"
  local chars="ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF"
  for ((r=0; r<rows; r++)); do
    local line="  "
    for ((i=0; i<38; i++)); do
      local ch="${chars:$(( RANDOM % ${#chars} )):1}"
      local roll=$(( RANDOM % 10 ))
      if   (( roll == 0 )); then line+="${WHITE}${BOLD}${ch} ${NC}"
      elif (( roll <= 2 )); then line+="${NEON_GREEN}${ch} ${NC}"
      elif (( roll <= 5 )); then line+="${MATRIX}${DIM}${ch} ${NC}"
      else                       line+="${GHOST}${DIM}${ch} ${NC}"
      fi
    done
    echo -e "$line"
    sleep 0.04
  done
}
glitch_line() {
  local text="$1" color="${2:-$ELECTRIC}" indent="${3:-2}"
  local gc='!@#^&*~+=|<>?/'
  local pre=""
  for ((i=0; i<indent; i++)); do pre+=" "; done
  for pass in 1 2 3 4 5; do
    local out=""
    for ((i=0; i<${#text}; i++)); do
      if (( RANDOM % (pass + 3) == 0 )); then
        out+="${gc:$(( RANDOM % ${#gc} )):1}"
      else
        out+="${text:$i:1}"
      fi
    done
    echo -ne "${pre}${color}${BOLD}${out}${NC}\r"
    sleep 0.05
  done
  echo -e "${pre}${color}${BOLD}${text}${NC}"
}
progress_bar() {
  local val="$1" max="$2" width="${3:-28}" color="${4:-$NEON_GREEN}"
  local filled=$(( val * width / max ))
  local pct=$(( val * 100 / max ))
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  (( filled < width )) && bar+="${GHOST}▌${NC}${color}"
  for ((i=filled+1; i<=width; i++)); do bar+="░"; done
  echo -ne "${color}${bar}${NC}  ${BOLD}${WHITE}${pct}%${NC}"
}
scan_line() {
  local label="$1" result="${2:-OK}" rcolor="${3:-$NEON_GREEN}"
  echo -ne "  ${GHOST}[${NC}${ELECTRIC}${BOLD}SYS${NC}${GHOST}]${NC}  "
  typewrite "$label" 0.008
  echo -e "  ${GHOST}·${NC}  ${rcolor}${BOLD}${result}${NC}"
  sleep 0.04
}
BOX_WIDTH=56
box_top()     { local c="$1"; echo -ne "  ${c}${BOLD}╔"; printf '═%.0s' $(seq 1 $BOX_WIDTH); echo -e "╗${NC}"; }
box_bottom()  { local c="$1"; echo -ne "  ${c}${BOLD}╚"; printf '═%.0s' $(seq 1 $BOX_WIDTH); echo -e "╝${NC}"; }
box_divider() { local c="$1"; echo -ne "  ${c}${BOLD}╠"; printf '═%.0s' $(seq 1 $BOX_WIDTH); echo -e "╣${NC}"; }
box_empty()   {
  local c="$1"
  echo -ne "  ${c}${BOLD}║${NC}"
  printf '%*s' $(( BOX_WIDTH + 2 )) ""
  echo -e "${c}${BOLD}║${NC}"
}
box_line() {
  local color="$1" content="$2"
  local clean len pad
  clean=$(strip_ansi "$content")
  len=${#clean}
  pad=$(( BOX_WIDTH - len - 2 ))
  (( pad < 0 )) && pad=0
  echo -ne "  ${color}${BOLD}║${NC} ${content}"
  printf '%*s' $pad ""
  echo -e " ${color}${BOLD}║${NC}"
}
thin_top() {
  local label="$1" color="${2:-$ELECTRIC}"
  local clean len dashes
  clean=$(strip_ansi "$label")
  len=${#clean}
  dashes=$(( BOX_WIDTH - len - 3 ))
  (( dashes < 1 )) && dashes=1
  echo -ne "  ${GHOST}┌─${NC} ${BOLD}${color}${label}${NC} ${GHOST}"
  printf '─%.0s' $(seq 1 $dashes)
  echo -e "┐${NC}"
}
thin_bottom() {
  echo -ne "  ${GHOST}└"
  printf '─%.0s' $(seq 1 $(( BOX_WIDTH + 2 )))
  echo -e "┘${NC}"
}
thin_line() {
  local content="$1"
  local clean len pad
  clean=$(strip_ansi "$content")
  len=${#clean}
  pad=$(( BOX_WIDTH - len - 1 ))
  (( pad < 0 )) && pad=0
  echo -ne "  ${GHOST}│${NC} ${content}"
  printf '%*s' $pad ""
  echo -e "${GHOST}│${NC}"
}
step() {
  local num="$1" label="$2"
  local color="${STEP_COLORS[$((num-1))]}"
  local proto="${STEP_PROTO[$((num-1))]}"
  blank
  local hdr="══[ STEP ${num}/${TOTAL_STEPS} ]═[ ${proto} ]"
  local hdr_len=${#hdr}
  local hpad=$(( BOX_WIDTH - hdr_len ))
  (( hpad < 0 )) && hpad=0
  echo -ne "  ${color}${BOLD}╔${hdr}"
  printf '═%.0s' $(seq 1 $hpad)
  echo -e "╗${NC}"
  box_line "$color" "${BOLD}${WHITE}${label}${NC}"
  local bar_content
  bar_content=$(progress_bar "$num" "$TOTAL_STEPS" 28 "$color")
  box_line "$color" "$bar_content"
  echo -ne "  ${color}${BOLD}╚"; printf '═%.0s' $(seq 1 $BOX_WIDTH); echo -e "╝${NC}"
  blank
  sleep 0.08
}
FRAMES=('⣾' '⣽' '⣻' '⢿' '⡿' '⣟' '⣯' '⣷')
spin_msg() {
  local idx="$1" msg="$2" cur="$3" max="$4"
  local fi=$(( (idx-1) % ${#FRAMES[@]} ))
  printf "  %s%s%s%s  %s%-40s%s  %s[%02d/%02d]%s\r" \
    "$ELECTRIC" "$BOLD" "${FRAMES[$fi]}" "$NC" \
    "$GHOST" "$msg" "$NC" \
    "$DIM" "$cur" "$max" "$NC"
}

boot_screen() {
  clear; blank; blank
  matrix_rain 6
  blank; sleep 0.3; clear; blank; blank
  local art=(
    "  ██╗   ██╗  █████╗  ███╗   ██╗ ██╗  █████╗ "
    "  ██║   ██║ ██╔══██╗ ████╗  ██║ ██║ ██╔══██╗"
    "  ██║   ██║ ███████║ ██╔██╗ ██║ ██║ ███████║"
    "  ╚██╗ ██╔╝ ██╔══██║ ██║╚██╗██║ ██║ ██╔══██║"
    "   ╚████╔╝  ██║  ██║ ██║ ╚████║ ██║ ██║  ██║"
    "    ╚═══╝   ╚═╝  ╚═╝ ╚═╝  ╚═══╝ ╚═╝ ╚═╝  ╚═╝"
  )
  local cols=("$ELECTRIC" "$ELECTRIC" "$PURPLE" "$PURPLE" "$HOT_PINK" "$HOT_PINK")
  for i in "${!art[@]}"; do
    glitch_line "${art[$i]}" "${cols[$i]}" 0
    sleep 0.035
  done
  blank
  local MODE_LABEL MODE_COLOR
  if $UPDATE_MODE; then
    MODE_LABEL="HOT-SWAP  ·  UPDATE MODE  ·  PERSISTENCE ENABLED"
    MODE_COLOR="$NEON_ORANGE"
  else
    MODE_LABEL="DEPLOY SYSTEM  ·  INSTALL MODE  ·  PERSISTENCE ENABLED"
    MODE_COLOR="$ELECTRIC"
  fi
  echo -e "  ${GHOST}╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌${NC}"
  echo -e "  ${MODE_COLOR}${BOLD}${MODE_LABEL}${NC}  ${GHOST}·${NC}  ${NEON_YELLOW}${BOLD}v${VERSION}${NC}"
  echo -e "  ${GHOST}╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌${NC}"
  blank; sleep 0.1
  thin_top "ENVIRONMENT" "$ELECTRIC"
  printf "  ${GHOST}│${NC}  ${GHOST}host${NC}  ${ELECTRIC}%-24s${NC}  ${GHOST}user${NC}  ${NEON_ORANGE}%-12s${NC}${GHOST}│${NC}\n" \
    "${_HOST:0:24}" "${_USER:0:12}"
  printf "  ${GHOST}│${NC}  ${GHOST}dock${NC}  ${NEON_GREEN}%-24s${NC}  ${GHOST}time${NC}  ${DIM}%-12s${NC}${GHOST}│${NC}\n" \
    "v${_DOCKER}" "${_DATE:0:12}"
  printf "  ${GHOST}│${NC}  ${GHOST}img ${NC}  ${DIM}%-52s${NC}${GHOST}│${NC}\n" "${IMAGE:0:52}"
  if $UPDATE_MODE; then
    local cur_ver
    cur_ver=$(docker inspect vaniabot --format '{{.Config.Image}}' 2>/dev/null \
      | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "none")
    printf "  ${GHOST}│${NC}  ${GHOST}prev${NC}  ${CRIMSON}%-24s${NC}  ${GHOST}next${NC}  ${LIME}%-12s${NC}${GHOST}│${NC}\n" \
      "${cur_ver}" "${VERSION}"
  fi
  thin_bottom
  blank
  hex_trace "MEM SCAN  " "$GHOST"
  hex_trace "NET SCAN  " "$GHOST"
  hex_trace "SYS PROBE " "$GHOST"
  blank
  echo -ne "  ${BOLD}${NEON_GREEN}"
  if $UPDATE_MODE; then
    typewrite "▶▶  OVERRIDE INICIADO  ·  SESIONES PRESERVADAS  ·  HOT-SWAP EN PROGRESO..." 0.015
  else
    typewrite "▶▶  TODOS LOS SISTEMAS LISTOS  ·  INICIANDO SECUENCIA DE DEPLOY..." 0.015
  fi
  echo -e "${NC}"; blank; sleep 0.3
}

check_persistence() {
  local vol_name="$1"
  local check_path="$2"
  local file_count
  file_count=$(docker run --rm -v "${vol_name}:/check" alpine sh -c "ls -1 /check${check_path} 2>/dev/null | wc -l" 2>/dev/null || echo "0")
  echo "$file_count"
}

migrate_subbot_sessions() {
  info "${GHOST}verificando migración de sesiones de subbots...${NC}"
  local OLD_PATH="/app/data/subbot-sessions"
  local NEW_PATH="/app/subbot-sessions"

  local old_count
  old_count=$(docker run --rm -v vaniabot_database:/check alpine sh -c "ls -1 /check${OLD_PATH} 2>/dev/null | wc -l" 2>/dev/null || echo "0")
  local new_count
  new_count=$(docker run --rm -v vaniabot_subbot_sessions:/check alpine sh -c "ls -1 /check${NEW_PATH} 2>/dev/null | wc -l" 2>/dev/null || echo "0")

  if [ "$old_count" -gt 2 ] && [ "$new_count" -le 2 ]; then
    info "${NEON_YELLOW}Migrando sesiones de ${OLD_PATH} → ${NEW_PATH}${NC}"
    docker run --rm \
      -v vaniabot_database:/old \
      -v vaniabot_subbot_sessions:/new \
      alpine sh -c "
        mkdir -p /new/subbot-sessions
        cp -a /old${OLD_PATH}/. /new${NEW_PATH}/ 2>/dev/null || true
        chown -R 1001:1001 /new${NEW_PATH} 2>/dev/null || true
      " 2>/dev/null \
      && ok "Sesiones migradas: ${NEON_GREEN}${BOLD}$((old_count-2)) sesiones${NC}" \
      || warn "Migración falló — sesiones originales intactas"
  elif [ "$new_count" -gt 2 ]; then
    ok "Sesiones ya en ubicación correcta: ${NEON_GREEN}${BOLD}$((new_count-2)) sesiones${NC}"
  else
    info "${GHOST}Sin sesiones previas para migrar${NC}"
  fi
}

fix_permissions() {
  local vol_name="$1"
  local mount_path="$2"
  docker run --rm -v "${vol_name}:${mount_path}" alpine sh -c "chown -R 1001:1001 ${mount_path} && chmod -R 755 ${mount_path}" 2>/dev/null
}

launch_redis() {
  docker run -d \
    --name vania-redis \
    --network vania-network \
    --restart unless-stopped \
    -v vania-redis-data:/data \
    redis:7-alpine \
    redis-server \
      --appendonly yes \
      --appendfsync everysec \
      --no-appendfsync-on-rewrite no \
      --save 60 1 \
      --save 300 1 \
      --dir /data \
      --loglevel notice > /dev/null 2>&1
}

launch_vaniabot() {
  docker run -d \
    --name vaniabot \
    --network vania-network \
    --restart unless-stopped \
    --env-file .env \
    -e NODE_ENV=production \
    -e TZ=America/Mexico_City \
    -e AUTH_MODE="${AUTH_MODE:-qr}" \
    -e DOCKER_MODE=true \
    -e USE_REDIS=true \
    -e REDIS_HOST=vania-redis \
    -e REDIS_PORT=6379 \
    -e SESSION_PATH=/app/vaniasession \
    -e DATA_PATH=/app/data \
    -e SUBBOT_SESSIONS_PATH=/app/subbot-sessions \
    -e ASSETS_DIR=/app/static/assets \
    -v vaniabot_session:/app/vaniasession \
    -v vaniabot_database:/app/data \
    -v vaniabot_storage:/app/storage \
    -v vaniabot_subbot_sessions:/app/subbot-sessions \
    -v vaniabot_temp:/app/temp \
    -p 3000:3000 \
    --user 1001:1001 \
    --memory=4g \
    --cpus=1.5 \
    --stop-signal=SIGTERM \
    --stop-timeout=15 \
    "$IMAGE" > /dev/null 2>&1
}

boot_screen

if $UPDATE_MODE; then

  step 1 "Descargando nueva imagen"
  info "${GHOST}imagen  :${NC} ${NEON_ORANGE}${BOLD}${IMAGE}${NC}"
  blank
  if ! docker pull "$IMAGE"; then
    fail "No se pudo descargar la imagen ${IMAGE}"
  fi
  ok "Imagen ${NEON_ORANGE}${BOLD}${IMAGE}${NC} lista"

  step 2 "Verificando persistencia y creando backup"
  info "${GHOST}verificando datos existentes...${NC}"
  blank

  SESSION_COUNT=$(check_persistence "vaniabot_session" "")
  DB_COUNT=$(check_persistence "vaniabot_database" "")
  STORAGE_COUNT=$(check_persistence "vaniabot_storage" "")

  OLD_SUBBOT_COUNT=$(check_persistence "vaniabot_database" "/data/subbot-sessions")
  NEW_SUBBOT_COUNT=$(check_persistence "vaniabot_subbot_sessions" "")
  if [ "$NEW_SUBBOT_COUNT" -gt 2 ]; then
    SUBBOT_COUNT=$NEW_SUBBOT_COUNT
  else
    SUBBOT_COUNT=$OLD_SUBBOT_COUNT
  fi

  if [ "$SESSION_COUNT" -gt 2 ]; then
    ok "Sesiones encontradas: ${NEON_GREEN}${BOLD}$((SESSION_COUNT-2)) archivos${NC}"
  else
    warn "No hay sesiones previas - se generará una nueva"
  fi

  if [ "$DB_COUNT" -gt 1 ]; then
    ok "Datos en /app/data: ${NEON_GREEN}${BOLD}$((DB_COUNT-1)) archivos${NC}"
  else
    warn "Volumen /app/data vacío"
  fi

  if [ "$STORAGE_COUNT" -gt 1 ]; then
    ok "Base de datos SQLite encontrada en storage: ${NEON_GREEN}${BOLD}$((STORAGE_COUNT-1)) archivos${NC}"
  else
    warn "Sin DB previa en storage — se creará nueva al iniciar"
  fi

  if [ "$SUBBOT_COUNT" -gt 1 ]; then
    ok "Sesiones de subbots encontradas: ${NEON_GREEN}${BOLD}$((SUBBOT_COUNT-1)) sesiones${NC}"
  else
    warn "Sin sesiones de subbots previas — se crearán al registrar subbots"
  fi

  REDIS_KEYS=$(docker exec vania-redis redis-cli DBSIZE 2>/dev/null || echo "0")
  if [ "$REDIS_KEYS" -gt 0 ]; then
    ok "Redis tiene ${NEON_GREEN}${BOLD}${REDIS_KEYS} keys${NC} persistidos (subbots incluidos)"
    docker exec vania-redis redis-cli BGSAVE 2>/dev/null || true
    docker exec vania-redis redis-cli BGREWRITEAOF 2>/dev/null || true
    sleep 3  
    ok "Redis ${GHOST}→${NC} flush a disco completado"
  else
    warn "Redis sin datos activos"
  fi

  BACKUP_TAG=$(date '+%Y%m%d-%H%M%S')
  BACKUP_DIR="./vania-backups/${BACKUP_TAG}"
  mkdir -p "${BACKUP_DIR}"
  info "${GHOST}creando backup en ${NEON_YELLOW}${BACKUP_DIR}${NC}..."
  docker run --rm \
    -v vaniabot_database:/src-db \
    -v vaniabot_session:/src-ses \
    -v vaniabot_storage:/src-storage \
    -v vaniabot_subbot_sessions:/src-subbots \
    -v vania-redis-data:/src-redis \
    -v "$(pwd)/${BACKUP_DIR}:/backup" \
    alpine sh -c "
      mkdir -p /backup/database /backup/session /backup/storage /backup/subbot-sessions /backup/redis
      cp -a /src-db/.       /backup/database/         2>/dev/null || true
      cp -a /src-ses/.      /backup/session/           2>/dev/null || true
      cp -a /src-storage/.  /backup/storage/           2>/dev/null || true
      cp -a /src-subbots/.  /backup/subbot-sessions/   2>/dev/null || true
      cp -a /src-redis/.    /backup/redis/             2>/dev/null || true
    " 2>/dev/null \
    && ok "Backup guardado en ${NEON_YELLOW}${BACKUP_DIR}${NC} (incl. subbots + redis)" \
    || warn "Backup falló — continuando de todas formas"

  step 3 "Hot-swap del contenedor VaniaBot"
  info "${GHOST}alcance :${NC} ${DIM}solo 'vaniabot' — redis y volúmenes intactos${NC}"
  blank

  docker stop vaniabot 2>/dev/null \
    && ok "vaniabot ${GHOST}detenido${NC}" \
    || warn "vaniabot no estaba corriendo"
  sleep 2

  migrate_subbot_sessions

  fix_permissions "vaniabot_session"          "/app/vaniasession"
  fix_permissions "vaniabot_database"         "/app/data"
  fix_permissions "vaniabot_storage"          "/app/storage"
  fix_permissions "vaniabot_subbot_sessions"  "/app/subbot-sessions"

  docker rm vaniabot 2>/dev/null \
    && ok "vaniabot ${GHOST}removido${NC}" \
    || info "nada que remover"
  blank

  docker volume create vaniabot_storage          2>/dev/null || true
  docker volume create vaniabot_subbot_sessions  2>/dev/null || true

  launch_vaniabot
  ok "VaniaBot ${LIME}${BOLD}ONLINE${NC}  ${GHOST}·${NC}  ${NEON_YELLOW}${BOLD}v${VERSION}${NC}  ${GHOST}·${NC}  ${GHOST}:3000${NC}"

  step 4 "Verificando datos post-deploy"
  MAX=30; attempt=0
  until docker ps --filter "name=^vaniabot$" --filter "status=running" | grep -q vaniabot; do
    attempt=$(( attempt + 1 ))
    (( attempt >= MAX )) && fail "El contenedor no levantó en ${MAX}s"
    spin_msg "$attempt" "Waiting for status=running..." "$attempt" "$MAX"
    sleep 1
  done
  printf "\n"
  ok "Contenedor en estado ${NEON_GREEN}${BOLD}RUNNING${NC}"

  sleep 6
  SESSION_AFTER=$(docker exec vaniabot ls -la /app/vaniasession/ 2>/dev/null | wc -l)
  STORAGE_AFTER=$(docker exec vaniabot find /app/storage -name "*.db" 2>/dev/null | wc -l)
  SUBBOT_AFTER=$(docker exec vaniabot ls -la /app/subbot-sessions/ 2>/dev/null | wc -l)
  REDIS_AFTER=$(docker exec vania-redis redis-cli DBSIZE 2>/dev/null || echo "0")

  if [ "$SESSION_AFTER" -gt 2 ]; then
    ok "Sesiones preservadas: ${NEON_GREEN}${BOLD}$((SESSION_AFTER-2)) archivos${NC}"
  else
    warn "Las sesiones no se preservaron — puede requerir nuevo QR"
  fi

  if [ "$STORAGE_AFTER" -gt 0 ]; then
    ok "Base de datos SQLite ${NEON_GREEN}${BOLD}PERSISTENTE${NC}  ${GHOST}·${NC}  ${DIM}/app/storage/database/vania.db${NC}"
  else
    warn "DB aún no visible — el app puede estar inicializándola"
  fi

  if [ "$SUBBOT_AFTER" -gt 2 ]; then
    ok "Subbots preservados: ${NEON_GREEN}${BOLD}$((SUBBOT_AFTER-2)) sesiones${NC}  ${GHOST}·${NC}  ${DIM}/app/subbot-sessions/${NC}"
  else
    warn "Sin sesiones de subbots activas aún"
  fi

  ok "Redis keys post-swap: ${NEON_GREEN}${BOLD}${REDIS_AFTER}${NC}"

  step 5 "Verificando despliegue final"
  ok "VaniaBot operativo con datos intactos"
  blank
  matrix_rain 2; blank
  box_top    "$LIME"
  box_empty  "$LIME"
  box_line   "$LIME" "${BOLD}${WHITE}✔  HOT-SWAP COMPLETADO  ·  DATOS PRESERVADOS${NC}"
  box_empty  "$LIME"
  box_divider "$LIME"
  box_line   "$LIME" "${GHOST}vaniabot    ${NC}${LIME}${BOLD}● RUNNING${NC}    ${GHOST}·${NC}  ${GHOST}redis       ${NC}${NEON_GREEN}${BOLD}● INTACTO${NC}"
  box_line   "$LIME" "${GHOST}sesiones    ${NC}${ELECTRIC}${BOLD}● $((SESSION_AFTER-2)) FILES${NC}   ${GHOST}·${NC}  ${GHOST}subbots     ${NC}${NEON_GREEN}${BOLD}● $((SUBBOT_AFTER-2)) SESIONES${NC}"
  box_line   "$LIME" "${GHOST}db-storage  ${NC}${NEON_GREEN}${BOLD}● PERSISTENTE${NC}  ${GHOST}·${NC}  ${GHOST}redis-keys  ${NC}${NEON_GREEN}${BOLD}● ${REDIS_AFTER}${NC}"
  box_line   "$LIME" "${GHOST}backup      ${NC}${NEON_YELLOW}${BOLD}● ${BACKUP_TAG}${NC}"
  box_line   "$LIME" "${GHOST}version     ${NC}${NEON_YELLOW}${BOLD}v${VERSION}${NC}         ${GHOST}·${NC}  ${GHOST}elapsed     ${NC}${DIM}$(elapsed)${NC}"
  box_empty  "$LIME"
  box_bottom "$LIME"

else

  step 1 "Creando red Docker"
  if docker network create vania-network 2>/dev/null; then
    ok "Red ${ELECTRIC}${BOLD}vania-network${NC} creada"
  else
    warn "La red ya existe · continuando"
  fi

  step 2 "Montando volúmenes persistentes"
  for vol in vaniabot_session vaniabot_database vaniabot_storage vaniabot_subbot_sessions vaniabot_temp vania-redis-data; do
    if docker volume create "$vol" 2>/dev/null; then
      ok "Volumen ${NEON_GREEN}${BOLD}${vol}${NC}"
    else
      warn "${vol} ya existe · datos preservados"
    fi
    sleep 0.06
  done

  step 3 "Configurando permisos correctos"
  info "${GHOST}estableciendo permisos para UID 1001...${NC}"
  for vol_mount in \
    "vaniabot_session:/app/vaniasession" \
    "vaniabot_database:/app/data" \
    "vaniabot_storage:/app/storage" \
    "vaniabot_subbot_sessions:/app/subbot-sessions" \
    "vaniabot_temp:/app/temp"
  do
    vol="${vol_mount%%:*}"
    docker run --rm -v "${vol}:/data" alpine sh -c "mkdir -p /data && chown -R 1001:1001 /data && chmod -R 755 /data" 2>/dev/null
    ok "Permisos configurados para ${NEON_GREEN}${BOLD}${vol}${NC}"
  done

  step 4 "Purgando contenedores anteriores"
  if docker rm -f vaniabot vania-redis 2>/dev/null; then
    ok "Contenedores anteriores eliminados"
  else
    info "Sin contenedores previos que purgar"
  fi

  step 5 "Iniciando Redis con persistencia AOF+RDB"
  info "${GHOST}imagen  :${NC} ${DIM}redis:7-alpine${NC}"
  info "${GHOST}red     :${NC} ${DIM}vania-network${NC}"
  info "${GHOST}storage :${NC} ${DIM}vania-redis-data  ·  AOF everysec + RDB snapshots${NC}"
  info "${GHOST}motivo  :${NC} ${DIM}subbots en Redis sobreviven reinicios del servidor${NC}"
  blank
  launch_redis
  ok "Contenedor ${HOT_PINK}${BOLD}vania-redis${NC} online  ${GHOST}·${NC}  ${DIM}persistencia AOF+RDB activa${NC}"

  step 6 "Verificando salud de Redis"
  MAX=30; attempt=0
  until docker exec vania-redis redis-cli ping 2>/dev/null | grep -q PONG; do
    attempt=$(( attempt + 1 ))
    (( attempt >= MAX )) && fail "Redis no respondió en ${MAX}s"
    spin_msg "$attempt" "Awaiting PONG response..." "$attempt" "$MAX"
    sleep 1
  done
  printf "\n"
  ok "Redis ${GHOST}→${NC}  ${NEON_GREEN}${BOLD}PONG${NC}  ·  latencia nominal"

  AOF_STATUS=$(docker exec vania-redis redis-cli CONFIG GET appendonly 2>/dev/null | tail -1 || echo "unknown")
  if [ "$AOF_STATUS" = "yes" ]; then
    ok "AOF persistence ${NEON_GREEN}${BOLD}ENABLED${NC}  ${GHOST}·${NC}  ${DIM}subbots sobreviven reinicios${NC}"
  else
    warn "AOF no confirmado — verificar configuración de Redis"
  fi

  step 7 "Inicializando estructura de datos"
  info "${GHOST}preparando directorios (incl. subbot-sessions dedicado)...${NC}"
  docker run --rm \
    -v vaniabot_database:/app/data \
    -v vaniabot_session:/app/vaniasession \
    -v vaniabot_storage:/app/storage \
    -v vaniabot_subbot_sessions:/app/subbot-sessions \
    -v vaniabot_temp:/app/temp \
    alpine \
    sh -c "
      mkdir -p \
        /app/data/temp \
        /app/vaniasession \
        /app/storage/database \
        /app/subbot-sessions \
        /app/temp \
      && chown -R 1001:1001 \
        /app/data /app/vaniasession /app/storage /app/subbot-sessions /app/temp \
      && chmod -R 755 \
        /app/data /app/vaniasession /app/storage /app/subbot-sessions /app/temp
    " 2>/dev/null
  ok "${NEON_ORANGE}Estructura de directorios${NC} lista  ${GHOST}·${NC}  ${DIM}/app/subbot-sessions dedicado${NC}"

  step 8 "Deployando VaniaBot"
  info "${GHOST}imagen    :${NC} ${NEON_ORANGE}${BOLD}${IMAGE}${NC}"
  info "${GHOST}red       :${NC} ${NEON_ORANGE}vania-network${NC}"
  info "${GHOST}recursos  :${NC} ${NEON_ORANGE}4g RAM${NC}  ${GHOST}·${NC}  ${NEON_ORANGE}1.5 CPUs${NC}"
  info "${GHOST}subbots   :${NC} ${NEON_ORANGE}/app/subbot-sessions${NC}  ${GHOST}→${NC}  ${DIM}vaniabot_subbot_sessions (persistente)${NC}"
  blank
  launch_vaniabot
  ok "VaniaBot ${LIME}${BOLD}ONLINE${NC}  ${GHOST}·${NC}  ${NEON_YELLOW}${BOLD}:3000${NC}"
  blank; sleep 0.2
  matrix_rain 3; blank
  box_top    "$NEON_GREEN"
  box_empty  "$NEON_GREEN"
  box_line   "$NEON_GREEN" "${BOLD}${WHITE}✔  DEPLOY COMPLETADO EXITOSAMENTE${NC}"
  box_empty  "$NEON_GREEN"
  box_divider "$NEON_GREEN"
  box_line   "$NEON_GREEN" "${GHOST}vaniabot    ${NC}${NEON_GREEN}${BOLD}● RUNNING${NC}    ${GHOST}·${NC}  ${GHOST}vania-redis ${NC}${NEON_GREEN}${BOLD}● RUNNING${NC}"
  box_line   "$NEON_GREEN" "${GHOST}puerto      ${NC}${NEON_YELLOW}${BOLD}:3000${NC}        ${GHOST}·${NC}  ${GHOST}version     ${NC}${ELECTRIC}${BOLD}v${VERSION}${NC}"
  box_line   "$NEON_GREEN" "${GHOST}red         ${NC}${DIM}vania-network${NC}   ${GHOST}·${NC}  ${GHOST}elapsed     ${NC}${DIM}$(elapsed)${NC}"
  box_line   "$NEON_GREEN" "${GHOST}persist     ${NC}${LIME}${BOLD}● ENABLED${NC}     ${GHOST}·${NC}  ${GHOST}volumes     ${NC}${NEON_GREEN}${BOLD}● ACTIVE${NC}"
  box_line   "$NEON_GREEN" "${GHOST}subbots     ${NC}${LIME}${BOLD}● VOLUMEN DEDICADO${NC}  ${GHOST}·${NC}  ${GHOST}redis-aof   ${NC}${NEON_GREEN}${BOLD}● ON${NC}"
  box_empty  "$NEON_GREEN"
  box_bottom "$NEON_GREEN"

fi

blank
thin_top "COMANDOS ÚTILES" "$ELECTRIC"
thin_line "${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker logs -f vaniabot               ${NC}  ${GHOST}→  logs en vivo${NC}"
thin_line "${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker stop vaniabot                 ${NC}  ${GHOST}→  detener bot${NC}"
thin_line "${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker ps                            ${NC}  ${GHOST}→  estado general${NC}"
thin_line "${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker logs -f vania-redis           ${NC}  ${GHOST}→  logs de redis${NC}"
thin_line "${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker exec vania-redis redis-cli DBSIZE  ${NC}  ${GHOST}→  keys en redis${NC}"
thin_line "${GHOST}─────────────────────────────────────────────────────${NC}"
thin_line "${GHOST}  RESPALDO MANUAL DE DATOS:${NC}"
thin_line "  ${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker run --rm -v vaniabot_storage:/src -v \$(pwd):/bk alpine tar czf /bk/db-backup.tar.gz -C /src .${NC}"
thin_line "  ${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker run --rm -v vaniabot_session:/src -v \$(pwd):/bk alpine tar czf /bk/session-backup.tar.gz -C /src .${NC}"
thin_line "  ${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker run --rm -v vaniabot_subbot_sessions:/src -v \$(pwd):/bk alpine tar czf /bk/subbots-backup.tar.gz -C /src .${NC}"
thin_line "  ${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}docker run --rm -v vania-redis-data:/src -v \$(pwd):/bk alpine tar czf /bk/redis-backup.tar.gz -C /src .${NC}"
thin_line "${GHOST}─────────────────────────────────────────────────────${NC}"
thin_line "${GHOST}  ACTUALIZAR sin perder sesiones ni datos:${NC}"
thin_line "  ${NEON_YELLOW}${BOLD}\$${NC}  ${DIM}curl -fsSL <url> | bash -s ${NEON_ORANGE}<version>${NC} ${LIME}update${NC}"
thin_bottom
blank

echo -e "  ${GHOST}════════════════════════════════════════════════════════════${NC}"
echo -e "  ${BOLD}${NEON_GREEN}📊 ESTADO DE PERSISTENCIA:${NC}"
SESSION_FINAL=$(docker run --rm -v vaniabot_session:/session  alpine ls -la /session/  2>/dev/null | wc -l)
DB_FINAL=$(     docker run --rm -v vaniabot_database:/data    alpine ls -la /data/     2>/dev/null | wc -l)
STORAGE_FINAL=$(docker run --rm -v vaniabot_storage:/storage  alpine find /storage -name "*.db" 2>/dev/null | wc -l)
SUBBOT_FINAL=$( docker run --rm -v vaniabot_subbot_sessions:/subbots alpine ls -la /subbots/ 2>/dev/null | wc -l)
REDIS_FINAL=$(  docker exec vania-redis redis-cli DBSIZE 2>/dev/null || echo "0")
echo -e "  ${GHOST}•${NC} Sesiones bot:   ${NEON_GREEN}$((SESSION_FINAL-2)) archivos${NC}"
echo -e "  ${GHOST}•${NC} Datos:          ${NEON_GREEN}$((DB_FINAL-1)) archivos${NC}"
echo -e "  ${GHOST}•${NC} SQLite DB:      ${NEON_GREEN}${STORAGE_FINAL} archivo(s) en vaniabot_storage${NC}"
echo -e "  ${GHOST}•${NC} Subbot sessions:${NEON_GREEN}$((SUBBOT_FINAL-2)) sesiones en vaniabot_subbot_sessions${NC}"
echo -e "  ${GHOST}•${NC} Redis keys:     ${NEON_GREEN}${REDIS_FINAL} keys (AOF+RDB persistente)${NC}"
echo -e "  ${GHOST}════════════════════════════════════════════════════════════${NC}"
blank