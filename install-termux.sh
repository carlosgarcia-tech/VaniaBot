#!/bin/bash

#
#          OrbitBot - Termux Installation Script
#                Optimized for Android/Termux
#
# Author: Carlos G (@carlosgarcia-tech)
# Version: read dynamically from package.json
# Compatibility: Termux (Android 7.0+), Node.js 20+
#
# One-command install (freshly installed Termux):
#   pkg install -y git && git clone https://github.com/carlosgarcia-tech/OrbitBot.git && cd OrbitBot && bash install-termux.sh
#
# The script installs system dependencies, npm dependencies, applies the
# whatsapp-rust-bridge patch, creates the .env and verifies the install.
#
# Usage:
#   bash install-termux.sh           # Full install (recommended)
#   bash install-termux.sh --minimal # Minimal install (limited resources)
#   bash install-termux.sh --skip-npm # Skip installing npm dependencies
#   bash install-termux.sh --help    # Show help
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Variables
INSTALL_MODE="full"
TERMUX_SHARE="/data/data/com.termux/files/usr"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$CURRENT_DIR/install-termux.log"
NODE_MAJOR_MIN=20

# Bot version, read from package.json (without depending on node/jq,
# which may not be installed yet when the installer starts)
BOT_VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$CURRENT_DIR/package.json" 2>/dev/null | head -n1)"
BOT_VERSION="${BOT_VERSION:-unknown}"

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

show_help() {
    cat << EOF
${BOLD}OrbitBot - Termux Installation Script${NC}

${BOLD}Usage:${NC}
    bash install-termux.sh [OPTIONS]

${BOLD}Options:${NC}
    --full      Full install (default)
    --minimal   Minimal install (for devices with limited resources)
    --skip-npm  Do not install npm dependencies (use existing ones)
    --help      Show this help

${BOLD}Description:${NC}
    Installs OrbitBot (v$BOT_VERSION) on Termux with all dependencies
    needed to run properly on Android.

    Full mode also installs:
    - Build tools (for native modules)
    - PyMuPDF, pdf2docx and python-pptx (document conversion)
    - yt-dlp (video downloads)

${BOLD}Limitations on Termux:${NC}
    - LibreOffice does not exist on Termux: docx->pdf and
      ppt->pdf commands are not available on Android (they are on Docker/Linux).
    - PyMuPDF builds from source and can take several minutes;
      if it fails, the rest of the bot still works (just without PDF conversion).

${BOLD}Requirements:${NC}
    - Termux installed (from F-Droid or GitHub)
    - Android 7.0 or higher
    - At least 1GB of free storage
    - Internet connection to download dependencies

${BOLD}Examples:${NC}
    bash install-termux.sh              # Full install
    bash install-termux.sh --minimal     # For limited devices
    bash install-termux.sh --skip-npm   # If you already have node_modules

EOF
}

check_environment() {
    header "Checking Environment"

    # Check if we are in Termux
    if [ ! -d "/data/data/com.termux" ]; then
        warn "Doesn't look like Termux. The script will continue anyway."
    fi

    # Check Android
    if [ -f "/system/build.prop" ]; then
        log "Detected system: Android"
    fi

    # Check permissions
    if [ -w "$CURRENT_DIR" ]; then
        success "Write permissions OK"
    else
        error "Cannot write to the current directory"
        exit 1
    fi

    # Check disk space
    available=$(df -k "$CURRENT_DIR" | tail -1 | awk '{print $4}')
    if [ "$available" -lt 1000000 ]; then
        warn "Low disk space available: $((available / 1024))MB"
        warn "At least 1GB is recommended for a full install"
    else
        success "Available space: $((available / 1024))MB"
    fi
}

