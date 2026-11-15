# syntax=docker/dockerfile:1.7
FROM node:22.23.5-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS operator
COPY . .
# Explicit migration job only; never migrate at web-server startup.
CMD ["npm", "run", "db:status"]

FROM operator AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# BuildKit mounts approved read-only build configuration without adding it to a layer.
# Target must already have reviewed migrations. Never bake credentials via ARG/ENV.
RUN --mount=type=secret,id=app_env,target=/app/.env.local,required=true \
    BUILD_STANDALONE=1 npm run build && \
    find .next/standalone -name '.env*' -type f -delete && \
    node --import tsx scripts/check-container-secrets.ts

FROM node:22.23.5-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
