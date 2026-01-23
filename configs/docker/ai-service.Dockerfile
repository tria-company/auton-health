# Multi-stage Dockerfile for MedCall AI Service (LLM/RAG)
# Lightweight image for AI/OpenAI operations

FROM node:18-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=development

# System deps for native packages
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Prime workspace manifests to leverage layer caching
COPY package.json package-lock.json lerna.json ./
COPY apps/backend/ai-service/package.json apps/backend/ai-service/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/utils/package.json packages/utils/package.json

# Install all workspace deps (dev + prod) once at the root
RUN npm ci

# Copy full repository and build only the ai-service package
COPY . .
RUN npm run build:ai

# ---------- Runtime ----------
FROM base AS runtime

# Add tini for proper signal handling and curl for healthcheck
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     tini curl ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy root manifests and node_modules from builder
COPY --from=builder /app/package.json /app/package-lock.json /app/lerna.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built ai-service artifacts and its package manifest
COPY --from=builder /app/apps/backend/ai-service/dist ./apps/backend/ai-service/dist
COPY --from=builder /app/apps/backend/ai-service/package.json ./apps/backend/ai-service/package.json

# Environment - PORT will be set by Cloud Run (defaults to 8080)
# EXPOSE 3003  # Removed - Cloud Run handles port exposure

# Healthcheck hits the non-authenticated health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/backend/ai-service/dist/index.js"]
