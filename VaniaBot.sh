#!/bin/bash
#
# VaniaBot - Instalación rápida (Linux/macOS)
#
# Instala dependencias del sistema, clona el repositorio, instala las
# dependencias npm y arranca el bot con código de pareo.
#
# Uso:
#   bash VaniaBot.sh [version]
#
# La versión se resuelve en este orden:
#   1. Primer argumento del script (ej: v7.1.1 o 7.1.1)
#   2. package.json local (si el script corre dentro de un checkout)
#   3. Último release publicado en GitHub
#

set -e

# ─── Utilidades de salida ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()    { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()     { echo -e "${GREEN}[✓]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✗]${NC} $1"; }

# ─── Resolución de versión ───────────────────────────────────────────────────
# Igual que install-termux.sh: sed sobre package.json para no depender de
# node/jq, que pueden no estar instalados todavía.
version_from_package_json() {
    sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json 2>/dev/null | head -n1
}

latest_github_release() {
    # Sin -L: se captura la URL de redirección de /releases/latest
    # (si se siguiera con -L, redirect_url quedaría vacío al final)
    curl -fsS -o /dev/null -w '%{redirect_url}' \
        "https://github.com/carlosgarcia-tech/VaniaBot/releases/latest" 2>/dev/null |
        sed -n 's|.*/tag/\(.*\)$|\1|p'
}

resolve_version() {
    local requested="$1"

    # 1) Argumento explícito (acepta con o sin 'v')
    if [ -n "$requested" ]; then
        echo "${requested#v}"
        return 0
    fi

    # 2) package.json local (instalación sobre un checkout existente)
    local pkg_version
    pkg_version=$(version_from_package_json)
    if [ -n "$pkg_version" ]; then
        echo "$pkg_version"
        return 0
    fi

    # 3) Último release publicado en GitHub
    local gh_version
    gh_version=$(latest_github_release)
    if [ -n "$gh_version" ]; then
        echo "${gh_version#v}"
        return 0
    fi

    return 1
}

# ─── Validación de versión ───────────────────────────────────────────────────
version_exists() {
    local version="$1"
    curl -fsSL -o /dev/null "https://github.com/carlosgarcia-tech/VaniaBot/releases/tag/v${version}" 2>/dev/null
}

# ─── Dependencias del sistema ────────────────────────────────────────────────
install_system_deps() {
    log "Detectando gestor de paquetes..."

    if command -v apt-get &> /dev/null; then
        log "Usando apt-get..."
        sudo apt-get update -y
        sudo apt-get install -y curl git ffmpeg python3 python3-pip nodejs npm
    elif command -v dnf &> /dev/null; then
        log "Usando dnf..."
        sudo dnf install -y curl git ffmpeg python3 python3-pip nodejs npm
    elif command -v pacman &> /dev/null; then
        log "Usando pacman..."
        sudo pacman -Sy --noconfirm curl git ffmpeg python python-pip nodejs npm
    else
        error "No se detectó apt-get, dnf ni pacman."
        error "Instala manualmente: curl, git, ffmpeg, python3, nodejs 20+ y npm, luego vuelve a ejecutar."
        exit 1
    fi
}

# ─── Verificación de Node.js 20+ ─────────────────────────────────────────────
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js no está disponible tras la instalación del sistema."
        error "Instala Node.js 20+ desde https://nodejs.org y vuelve a ejecutar."
        exit 1
    fi

    local node_major
    node_major=$(node -p 'process.versions.node.split(".")[0]')

    if [ "$node_major" -lt 20 ]; then
        error "Node.js $(node --version) es demasiado viejo: se requiere >= 20.x"
        error "Actualiza Node.js desde https://nodejs.org o con tu gestor de paquetes."
        exit 1
    fi

    ok "Node.js $(node --version)"
}

# ─── Clonado e instalación ───────────────────────────────────────────────────
clone_repo() {
    if [ -d "VaniaBot" ]; then
        warn "El directorio VaniaBot ya existe - reutilizando checkout existente"
        cd VaniaBot
    else
        git clone https://github.com/carlosgarcia-tech/VaniaBot.git
        cd VaniaBot
    fi
}

install_nodejs_deps() {
    log "Instalando dependencias npm (esto puede tardar varios minutos)..."
    npm install --prefer-offline

    # Parche de whatsapp-rust-bridge: si npm ejecutó scripts ya corrió el
    # postinstall, pero se re-ejecuta por si acaso (idempotente).
    npm run postinstall || warn "Parche de whatsapp-rust-bridge omitido"
}

setup_env() {
    if [ -f ".env" ]; then
        ok ".env ya existe"
        return 0
    fi

    log "Creando .env básico..."
    cat > .env << 'EOF'
BOT_NAME=VaniaBot
BOT_PREFIX=.
OWNERS=
PHONE_NUMBER=
USE_PAIRING_CODE=true
GROQ_API_KEY=
NODE_ENV=development
EOF
    ok ".env creado"
    warn "Edítalo antes de arrancar: nano .env (OWNERS, PHONE_NUMBER, GROQ_API_KEY)"
}

# ─── Principal ───────────────────────────────────────────────────────────────
main() {
    local requested_version="${1:-}"
    local version

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  VaniaBot - Instalación rápida${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    install_system_deps
    check_node

    if ! version=$(resolve_version "$requested_version"); then
        error "No se pudo resolver la versión (sin argumento, sin package.json y sin acceso a GitHub Releases)."
        exit 1
    fi

    if ! version_exists "$version"; then
        warn "La versión v$version no tiene release publicado en GitHub - usando el código de main"
    fi

    log "Instalando VaniaBot v$version..."
    clone_repo
    install_nodejs_deps
    setup_env

    echo ""
    ok "Instalación completada (v$version)"
    echo ""
    log "Para arrancar el bot con código de pareo:"
    echo "    cd VaniaBot"
    echo "    USE_PAIRING_CODE=true npm run code"
    echo ""
    log "Configura OWNERS y GROQ_API_KEY en .env antes del primer arranque."
}

main "$@"
