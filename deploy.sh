#!/bin/bash
set -e

# ==============================================================================
# Linux Deployment Script for International Sports Solutions (Node.js & SQLite)
# ==============================================================================

echo "=========================================================="
echo " International Sports Solutions - Linux Deployment Script "
echo "=========================================================="

# 1. Verify Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 18+ or 22 LTS."
    exit 1
fi
echo "[1/5] Node.js version: $(node -v)"

# 2. Install dependencies
echo "[2/5] Installing npm dependencies..."
npm install --omit=dev
npm rebuild better-sqlite3

# 3. Create persistent directories
echo "[3/5] Verifying persistent directories..."
mkdir -p data/academies storage/uploads storage/backups storage/logs
chmod -R 775 data storage

# 4. Run migrations and database seeds
echo "[4/5] Running database migrations and multi-tenant seed..."
node src/db/seed.js

# 5. Start / Restart via PM2
echo "[5/5] Managing process with PM2..."
if command -v pm2 &> /dev/null; then
    pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
    echo "Application running via PM2."
else
    echo "PM2 not found. Running directly via Node.js..."
    node server.js
fi
