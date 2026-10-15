# ==========================================
# International Sports Solutions — Dockerfile
# ==========================================
FROM node:22-bookworm-slim

# Install system dependencies for better-sqlite3 compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies and rebuild better-sqlite3
RUN npm ci --omit=dev && npm rebuild better-sqlite3

# Copy application source
COPY . .

# Create persistent directories and set permissions
RUN mkdir -p data/academies storage/uploads storage/backups \
    && chown -R node:node /app

USER node

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
