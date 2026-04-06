# ═══════════════════════════════════════════════════════════════════
#  Frontend Dockerfile — Multi-stage Build
#
#  Stage 1 (builder): Node.js builds the React app into static files
#  Stage 2 (production): Nginx serves the static files
#
#  Result: ~25MB image instead of ~500MB
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Build React app ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first — Docker caches this layer
# Only re-installs when package.json changes
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build
# Output is in /app/build/


# ── Stage 2: Serve with Nginx ────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