install_system_deps() {
    header "Installing System Dependencies"

    log "Updating repositories..."
    pkg update -y >> "$LOG_FILE" 2>&1 || true

    log "Installing base dependencies..."
    pkg install -y \
        git \
        nodejs \
        python \
        python-pip \
        binutils \
        ffmpeg \
        libwebp \
        imagemagick \
        bc \
        jq \
        curl \
        wget \
        tar \
        zip \
        unzip \
        2>&1 | tee -a "$LOG_FILE"

    success "Base dependencies installed"

    # Ensure the python3 binary (PythonBridge invokes it as 'python3')
    if ! command -v python3 &> /dev/null && command -v python &> /dev/null; then
        if [ -n "$PREFIX" ]; then
            ln -sf "$(command -v python)" "$PREFIX/bin/python3"
            success "python3 symlink created"
        else
            warn "python3 not available and PREFIX not set"
        fi
    fi

    # yt-dlp (pure Python, works on Termux)
    log "Installing yt-dlp..."
    pip install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || {
        warn "Error installing yt-dlp, trying with python -m pip..."
        python -m pip install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || true
    }
    if command -v yt-dlp &> /dev/null; then
        success "yt-dlp installed"
    else
        warn "yt-dlp not available in PATH - video download disabled"
    fi

    # For full install, install extra dependencies
    if [ "$INSTALL_MODE" = "full" ]; then
        log "Installing build tools for native modules..."
        pkg install -y \
            clang \
            make \
            pkg-config \
            libjpeg-turbo \
            libpng \
            zlib \
            2>&1 | tee -a "$LOG_FILE" || true
        success "Build tools installed"

        # Python document-conversion dependencies (src/services/convert)
        log "Installing PyMuPDF (may compile from source and take a while)..."
        if pip install pymupdf >> "$LOG_FILE" 2>&1; then
            success "PyMuPDF installed (PDF conversion enabled)"
        else
            warn "PyMuPDF could not be installed - PDF conversion disabled"
            warn "The rest of the bot works fine without this feature"
        fi

        log "Installing pdf2docx and python-pptx..."
        if pip install pdf2docx >> "$LOG_FILE" 2>&1; then
            success "pdf2docx installed (pdf -> docx)"
        else
            warn "pdf2docx could not be installed - pdf->docx disabled"
        fi
        if pip install python-pptx >> "$LOG_FILE" 2>&1; then
            success "python-pptx installed (pdf -> pptx)"
        else
            warn "python-pptx could not be installed - pdf->pptx disabled"
        fi

        # LibreOffice does not exist on Termux
        warn "LibreOffice is not available on Termux: docx->pdf and ppt->pdf will not work on Android"
        warn "Those conversions require Docker/Linux or an external server"

        # ImageMagick policy fix to avoid security errors
        if ls "$TERMUX_SHARE"/etc/ImageMagick-*/policy.xml >/dev/null 2>&1; then
            POLICY_FILE=$(find "$TERMUX_SHARE" -name "policy.xml" -path "*ImageMagick*" 2>/dev/null | head -1)
            if [ -n "$POLICY_FILE" ] && [ -f "$POLICY_FILE" ]; then
                sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' "$POLICY_FILE" 2>/dev/null || true
            fi
        fi
    else
        warn "Minimal mode: skipping optional dependencies (document conversion and native builds)"
    fi

    # Verify installations
    log "Verifying installations..."

    if command -v node &> /dev/null; then
        success "Node.js: $(node --version)"
    else
        error "Node.js was not installed correctly"
    fi

    if command -v npm &> /dev/null; then
        success "NPM: $(npm --version)"
    else
        error "NPM was not installed correctly"
    fi

    if command -v ffmpeg &> /dev/null; then
        success "FFmpeg: $(ffmpeg -version 2>&1 | head -n 1)"
    else
        warn "FFmpeg was not installed - some video features will not work"
    fi

    if command -v python3 &> /dev/null; then
        success "Python: $(python3 --version)"
    else
        warn "Python3 not available - document conversion and yt-dlp will not work"
    fi
}

