FROM node:20-alpine AS build
WORKDIR /app
RUN npm config set fetch-retries 5 fetch-retry-mintimeout 20000 fetch-retry-maxtimeout 120000 fetch-timeout 600000
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine

# Run nginx as the image's built-in unprivileged "nginx" user instead of
# root: drop the "user nginx;" directive (meaningless once the master
# process itself isn't root), move the pid file to /tmp (world-writable,
# unlike /run), and hand cache dirs + html to that user. nginx.conf listens
# on 8080 to match (nginx can't bind :80 without root).
RUN sed -i '/^user  *nginx;/d' /etc/nginx/nginx.conf \
    && sed -i 's#pid\s*/run/nginx.pid;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf \
    && mkdir -p /var/cache/nginx/client_temp \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1
