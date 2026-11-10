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
RUN npm ci

FROM node:20-bookworm-slim AS runner

LABEL org.opencontainers.image.title="OrbitBot IA"
LABEL org.opencontainers.image.authors="Carlos Garcia"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
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
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && pip3 install --no-cache-dir pymupdf --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=America/Mexico_City

RUN groupadd --system --gid 1001 orbit \
    && useradd --system --uid 1001 --gid orbit --create-home orbit \
    && mkdir -p /home/orbit/.cache/fontconfig /var/cache/fontconfig \
    && chown -R orbit:orbit /home/orbit/.cache \
    && chmod 777 /var/cache/fontconfig \
    && fc-cache -f

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
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
