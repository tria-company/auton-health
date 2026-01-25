# Multi-stage Dockerfile for MedCall Realtime Service (Socket.IO + Transcription)
# Includes FFmpeg for audio processing

FROM node:18-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# ---------- Builder ----------
FROM base AS builder
ENV NODE_ENV=development

# System deps for native packages and ffmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     python3 make g++ git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Prime workspace manifests to leverage layer caching
COPY package.json package-lock.json lerna.json ./
COPY apps/backend/realtime-service/package.json apps/backend/realtime-service/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/utils/package.json packages/utils/package.json

# Install all workspace deps (dev + prod) once at the root
RUN npm ci

# Copy full repository
COPY . .

# Build shared-types first (required by realtime-service)
RUN npm run build --workspace=packages/shared-types

# Then build realtime-service
RUN npm run build:realtime

# ---------- Runtime ----------
FROM base AS runtime

# Add tini for proper signal handling, curl for healthcheck, and ffmpeg for audio processing
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     tini curl ca-certificates ffmpeg \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy root manifests and node_modules from builder
COPY --from=builder /app/package.json /app/package-lock.json /app/lerna.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built shared-types package (required by realtime-service)
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json

# Create symlink for @medcall/shared-types in node_modules (npm workspaces use symlinks)
RUN mkdir -p node_modules/@medcall && \
    ln -sf /app/packages/shared-types node_modules/@medcall/shared-types

# Copy built realtime-service artifacts and its package manifest
COPY --from=builder /app/apps/backend/realtime-service/dist ./apps/backend/realtime-service/dist
COPY --from=builder /app/apps/backend/realtime-service/package.json ./apps/backend/realtime-service/package.json
# Copy realtime-service node_modules (dependencies may not be hoisted to root in npm workspaces)
COPY --from=builder /app/apps/backend/realtime-service/node_modules ./apps/backend/realtime-service/node_modules

# Environment - PORT will be set by Cloud Run (defaults to 8080)
# EXPOSE 3002  # Removed - Cloud Run handles port exposure

# Healthcheck hits the non-authenticated health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-8080}/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/backend/realtime-service/dist/index.js"]
