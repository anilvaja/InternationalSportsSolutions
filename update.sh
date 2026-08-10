#!/bin/bash

################################################################################
# Quick Update Deployment Script for GoDaddy
# 
# Use this script for deploying updates to an already-deployed application
# Much faster than full deployment as it only updates code and runs migrations
#
# Usage: bash update.sh
################################################################################

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DEPLOY_PATH="/home/ph9n3ht592iq/public_html"
GIT_BRANCH="main"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Start update
print_header "Laravel Application Update"

cd "$DEPLOY_PATH"
print_success "Changed to deploy directory"

# Step 1: Pull latest code
print_header "Pulling Latest Code"
git fetch origin
git checkout "$GIT_BRANCH"
git pull origin "$GIT_BRANCH"
print_success "Code updated"

# Step 2: Update dependencies (optional - only if composer.lock changed)
print_header "Checking Dependencies"
if git diff HEAD~1..HEAD --name-only | grep -q "composer.lock\|composer.json"; then
    print_warning "composer.lock/json changed, updating dependencies..."
    composer install --no-dev --optimize-autoloader
    print_success "Dependencies updated"
else
    print_success "No dependency changes detected"
fi

# Step 2b: Rebuild front-end assets if front-end source changed (or build/ is missing)
print_header "Checking Front-end Assets"
if [ ! -d "public/build" ] || git diff HEAD~1..HEAD --name-only | grep -Eq "package(-lock)?\.json|vite\.config\.js|resources/(css|js)/"; then
    print_warning "Front-end changes detected (or no prior build found), rebuilding assets..."
    if ! command -v npm &> /dev/null; then
        print_warning "npm is not installed - skipping asset build. The site may render unstyled."
    else
        npm ci
        npm run build
        php artisan filament:assets
        print_success "Front-end assets rebuilt"
    fi
else
    print_success "No front-end changes detected"
fi

# Step 3: Database backup
print_header "Backing Up Database"
if [ -f "database/database.sqlite" ]; then
    cp database/database.sqlite database/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Database backup created"
fi

# Step 4: Run migrations
print_header "Running Database Migrations"
php artisan migrate --force
print_success "Migrations completed"

# Step 5: Clear caches
print_header "Clearing Caches"
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear
print_success "Caches cleared"

# Step 6: Optimize
print_header "Optimizing Application"
php artisan config:cache
php artisan route:cache
php artisan view:cache
print_success "Application optimized"

# Complete
print_header "Update Complete!"
echo ""
echo -e "${GREEN}Application has been successfully updated!${NC}"
echo "Review logs: tail -f $DEPLOY_PATH/storage/logs/laravel.log"
