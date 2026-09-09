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
EXPOSE 4000
CMD ["node", "dist/server.js"]
