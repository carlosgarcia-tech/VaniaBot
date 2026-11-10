#!/bin/bash
#
# OrbitBot - Quick install (Linux/macOS)
#
# Installs system dependencies, clones the repository, installs the
# npm dependencies and starts the bot with a pairing code.
#
# Usage:
#   bash OrbitBot.sh [version]
#
# The version is resolved in this order:
#   1. First script argument (e.g. v7.1.1 or 7.1.1)
#   2. Local package.json (if the script runs inside a checkout)
#   3. Latest release published on GitHub
#

set -e

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

# Same trick as install-termux.sh: sed over package.json to avoid depending on
# node/jq, which may not be installed yet.
version_from_package_json() {
    sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json 2>/dev/null | head -n1
}

latest_github_release() {
    # No -L: capture the redirect URL of /releases/latest
    # (following it with -L would leave redirect_url empty at the end)
    curl -fsS -o /dev/null -w '%{redirect_url}' \
        "https://github.com/carlosgarcia-tech/OrbitBot/releases/latest" 2>/dev/null |
        sed -n 's|.*/tag/\(.*\)$|\1|p'
}

resolve_version() {
    local requested="$1"

    # 1) Explicit argument (accepts with or without the 'v')
    if [ -n "$requested" ]; then
        echo "${requested#v}"
        return 0
    fi

    # 2) Local package.json (installing over an existing checkout)
    local pkg_version
    pkg_version=$(version_from_package_json)
    if [ -n "$pkg_version" ]; then
        echo "$pkg_version"
        return 0
    fi

    # 3) Latest release published on GitHub
    local gh_version
    gh_version=$(latest_github_release)
    if [ -n "$gh_version" ]; then
        echo "${gh_version#v}"
        return 0
    fi

    return 1
}

version_exists() {
    local version="$1"
    curl -fsSL -o /dev/null "https://github.com/carlosgarcia-tech/OrbitBot/releases/tag/v${version}" 2>/dev/null
}

install_system_deps() {
    log "Detecting package manager..."

    if command -v apt-get &> /dev/null; then
        log "Using apt-get..."
        sudo apt-get update -y
        sudo apt-get install -y curl git ffmpeg python3 python3-pip nodejs npm
    elif command -v dnf &> /dev/null; then
        log "Using dnf..."
        sudo dnf install -y curl git ffmpeg python3 python3-pip nodejs npm
    elif command -v pacman &> /dev/null; then
        log "Using pacman..."
        sudo pacman -Sy --noconfirm curl git ffmpeg python python-pip nodejs npm
    else
        error "No apt-get, dnf or pacman detected."
        error "Install manually: curl, git, ffmpeg, python3, nodejs 20+ and npm, then run again."
        exit 1
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not available after system package installation."
        error "Install Node.js 20+ from https://nodejs.org and run again."
        exit 1
    fi

    local node_major
    node_major=$(node -p 'process.versions.node.split(".")[0]')

    if [ "$node_major" -lt 20 ]; then
        error "Node.js $(node --version) is too old: >= 20.x required"
        error "Upgrade Node.js from https://nodejs.org or with your package manager."
        exit 1
    fi

    ok "Node.js $(node --version)"
}

clone_repo() {
    if [ -d "OrbitBot" ]; then
        warn "OrbitBot directory already exists - reusing existing checkout"
        cd OrbitBot
    else
        git clone https://github.com/carlosgarcia-tech/OrbitBot.git
        cd OrbitBot
    fi
}

install_nodejs_deps() {
    log "Installing npm dependencies (this may take several minutes)..."
    npm install --prefer-offline

    # whatsapp-rust-bridge patch: if npm ran scripts, the postinstall already
    # executed, but run it again just in case (idempotent).
    npm run postinstall || warn "whatsapp-rust-bridge patch skipped"
}

setup_env() {
    if [ -f ".env" ]; then
        ok ".env already exists"
        return 0
    fi

    log "Creating basic .env..."
    cat > .env << 'EOF'
BOT_NAME=OrbitBot
BOT_PREFIX=.
OWNERS=
PHONE_NUMBER=
USE_PAIRING_CODE=true
GROQ_API_KEY=
NODE_ENV=development
EOF
    ok ".env created"
    warn "Edit it before starting: nano .env (OWNERS, PHONE_NUMBER, GROQ_API_KEY)"
}

main() {
    local requested_version="${1:-}"
    local version

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  OrbitBot - Quick install${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    install_system_deps
    check_node

    if ! version=$(resolve_version "$requested_version"); then
        error "Could not resolve the version (no argument, no package.json and no access to GitHub Releases)."
        exit 1
    fi

    if ! version_exists "$version"; then
        warn "Version v$version has no release published on GitHub - using code from main"
    fi

    log "Installing OrbitBot v$version..."
    clone_repo
    install_nodejs_deps
    setup_env

    echo ""
    ok "Installation completed (v$version)"
    echo ""
    log "To start the bot with a pairing code:"
    echo "    cd OrbitBot"
    echo "    USE_PAIRING_CODE=true npm run code"
    echo ""
    log "Set OWNERS and GROQ_API_KEY in .env before the first start."
}

main "$@"
