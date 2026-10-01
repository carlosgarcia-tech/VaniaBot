#!/bin/bash

#
#          VaniaBot - Script de Instalación para Termux
#                Optimizado para Android/Termux
#
# Autor: Carlos G (@CARLOSGRCIAGRCIA)
# Versión: leída dinámicamente de package.json
# Compatibilidad: Termux (Android 7.0+), Node.js 20+
#
# Instalación en un solo comando (Termux recién instalado):
#   pkg install -y git && git clone https://github.com/carlosgarcia-tech/VaniaBot.git && cd VaniaBot && bash install-termux.sh
#
# El script instala dependencias del sistema, dependencias npm, aplica el
# parche de whatsapp-rust-bridge, crea el .env y verifica la instalación.
#
# Uso:
#   bash install-termux.sh           # Instalación completa (recomendada)
#   bash install-termux.sh --minimal # Instalación mínima (recursos limitados)
#   bash install-termux.sh --skip-npm # No instalar dependencias npm
#   bash install-termux.sh --help    # Mostrar ayuda
#

set -e

# Colores para output
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

# Versión del bot, leída de package.json (sin depender de node/jq,
# que pueden no estar instalados todavía al iniciar el instalador)
BOT_VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$CURRENT_DIR/package.json" 2>/dev/null | head -n1)"
BOT_VERSION="${BOT_VERSION:-desconocida}"

# ══════════════════════════════════════════════════════════════════════════════
# Funciones de utilidad
# ══════════════════════════════════════════════════════════════════════════════

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
${BOLD}VaniaBot - Script de Instalación para Termux${NC}

${BOLD}Uso:${NC}
    bash install-termux.sh [OPCIONES]

${BOLD}Opciones:${NC}
    --full      Instalación completa (por defecto)
    --minimal   Instalación mínima (para dispositivos con recursos limitados)
    --skip-npm  No instalar dependencias npm (usar las existentes)
    --help      Mostrar esta ayuda

${BOLD}Descripción:${NC}
    Instala VaniaBot (v$BOT_VERSION) en Termux con todas las dependencias
    necesarias para funcionar correctamente en Android.

    Modo completo instala además:
    - Herramientas de compilación (para módulos nativos)
    - PyMuPDF, pdf2docx y python-pptx (conversión de documentos)
    - yt-dlp (descarga de videos)

${BOLD}Limitaciones en Termux:${NC}
    - LibreOffice no existe en Termux: los comandos docx->pdf y
      ppt->pdf no están disponibles en Android (sí en Docker/Linux).
    - PyMuPDF se compila desde fuente y puede tardar varios minutos;
      si falla, el resto del bot funciona igual (solo sin conversión PDF).

${BOLD}Requisitos:${NC}
    - Termux instalado (desde F-Droid o GitHub)
    - Android 7.0 o superior
    - Al menos 1GB de almacenamiento libre
    - Conexión a internet para descargar dependencias

${BOLD}Ejemplos:${NC}
    bash install-termux.sh              # Instalación completa
    bash install-termux.sh --minimal     # Para dispositivos limitados
    bash install-termux.sh --skip-npm   # Si ya tienes node_modules

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# Verificación inicial
# ══════════════════════════════════════════════════════════════════════════════

check_environment() {
    header "Verificando Entorno"

    # Verificar si estamos en Termux
    if [ ! -d "/data/data/com.termux" ]; then
        warn "No parece estar en Termux. El script continuará de todas formas."
    fi

    # Verificar Android
    if [ -f "/system/build.prop" ]; then
        log "Sistema detectado: Android"
    fi

    # Verificar permisos
    if [ -w "$CURRENT_DIR" ]; then
        success "Permisos de escritura OK"
    else
        error "No se puede escribir en el directorio actual"
        exit 1
    fi

    # Verificar espacio
    available=$(df -k "$CURRENT_DIR" | tail -1 | awk '{print $4}')
    if [ "$available" -lt 1000000 ]; then
        warn "Poco espacio disponible: $((available / 1024))MB"
        warn "Se recomienda al menos 1GB para una instalación completa"
    else
        success "Espacio disponible: $((available / 1024))MB"
    fi
}

