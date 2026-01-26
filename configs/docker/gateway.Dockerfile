# Multi-stage Dockerfile for MedCall Gateway (Node/Express + Socket.IO)
# Optimized for monorepo with npm workspaces and production runtime

FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=development

# System deps often needed by native packages (e.g., sharp) and node-gyp
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Prime workspace manifests to leverage layer caching
COPY package.json package-lock.json lerna.json ./
COPY apps/backend/gateway/package.json apps/backend/gateway/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/utils/package.json packages/utils/package.json

# Install all workspace deps (dev + prod) once at the root
# Usar --include=dev para garantir que todas as dependências sejam instaladas
RUN npm ci --include=dev

# Garantir que resend está instalado (pode não estar devido a hoisting do workspace)
RUN if [ ! -d "node_modules/resend" ]; then \
      echo "⚠️ resend não encontrado após npm ci, instalando..." && \
      npm install resend@^6.8.0 --save --legacy-peer-deps && \
      echo "✅ resend instalado no build"; \
    else \
      echo "✅ resend já está presente no build"; \
    fi && \
    npm list resend || echo "⚠️ resend não listado"

# Copy full repository and build only the gateway package
COPY . .
RUN npm run build:gateway

# ---------- Runtime ----------
FROM base AS runtime

# Add tini for proper signal handling in containers
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini curl ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy root manifests and node_modules from builder
COPY --from=builder /app/package.json /app/package-lock.json /app/lerna.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built gateway artifacts and its package manifest
COPY --from=builder /app/apps/backend/gateway/dist ./apps/backend/gateway/dist
COPY --from=builder /app/apps/backend/gateway/package.json ./apps/backend/gateway/package.json

# Garantir que resend está instalado no runtime (backup caso não tenha sido copiado)
RUN if [ ! -d "node_modules/resend" ]; then \
      echo "⚠️ resend não encontrado no runtime, instalando..." && \
      npm install resend@^6.8.0 --no-save --legacy-peer-deps && \
      echo "✅ resend instalado no runtime"; \
    else \
      echo "✅ resend já está presente no runtime"; \
    fi && \
    test -d node_modules/resend && echo "✅ resend confirmado presente" || echo "❌ resend ainda não encontrado"

# Environment - PORT will be set by Cloud Run
# ENV PORT=3001  # Removed - Cloud Run sets this dynamically
# EXPOSE 3001    # Removed - Cloud Run handles port exposure

# Healthcheck hits the non-authenticated health endpoint
# Uses PORT env var (defaults to 8080 if not set)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/backend/gateway/dist/index.js"]