install_nodejs_deps() {
    header "Installing Node.js Dependencies"

    cd "$CURRENT_DIR"

    # Check Node.js version (the project requires >= 20)
    if command -v node &> /dev/null; then
        NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
        if [ "$NODE_MAJOR" -lt "$NODE_MAJOR_MIN" ]; then
            error "Node.js $(node --version) is too old: >= ${NODE_MAJOR_MIN}.x required"
            error "Update with: pkg upgrade nodejs"
            exit 1
        fi
        success "Node.js $(node --version) meets the requirement (>= ${NODE_MAJOR_MIN}.x)"
    fi

    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        error "package.json not found. Make sure you are in the OrbitBot directory"
        exit 1
    fi

    # Clean node_modules if it exists for a clean reinstall
    if [ -d "node_modules" ]; then
        warn "Cleaning previous node_modules..."
        rm -rf node_modules package-lock.json
    fi

    # Install dependencies
    log "Installing npm dependencies (this may take several minutes)..."
    echo "Command: npm install --prefer-offline"

    if [ "$INSTALL_MODE" = "minimal" ]; then
        # Minimal install without heavy optional dependencies
        log "Minimal mode: skipping heavy dependencies..."
        npm install --ignore-scripts --no-optional 2>&1 | tee -a "$LOG_FILE" || INSTALL_FAILED=true
    else
        npm install --prefer-offline 2>&1 | tee -a "$LOG_FILE" || INSTALL_FAILED=true
    fi

    if [ "${INSTALL_FAILED:-false}" = "true" ]; then
        error "Error installing npm dependencies"
        warn "Trying minimal install..."
        npm install --ignore-scripts 2>&1 | tee -a "$LOG_FILE" || true
    fi

    # Apply the whatsapp-rust-bridge patch (postinstall in package.json).
    # With --ignore-scripts the patch is NOT run and the bot won't start, so
    # it is applied manually in both cases.
    log "Applying whatsapp-rust-bridge patch..."
    npm run postinstall >> "$LOG_FILE" 2>&1 || warn "whatsapp-rust-bridge patch skipped"

    # Rebuild native modules (canvas, etc.) if a toolchain is present
    log "Checking native modules..."
    npm rebuild >> "$LOG_FILE" 2>&1 || warn "npm rebuild failed - some native modules may not be available"
}

setup_config() {
    header "Setting Up OrbitBot"

    cd "$CURRENT_DIR"

    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log "Creating basic .env file..."
        cat > .env << 'EOF'
# OrbitBot - Basic configuration
BOT_NAME=OrbitBot
BOT_PREFIX=.

# Your WhatsApp number with country code (bot owner)
OWNERS=

# Bot number (required for pairing code)
PHONE_NUMBER=

# Pairing code authentication (more stable than QR on Termux)
USE_PAIRING_CODE=true

# Artificial intelligence (https://console.groq.com/keys)
GROQ_API_KEY=

NODE_ENV=development
EOF
        success "Basic .env created"

        warn "⚠️ IMPORTANT: Edit the .env file and configure:"
        echo "   - OWNERS: Your WhatsApp number with country code (e.g. 5215512345678)"
        echo "   - PHONE_NUMBER: Bot number (for pairing code)"
        echo "   - GROQ_API_KEY: Get it at https://console.groq.com/keys"
        echo ""
        echo "   nano .env"
        echo ""
    else
        success ".env already exists"
    fi

    # Create required directories
    log "Creating directories..."
    mkdir -p data/temp
    mkdir -p data/assets
    mkdir -p data/backups
    mkdir -p orbitsession
    mkdir -p logs
    success "Directories created"

    # Configure timezone
    if [ -f "/data/data/com.termux/files/usr/etc/motd" ]; then
        log "Configuring timezone..."
        export TZ="America/Mexico_City"
    fi
}