install_system_deps() {
    header "Instalando Dependencias del Sistema"

    log "Actualizando repositorios..."
    pkg update -y >> "$LOG_FILE" 2>&1 || true

    log "Instalando dependencias base..."
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

    success "Dependencias base instaladas"

    # Asegurar el binario python3 (PythonBridge lo invoca como 'python3')
    if ! command -v python3 &> /dev/null && command -v python &> /dev/null; then
        if [ -n "$PREFIX" ]; then
            ln -sf "$(command -v python)" "$PREFIX/bin/python3"
            success "Symlink python3 creado"
        else
            warn "python3 no disponible y PREFIX no definido"
        fi
    fi

    # yt-dlp (Python puro, funciona en Termux)
    log "Instalando yt-dlp..."
    pip install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || {
        warn "Error instalando yt-dlp, intentando con python -m pip..."
        python -m pip install --upgrade yt-dlp >> "$LOG_FILE" 2>&1 || true
    }
    if command -v yt-dlp &> /dev/null; then
        success "yt-dlp instalado"
    else
        warn "yt-dlp no quedó disponible en PATH - descarga de videos deshabilitada"
    fi

    # Para instalación completa, instalar dependencias adicionales
    if [ "$INSTALL_MODE" = "full" ]; then
        log "Instalando herramientas de compilación para módulos nativos..."
        pkg install -y \
            clang \
            make \
            pkg-config \
            libjpeg-turbo \
            libpng \
            zlib \
            2>&1 | tee -a "$LOG_FILE" || true
        success "Herramientas de compilación instaladas"

        # Dependencias Python de conversión de documentos (src/services/convert)
        log "Instalando PyMuPDF (puede compilar desde fuente y tardar)..."
        if pip install pymupdf >> "$LOG_FILE" 2>&1; then
            success "PyMuPDF instalado (conversión de PDF habilitada)"
        else
            warn "PyMuPDF no se pudo instalar - conversión de PDF deshabilitada"
            warn "El resto del bot funciona normalmente sin esta función"
        fi

        log "Instalando pdf2docx y python-pptx..."
        if pip install pdf2docx >> "$LOG_FILE" 2>&1; then
            success "pdf2docx instalado (pdf -> docx)"
        else
            warn "pdf2docx no se pudo instalar - pdf->docx deshabilitado"
        fi
        if pip install python-pptx >> "$LOG_FILE" 2>&1; then
            success "python-pptx instalado (pdf -> pptx)"
        else
            warn "python-pptx no se pudo instalar - pdf->pptx deshabilitado"
        fi

        # LibreOffice no existe en Termux
        warn "LibreOffice no está disponible en Termux: docx->pdf y ppt->pdf no funcionarán en Android"
        warn "Esas conversiones requieren Docker/Linux o un servidor externo"

        # ImageMagick policy fix para evitar errores de seguridad
        if ls "$TERMUX_SHARE"/etc/ImageMagick-*/policy.xml >/dev/null 2>&1; then
            POLICY_FILE=$(find "$TERMUX_SHARE" -name "policy.xml" -path "*ImageMagick*" 2>/dev/null | head -1)
            if [ -n "$POLICY_FILE" ] && [ -f "$POLICY_FILE" ]; then
                sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' "$POLICY_FILE" 2>/dev/null || true
            fi
        fi
    else
        warn "Modo mínimo: omitiendo dependencias opcionales (conversión de documentos y compilación nativa)"
    fi

    # Verificar instalaciones
    log "Verificando instalaciones..."

    if command -v node &> /dev/null; then
        success "Node.js: $(node --version)"
    else
        error "Node.js no se instaló correctamente"
    fi

    if command -v npm &> /dev/null; then
        success "NPM: $(npm --version)"
    else
        error "NPM no se instaló correctamente"
    fi

    if command -v ffmpeg &> /dev/null; then
        success "FFmpeg: $(ffmpeg -version 2>&1 | head -n 1)"
    else
        warn "FFmpeg no se instaló - algunas funciones de video no funcionarán"
    fi

    if command -v python3 &> /dev/null; then
        success "Python: $(python3 --version)"
    else
        warn "Python3 no disponible - conversión de documentos y yt-dlp no funcionarán"
    fi
}

