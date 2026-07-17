FROM node:20-alpine AS deps
# تثبيت FFmpeg من Alpine packages
RUN apk add --no-cache ffmpeg
WORKDIR /app

# نسخ ملفات التبعيات أولاً (Docker cache layer)
COPY package.json ./
RUN npm install

# ---------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# تجميع TypeScript → JavaScript
RUN npx tsc --project tsconfig.json

# ---------------------------------------------------------------
FROM node:20-alpine AS runner
# FFmpeg لازم يكون في الـ final image
RUN apk add --no-cache ffmpeg
WORKDIR /app

# نسخ فقط ما نحتاجه
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist          ./dist

# متغير الوضع (يُكتَب في Railway / Fly environment)
ENV PORT=4000
ENV WORKER_MODE=http
ENV NODE_ENV=production

# مجلد مؤقت قابل للكتابة
RUN mkdir -p /tmp/transcoder
ENV TMP_DIR=/tmp/transcoder

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
