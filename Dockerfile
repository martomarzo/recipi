FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/data/app.db"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/data/app.db"

# Chromium para el export a PDF (puppeteer-core lo usa vía esta ruta)
RUN apk add --no-cache openssl chromium font-noto ttf-liberation
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV UPLOADS_DIR=/data/uploads

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI + esquema para correr migraciones al arrancar
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
# bcryptjs para el seed (Next lo bundlea en sus chunks, no queda resolvible)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data && chown -R nextjs:nodejs /data /app/public && chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["./docker-entrypoint.sh"]