install_nodejs_deps() {
    header "Instalando Dependencias de Node.js"

    cd "$CURRENT_DIR"

    # Verificar versión de Node.js (el proyecto exige >= 20)
    if command -v node &> /dev/null; then
        NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
        if [ "$NODE_MAJOR" -lt "$NODE_MAJOR_MIN" ]; then
            error "Node.js $(node --version) es demasiado viejo: se requiere >= ${NODE_MAJOR_MIN}.x"
            error "Actualiza con: pkg upgrade nodejs"
            exit 1
        fi
        success "Node.js $(node --version) cumple el requisito (>= ${NODE_MAJOR_MIN}.x)"
    fi

    # Verificar si package.json existe
    if [ ! -f "package.json" ]; then
        error "package.json no encontrado. Asegúrate de estar en el directorio de VaniaBot"
        exit 1
    fi

    # Limpiar node_modules si existe para reinstalación limpia
    if [ -d "node_modules" ]; then
        warn "Limpiando node_modules anterior..."
        rm -rf node_modules package-lock.json
    fi

    # Instalar dependencias
    log "Instalando dependencias npm (esto puede tardar varios minutos)..."
    echo "Comando: npm install --prefer-offline"

    if [ "$INSTALL_MODE" = "minimal" ]; then
        # Instalación mínima sin dependencias pesadas opcionales
        log "Modo mínimo: omitiendo dependencias pesadas..."
        npm install --ignore-scripts --no-optional 2>&1 | tee -a "$LOG_FILE" || INSTALL_FAILED=true
    else
        npm install --prefer-offline 2>&1 | tee -a "$LOG_FILE" || INSTALL_FAILED=true
    fi

    if [ "${INSTALL_FAILED:-false}" = "true" ]; then
        error "Error instalando dependencias npm"
        warn "Intentando instalación mínima..."
        npm install --ignore-scripts 2>&1 | tee -a "$LOG_FILE" || true
    fi

    # Aplicar el parche de whatsapp-rust-bridge (postinstall del package.json).
    # Con --ignore-scripts el parche NO se ejecuta y el bot no arranca, así que
    # se aplica manualmente en ambos casos.
    log "Aplicando parche de whatsapp-rust-bridge..."
    npm run postinstall >> "$LOG_FILE" 2>&1 || warn "Parche de whatsapp-rust-bridge omitido"

    # Rebuild de módulos nativos (canvas, etc.) si hay toolchain
    log "Verificando módulos nativos..."
    npm rebuild >> "$LOG_FILE" 2>&1 || warn "npm rebuild falló - algunos módulos nativos pueden no estar disponibles"
}

setup_config() {
    header "Configurando VaniaBot"

    cd "$CURRENT_DIR"

    # Crear archivo .env si no existe
    if [ ! -f ".env" ]; then
        log "Creando archivo .env básico..."
        cat > .env << 'EOF'
# VaniaBot - Configuración básica
BOT_NAME=VaniaBot
BOT_PREFIX=.

# Tu número de WhatsApp con código de país (dueño del bot)
OWNERS=

# Número del bot (necesario para código de pareo)
PHONE_NUMBER=

# Autenticación por código de pareo (más estable que QR en Termux)
USE_PAIRING_CODE=true

# Inteligencia artificial (https://console.groq.com/keys)
GROQ_API_KEY=

NODE_ENV=development
EOF
        success ".env básico creado"

        warn "⚠️ IMPORTANTE: Edita el archivo .env y configura:"
        echo "   - OWNERS: Tu número de WhatsApp con código de país (ej: 5215512345678)"
        echo "   - PHONE_NUMBER: Número del bot (para código de pareo)"
        echo "   - GROQ_API_KEY: Obtener en https://console.groq.com/keys"
        echo ""
        echo "   nano .env"
        echo ""
    else
        success ".env ya existe"
    fi

    # Crear directorios necesarios
    log "Creando directorios..."
    mkdir -p data/temp
    mkdir -p data/assets
    mkdir -p data/backups
    mkdir -p vaniasession
    mkdir -p logs
    success "Directorios creados"

    # Configurar timezone
    if [ -f "/data/data/com.termux/files/usr/etc/motd" ]; then
        log "Configurando timezone..."
        export TZ="America/Mexico_City"
    fi
}

verify_installation() {
    header "Verificando Instalación"

    local errors=0

    log "Verificando archivos necesarios..."

    for file in package.json tsconfig.json vania.ts src/index.ts; do
        if [ -f "$file" ]; then
            success "$file existe"
        else
            error "$file no encontrado"
            errors=$((errors + 1))
        fi
    done

    log "Verificando TypeScript..."
    if npx tsc --version >> "$LOG_FILE" 2>&1; then
        success "TypeScript: $(npx tsc --version)"
    else
        warn "TypeScript no está disponible directamente"
    fi

    log "Verificando estructura del proyecto..."
    if [ -d "src/commands" ] && [ -d "src/services" ]; then
        success "Estructura del proyecto OK"
    else
        error "Estructura del proyecto incompleta"
        errors=$((errors + 1))
    fi

    log "Verificando parche de whatsapp-rust-bridge..."
    if node -e "require('whatsapp-rust-bridge/package.json')" >> "$LOG_FILE" 2>&1; then
        success "whatsapp-rust-bridge accesible"
    else
        warn "whatsapp-rust-bridge no verificable (el bot puede fallar al arrancar)"
    fi

    if [ "$INSTALL_MODE" = "full" ] && command -v python3 &> /dev/null; then
        log "Verificando PyMuPDF (conversión de documentos)..."
        if python3 -c "import fitz" >> "$LOG_FILE" 2>&1; then
            success "PyMuPDF disponible - conversión de PDF habilitada"
        else
            warn "PyMuPDF no disponible - conversión de PDF deshabilitada"
        fi
    fi

    return $errors
}

