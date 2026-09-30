# syntax=docker/dockerfile:1

# ---- deps: production dependencies only ----
# argon2 ships prebuilt binaries for linux-musl (x64/arm64), so no compiler toolchain is needed.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime: minimal image, runs as the unprivileged "node" user ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node drizzle ./drizzle
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Node runs as PID 1 and handles SIGTERM itself (see src/server.js), so graceful shutdown works.
CMD ["node", "src/server.js"]
