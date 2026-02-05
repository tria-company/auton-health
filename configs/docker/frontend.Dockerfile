# Multi-stage Dockerfile for Next.js frontend (apps/frontend)
# Optimized for production runtime with minimal image size

FROM node:18-bookworm-slim AS base
WORKDIR /app

# ---------- Dependencies (cached) ----------
FROM base AS deps

# Install OS deps used by Next.js (sharp optional)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     libc6 libglib2.0-0 libgcc1 libstdc++6 ca-certificates curl \
     python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy only manifests for better caching (frontend depende de @medcall/shared-types)
COPY package.json package-lock.json lerna.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

# Install root deps (workspaces) once
RUN npm ci

# ---------- Builder ----------
FROM deps AS builder
COPY . .

# Build only the frontend workspace
RUN npm run build -w @medcall/frontend

# ---------- Production runtime ----------
FROM base AS runner
ENV NODE_ENV=production

# Non-root for security
RUN useradd -m nextjs
USER nextjs

WORKDIR /app

# Copy only what is needed to run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=builder /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

ENV PORT=3000
EXPOSE 3000

# Healthcheck against Next.js default route
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/ || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0", "--dir", "apps/frontend"]