show_instructions() {
    header "Instalación Completada"

    cat << EOF
${GREEN}╔════════════════════════════════════════════════════════════════════════╗
║                   ¡VaniaBot instalado exitosamente!                      ║
╚════════════════════════════════════════════════════════════════════════╝${NC}

${BOLD}📋 Próximos pasos:${NC}

1. ${YELLOW}Configura el archivo .env${NC}
   nano .env

   Variables requeridas:
   • OWNERS - Tu número con código de país (ej: 5215512345678)
   • PHONE_NUMBER - Número del bot (para código de pareo)
   • GROQ_API_KEY - Obtener en https://console.groq.com/keys

2. ${YELLOW}Iniciar el bot${NC}

   # Código de pareo (recomendado en Termux):
   npm run code

   # Modo QR (primera vez alternativa):
   npm run qr

   # Menú interactivo de autenticación:
   npm start

   # Modo desarrollo:
   npm run dev

3. ${YELLOW}Vincula el bot con WhatsApp${NC}
   Con USE_PAIRING_CODE=true, escribe el código de 8 caracteres en
   WhatsApp > Dispositivos vinculados > Vincular con el número del bot.

${BOLD}📌 Comandos útiles:${NC}
   • Ver logs: pm2 logs vaniabot
   • Reiniciar: pm2 restart vaniabot
   • Estado: pm2 status
   • Panel de salud: http://localhost:3000/api/health (con el bot corriendo)

${BOLD}🔧 Mantener el bot funcionando 24/7:${NC}

   # Activar wake lock (evita que Termux se duerma):
   termux-wake-lock

   # Usar PM2:
   npm install -g pm2
   pm2 start vania.ts --interpreter tsx --name vaniabot
   pm2 save
   pm2 startup

${BOLD}⚠️ Notas importantes:${NC}
   • El bot requiere ser admin del grupo para funcionar correctamente
   • Asegúrate de que FFmpeg esté instalado para funciones de video
   • Guarda tu sesión periódicamente haciendo backup de vaniasession/
   • docx->pdf y ppt->pdf no funcionan en Termux (LibreOffice no existe
     en Android); pdf->img, pdf->docx y pdf->pptx sí (si PyMuPDF instaló)
   • El prefijo configurado funciona, y también valen '.' y '!' siempre

${BOLD}🐛 Solución de problemas:${NC}
   • Error de permisos: termux-setup-storage
   • Ver logs: cat install-termux.log
   • Reinstalar deps: rm -rf node_modules && npm install && npm run postinstall
   • Node viejo: pkg upgrade nodejs  (se requiere Node 20+)

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# Función principal
# ══════════════════════════════════════════════════════════════════════════════

main() {
    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                INSTALL_MODE="full"
                shift
                ;;
            --minimal)
                INSTALL_MODE="minimal"
                warn "Modo mínimo activado - algunas funciones pueden no estar disponibles"
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
                error "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Iniciar log
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Iniciando instalación de VaniaBot v$BOT_VERSION ===" > "$LOG_FILE"

    header "VaniaBot v$BOT_VERSION - Instalación para Termux"

    echo -e "${BOLD}Modo de instalación:${NC} ${CYAN}$INSTALL_MODE${NC}"
    echo ""

    # Ejecutar pasos
    check_environment
    install_system_deps

    if [ "${SKIP_NPM:-false}" != "true" ]; then
        install_nodejs_deps
    else
        warn "Saltando instalación de npm..."
    fi

    setup_config

    if verify_installation; then
        show_instructions
        success "Instalación completada"
    else
        error "La instalación tuvo algunos problemas"
        warn "Revisa el archivo $LOG_FILE para más detalles"
        exit 1
    fi
}

# Ejecutar
main "$@"
