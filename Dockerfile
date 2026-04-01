# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

# Stage 2: Final image
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    mosquitto \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Caddy
RUN curl -fsSL https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz \
    | tar -xz -C /usr/local/bin/

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Copy configs
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/mosquitto.conf /etc/mosquitto/mosquitto.conf
COPY docker/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443 1883 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
