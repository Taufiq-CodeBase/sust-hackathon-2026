FROM node:24-alpine AS base

# Create non-root user for security (OWASP A05)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S copilot -u 1001

WORKDIR /app

# Copy dependency files first (layer caching)
COPY package*.json ./

# Production dependencies only
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Final image
FROM base AS runner
ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY src/ ./src/

# Set ownership
RUN chown -R copilot:nodejs /app

# Switch to non-root user
USER copilot

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]