verify_installation() {
    header "Verifying Installation"

    local errors=0

    log "Checking required files..."

    for file in package.json tsconfig.json orbit.ts src/index.ts; do
        if [ -f "$file" ]; then
            success "$file exists"
        else
            error "$file not found"
            errors=$((errors + 1))
        fi
    done

    log "Checking TypeScript..."
    if npx tsc --version >> "$LOG_FILE" 2>&1; then
        success "TypeScript: $(npx tsc --version)"
    else
        warn "TypeScript not directly available"
    fi

    log "Checking project structure..."
    if [ -d "src/commands" ] && [ -d "src/services" ]; then
        success "Project structure OK"
    else
        error "Project structure incomplete"
        errors=$((errors + 1))
    fi

    log "Checking whatsapp-rust-bridge patch..."
    if node -e "require('whatsapp-rust-bridge/package.json')" >> "$LOG_FILE" 2>&1; then
        success "whatsapp-rust-bridge accessible"
    else
        warn "whatsapp-rust-bridge not verifiable (the bot may fail to start)"
    fi

    if [ "$INSTALL_MODE" = "full" ] && command -v python3 &> /dev/null; then
        log "Checking PyMuPDF (document conversion)..."
        if python3 -c "import fitz" >> "$LOG_FILE" 2>&1; then
            success "PyMuPDF available - PDF conversion enabled"
        else
            warn "PyMuPDF not available - PDF conversion disabled"
        fi
    fi

    return $errors
}

show_instructions() {
    header "Installation Completed"

    cat << EOF
${GREEN}╔════════════════════════════════════════════════════════════════════════╗
║                   OrbitBot installed successfully!                       ║
╚════════════════════════════════════════════════════════════════════════╝${NC}

${BOLD}📋 Next steps:${NC}

1. ${YELLOW}Configure the .env file${NC}
   nano .env

   Required variables:
   • OWNERS - Your number with country code (e.g.: 5215512345678)
   • PHONE_NUMBER - Bot number (for pairing code)
   • GROQ_API_KEY - Get it at https://console.groq.com/keys

2. ${YELLOW}Start the bot${NC}

   # Pairing code (recommended on Termux):
   npm run code

   # QR mode (first-time alternative):
   npm run qr

   # Interactive authentication menu:
   npm start

   # Development mode:
   npm run dev

3. ${YELLOW}Link the bot to WhatsApp${NC}
   With USE_PAIRING_CODE=true, enter the 8-character code in
   WhatsApp > Linked devices > Link with the bot's number.

${BOLD}📌 Useful commands:${NC}
   • View logs: pm2 logs orbit
   • Restart: pm2 restart orbit
   • Status: pm2 status
   • Health panel: http://localhost:3000/api/health (with the bot running)

${BOLD}🔧 Keeping the bot running 24/7:${NC}

   # Enable wake lock (prevents Termux from sleeping):
   termux-wake-lock

   # Use PM2:
   npm install -g pm2
   pm2 start orbit.ts --interpreter tsx --name orbit
   pm2 save
   pm2 startup

${BOLD}⚠️ Important notes:${NC}
   • The bot needs to be a group admin to work correctly
   • Make sure FFmpeg is installed for video features
   • Save your session periodically with a backup of orbitsession/
   • docx->pdf and ppt->pdf do not work on Termux (LibreOffice does not
     exist on Android); pdf->img, pdf->docx and pdf->pptx do (if PyMuPDF installed)
   • The configured prefix works, and '.' and '!' always work too

${BOLD}🐛 Troubleshooting:${NC}
   • Permission errors: termux-setup-storage
   • View logs: cat install-termux.log
   • Reinstall deps: rm -rf node_modules && npm install && npm run postinstall
   • Old Node: pkg upgrade nodejs  (Node 20+ required)

EOF
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                INSTALL_MODE="full"
                shift
                ;;
            --minimal)
                INSTALL_MODE="minimal"
                warn "Minimal mode enabled - some features may not be available"
                shift
                ;;
            --skip-npm)
                SKIP_NPM=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Start log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Starting OrbitBot v$BOT_VERSION installation ===" > "$LOG_FILE"

    header "OrbitBot v$BOT_VERSION - Termux Installation"

    echo -e "${BOLD}Install mode:${NC} ${CYAN}$INSTALL_MODE${NC}"
    echo ""

    # Run steps
    check_environment
    install_system_deps

    if [ "${SKIP_NPM:-false}" != "true" ]; then
        install_nodejs_deps
    else
        warn "Skipping npm install..."
    fi

    setup_config

    if verify_installation; then
        show_instructions
        success "Installation completed"
    else
        error "The installation had some problems"
        warn "Check $LOG_FILE for more details"
        exit 1
    fi
}

# Run
main "$@"
