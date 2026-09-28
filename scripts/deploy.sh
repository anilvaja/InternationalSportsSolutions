#!/bin/bash

# ==============================================================================
# Production Auto-Deployment Script for GoDaddy Shared / cPanel Hosting
# Application: International Sports Solutions (Laravel 12 + Filament v3)
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Production Deployment..."

# 1. Enable Maintenance Mode
echo "🔒 Enabling Maintenance Mode..."
php artisan down || true

# 2. Pull Latest Changes from Repository
echo "📥 Pulling latest changes from master branch..."
git fetch origin master
git reset --hard origin/master

# 3. Install/Update Composer Dependencies (No Dev)
echo "📦 Installing Composer dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# 4. Run Database Migrations
echo "🗄️ Running Database Migrations..."
php artisan migrate --force

# 5. Clear & Rebuild Application Caches
echo "🧹 Clearing and Rebuilding Caches..."
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear

echo "⚡ Optimizing Configuration & Routes..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan filament:cache-components || true

# 6. Ensure Storage Link Exists
echo "🔗 Ensuring Storage Link..."
php artisan storage:link || true

# 7. Set Directory Permissions (GoDaddy cPanel typical defaults)
echo "🔑 Updating File Permissions..."
chmod -R 755 storage bootstrap/cache

# 8. Disable Maintenance Mode
echo "🔓 Disabling Maintenance Mode..."
php artisan up

echo "✅ Production Deployment Completed Successfully!"
