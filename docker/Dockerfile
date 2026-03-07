# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only the server and shared package files first
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/

# Install dependencies for shared package
WORKDIR /app/packages/shared
RUN npm ci --legacy-peer-deps

# Install dependencies for server
WORKDIR /app/apps/server
RUN npm ci --legacy-peer-deps

# Copy source code
WORKDIR /app
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build server
WORKDIR /app/apps/server
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY packages/shared/package*.json ./packages/shared/
COPY apps/server/package*.json ./apps/server/

# Install production dependencies for shared package
WORKDIR /app/packages/shared
ENV NODE_ENV=production
RUN npm ci --omit=dev --legacy-peer-deps

# Install production dependencies for server
WORKDIR /app/apps/server
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built files from builder
WORKDIR /app
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Create data and logs directories
RUN mkdir -p /data /app/logs && \
    chown -R node:node /data /app/logs

# Set environment variables
ENV NODE_ENV=production \
    DATABASE_PATH=/data/playlist-lab.db \
    PORT=3001

# Switch to non-root user
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server with dumb-init
WORKDIR /app/apps/server
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
