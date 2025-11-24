# Dockerfile for XIV Dye Tools Discord Bot
# Multi-stage build for optimal size

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src ./src
COPY deploy-commands.ts ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install canvas dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/deploy-commands.ts ./

# Per S-3: Create non-root user for security
RUN addgroup -g 1001 -S botuser && \
    adduser -u 1001 -S botuser -G botuser

# Change ownership of app directory
RUN chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Set environment
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
