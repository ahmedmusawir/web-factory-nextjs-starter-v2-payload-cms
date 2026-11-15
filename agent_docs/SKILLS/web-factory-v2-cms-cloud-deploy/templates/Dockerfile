# TEMPLATE — adapt package manager, Node engines, actual Next distDir, monorepo paths,
# native dependencies and build-time Turso needs BEFORE executing.
# THIS DEFAULT IS RUNTIME-ONLY, build requires no secrets. Do NOT pass DB secrets as ARG.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN test -f .next/standalone/server.js

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080
# Node image includes an unprivileged 'node' user. Runtime ISR file cache needs write access.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# If the app has no public/ directory, adapt rather than hiding COPY failure.
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 8080
CMD ["node", "server.js"]
