FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
# Every release bumps the version in package.json, which invalidates the COPY
# above and with it this layer: npm ci runs again on each deploy. The cache
# mount keeps npm's tarball cache outside the image, so a re-run is served from
# disk instead of re-downloading 600+ packages (~527s on a slow link, ~12s
# warm). The mount is not committed to the image, only /app/node_modules is.
RUN --mount=type=cache,target=/root/.npm,sharing=locked npm ci

FROM node:20-bookworm-slim AS runner

LABEL org.opencontainers.image.title="OrbitBot IA"
LABEL org.opencontainers.image.authors="Carlos Garcia"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
    libreoffice-writer \
    libreoffice-impress \
    poppler-utils \
    libcairo2 \
    libpango1.0-0 \
    libgif7 \
    libjpeg62-turbo \
    librsvg2-2 \
    libpng16-16 \
    libvips42 \
    libglib2.0-0 \
    fonts-noto \
    fonts-noto-color-emoji \
    tzdata \
    curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp via pip with curl-cffi extra: TikTok requires browser TLS
# impersonation and the standalone release binary ships without it
RUN pip3 install --no-cache-dir --timeout 120 --retries 10 --break-system-packages \
    "yt-dlp[default,curl-cffi]"

# TikTok rejects non-browser TLS fingerprints (403) and intermittently blocks
# server IPs; force Chrome impersonation, retry webpage requests, and use
# real-session cookies when the user drops them at /app/data/tiktok_cookies.txt
# (missing file is tolerated: yt-dlp just runs with an empty cookie jar)
RUN printf -- '--impersonate chrome\n--extractor-retries 3\n--cookies /app/data/tiktok_cookies.txt\n' > /etc/yt-dlp.conf

RUN pip3 install --no-cache-dir --timeout 120 --retries 10 \
    pymupdf --break-system-packages

ENV TZ=America/Mexico_City

RUN groupadd --system --gid 1001 orbit \
    && useradd --system --uid 1001 --gid orbit --create-home orbit \
    && mkdir -p /home/orbit/.cache/fontconfig /var/cache/fontconfig \
    && chown -R orbit:orbit /home/orbit/.cache \
    && chmod 777 /var/cache/fontconfig \
    && fc-cache -f

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY package.json ./
COPY src/ ./src/
COPY panel/ ./panel/
COPY data/ ./data/

COPY data/assets/ ./static/assets/

RUN mkdir -p orbitsession data/temp logs \
    && chown -R orbit:orbit /app

USER orbit

# Build arguments for environment customization
ARG USE_REDIS=false
ARG REDIS_HOST=orbit-redis
ARG REDIS_PORT=6379

ENV NODE_ENV=production \
    AUTH_MODE=qr \
    FONTCONFIG_CACHE=/home/orbit/.cache/fontconfig \
    DOCKER_MODE=true \
    USE_REDIS=${USE_REDIS} \
    REDIS_HOST=${REDIS_HOST} \
    REDIS_PORT=${REDIS_PORT} \
    PATH="/app/node_modules/.bin:${PATH}"

ENV ASSETS_DIR=/app/data/assets

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node_modules/.bin/tsx", "src/orbit.ts", "qr"]
