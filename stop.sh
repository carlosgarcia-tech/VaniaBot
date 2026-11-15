#!/bin/bash
# stop.sh — detiene OrbitBot de forma segura (compatible con deploy.sh)
#
# Uso:
#   ./stop.sh            → detiene orbit y orbit-redis (volúmenes intactos)
#   ./stop.sh bot        → detiene solo orbit (redis sigue activo)
#   ./stop.sh purge      → detiene Y elimina los contenedores (volúmenes intactos)
#
# NUNCA borra volúmenes ni la red. Para volver a levantar: ./deploy.sh ...

NEON_GREEN='\033[38;5;82m'
ELECTRIC='\033[38;5;51m'
NEON_ORANGE='\033[38;5;214m'
NEON_YELLOW='\033[38;5;226m'
WHITE='\033[38;5;231m'
GHOST='\033[38;5;240m'
RED='\033[38;5;196m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

MODE="${1:-all}"
case "$MODE" in
  all|bot|purge) ;;
  *)
    echo -e "  ${RED}${BOLD}uso:${NC} ./stop.sh [${NEON_GREEN}all${NC}|${ELECTRIC}bot${NC}|${NEON_ORANGE}purge${NC}]" >&2
    echo -e "       all    → detiene orbit y orbit-redis (default)" >&2
    echo -e "       bot    → detiene solo orbit" >&2
    echo -e "       purge  → detiene y elimina contenedores (volúmenes intactos)" >&2
    exit 1
    ;;
esac

ok()   { echo -e "  ${NEON_GREEN}${BOLD}▶${NC}  ${WHITE}$1${NC}"; }
info() { echo -e "  ${GHOST}╌  $1${NC}"; }
warn() { echo -e "  ${NEON_YELLOW}${BOLD}◈  WARN${NC}  $1"; }
fail() { echo -e "  ${RED}${BOLD}✖  FATAL${NC}  ${WHITE}$1${NC}" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en el PATH"
docker info >/dev/null 2>&1       || fail "no se puede hablar con el daemon de Docker (¿permisos o servicio caído?)"

container_exists()  { docker inspect "$1" >/dev/null 2>&1; }
container_running() { [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

echo ""
echo -e "  ${ELECTRIC}${BOLD}>>> Deteniendo OrbitBot${NC}  ${GHOST}(modo: ${MODE})${NC}"
echo ""

# ── 1. Bot ────────────────────────────────────────────────
if container_running orbit; then
  info "deteniendo ${BOLD}orbit${NC}${GHOST} (SIGTERM, hasta 15s para cierre limpio)...${NC}"
  if docker stop orbit >/dev/null 2>&1; then
    ok "orbit ${GHOST}detenido${NC}"
  else
    warn "no se pudo detener orbit limpiamente"
  fi
elif container_exists orbit; then
  info "orbit ya estaba detenido"
else
  info "orbit no existe (¿nunca se desplegó?)"
fi

# ── 2. Redis (solo en all / purge) ────────────────────────
if [ "$MODE" != "bot" ]; then
  if container_running orbit-redis; then
    info "forzando flush de Redis a disco antes de apagar..."
    docker exec orbit-redis redis-cli BGSAVE >/dev/null 2>&1 || true

    # Esperar a que termine el BGSAVE (máx. 15s)
    for _ in $(seq 1 15); do
      busy=$(docker exec orbit-redis redis-cli INFO persistence 2>/dev/null \
        | tr -d '\r' | awk -F: '/^rdb_bgsave_in_progress/{print $2}')
      [ "$busy" != "1" ] && break
      sleep 1
    done

    KEYS=$(docker exec orbit-redis redis-cli DBSIZE 2>/dev/null || echo "?")
    ok "Redis ${GHOST}persistido${NC} ${DIM}(${KEYS})${NC}"

    if docker stop orbit-redis >/dev/null 2>&1; then
      ok "orbit-redis ${GHOST}detenido${NC}"
    else
      warn "no se pudo detener orbit-redis limpiamente"
    fi
  elif container_exists orbit-redis; then
    info "orbit-redis ya estaba detenido"
  else
    info "orbit-redis no existe"
  fi
fi

# ── 3. Purge (opcional): eliminar contenedores, NO volúmenes ──
if [ "$MODE" = "purge" ]; then
  docker rm orbit orbit-redis >/dev/null 2>&1 \
    && ok "contenedores ${GHOST}eliminados${NC} ${DIM}(volúmenes y red intactos)${NC}" \
    || info "no había contenedores que eliminar"
fi

echo ""
ok "${NEON_GREEN}${BOLD}✓ Servicios detenidos${NC}"
if [ "$MODE" = "purge" ]; then
  info "Para volver a levantar: ${BOLD}./deploy.sh develop${NC}${GHOST} (instalación completa)"
else
  info "Datos preservados. Para volver a levantar: ${BOLD}./deploy.sh develop update${NC}${GHOST} o ${BOLD}docker start orbit-redis orbit${NC}"
fi
echo ""