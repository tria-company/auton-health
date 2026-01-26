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
RUN npm ci --include=dev && \
    echo "Verificando se resend foi instalado..." && \
    ls -la node_modules | grep resend || echo "⚠️ resend não encontrado em node_modules" && \
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

# Verificar se resend está presente no runtime
RUN echo "Verificando resend no runtime..." && \
    ls -la node_modules | grep resend || echo "❌ resend NÃO encontrado" && \
    test -d node_modules/resend && echo "✅ resend encontrado" || (echo "❌ resend NÃO encontrado - instalando..." && npm install resend@^6.8.0 --no-save)

# Environment - PORT will be set by Cloud Run
# ENV PORT=3001  # Removed - Cloud Run sets this dynamically
# EXPOSE 3001    # Removed - Cloud Run handles port exposure

# Healthcheck hits the non-authenticated health endpoint
# Uses PORT env var (defaults to 8080 if not set)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/backend/gateway/dist/index.js"]



