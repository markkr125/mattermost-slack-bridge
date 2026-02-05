# Multi-stage build for optimized production image
FROM node:18-alpine AS dependencies
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime
LABEL maintainer="mattermost-slack-bridge"
LABEL description="Bidirectional bridge between Mattermost and Slack"

WORKDIR /bridge

# Copy production dependencies from builder
COPY --from=dependencies /build/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package*.json ./

# Create unprivileged user for security
RUN addgroup -g 1001 bridgegroup && \
    adduser -D -u 1001 -G bridgegroup bridgeuser && \
    chown -R bridgeuser:bridgegroup /bridge

# Switch to unprivileged user
USER bridgeuser

# Expose application port
EXPOSE 3000

# Configure health monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => {process.exit(res.statusCode === 200 ? 0 : 1)})"

# Launch application
CMD ["npm", "start"]
