FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 fetch-retry-maxtimeout 120000 fetch-timeout 600000
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 fetch-retry-maxtimeout 120000 fetch-timeout 600000
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

# Local file storage (backend/src/common/storage/storageAdapter.ts) needs a
# writable dir under /app at runtime, and the non-root "node" user (built
# into the base image) needs ownership of everything it will read/execute.
RUN mkdir -p /app/storage && chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/server.js"]
