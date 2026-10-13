# syntax=docker/dockerfile:1.7
# SaveLink — image production (Next.js standalone + yt-dlp + ffmpeg + Deno)
#   docker build -t savelink --build-arg NEXT_PUBLIC_SITE_URL=https://domainkamu.com .

ARG NODE_VERSION=22
ARG DENO_VERSION=2.9.7

# ---------- Deno (JS runtime yang dipakai yt-dlp untuk YouTube) ----------
FROM denoland/deno:bin-${DENO_VERSION} AS deno

# ---------- dependencies ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* di-inline saat build → wajib diisi di sini, bukan saat runtime.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS run
ARG TARGETARCH
ARG YTDLP_VERSION=latest

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl tini \
 && rm -rf /var/lib/apt/lists/*

# yt-dlp: binary resmi (sudah berisi yt-dlp-ejs & curl_cffi → YouTube & TikTok jalan).
# Disimpan di folder milik user `node` agar `yt-dlp -U` (auto-update) bisa menimpa dirinya.
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in arm64) asset=yt-dlp_linux_aarch64 ;; *) asset=yt-dlp_linux ;; esac; \
    if [ "$YTDLP_VERSION" = "latest" ]; then \
      url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}"; \
    else \
      url="https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${asset}"; \
    fi; \
    mkdir -p /opt/yt-dlp /tmp/savelink; \
    curl -fsSL "$url" -o /opt/yt-dlp/yt-dlp; \
    chmod 0755 /opt/yt-dlp/yt-dlp; \
    chown -R node:node /opt/yt-dlp /tmp/savelink

COPY --from=deno /deno /usr/local/bin/deno

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PATH=/opt/yt-dlp:$PATH \
    YTDLP_PATH=/opt/yt-dlp/yt-dlp \
    YTDLP_JS_RUNTIMES=deno \
    YTDLP_AUTO_UPDATE=true \
    DOWNLOAD_DIR=/tmp/savelink

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health > /dev/null || exit 1

# tini: meneruskan sinyal & membersihkan proses anak (yt-dlp/ffmpeg) yang yatim.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
