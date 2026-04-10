#!/bin/bash

################################################################################
# Laravel Application Deployment Script for GoDaddy
# 
# This script automates the deployment of the Laravel application to a GoDaddy
# shared hosting or cPanel-based server.
#
# Usage: bash deploy.sh
# 
# Prerequisites:
# - SSH access to your GoDaddy server
# - Git installed on the server
# - Composer installed on the server
# - PHP 8.2+ configured
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_PATH="/home/ph9n3ht592iq/public_html"
GIT_REPO="https://github.com/anilvaja/InternationalSportsSolutions.git"
GIT_BRANCH="master"
APP_ENV="production"

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Start deployment
print_header "Laravel Application Deployment"

# Step 1: Check if deploy path exists
print_header "Step 1: Checking Prerequisites"
if [ ! -d "$DEPLOY_PATH" ]; then
    print_error "Deploy path does not exist: $DEPLOY_PATH"
    exit 1
fi
print_success "Deploy path exists: $DEPLOY_PATH"

# Check if git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_success "Git is installed"

# Check if composer is installed
if ! command -v composer &> /dev/null; then
    print_error "Composer is not installed"
    exit 1
fi
print_success "Composer is installed"

# Step 2: Clone or update repository
print_header "Step 2: Cloning/Updating Repository"
if [ -d "$DEPLOY_PATH/.git" ]; then
    print_warning "Repository already exists, pulling latest changes..."
    cd "$DEPLOY_PATH"
    git fetch origin
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
else
    print_warning "Repository doesn't exist, cloning..."
    git clone --branch "$GIT_BRANCH" "$GIT_REPO" "$DEPLOY_PATH"
    cd "$DEPLOY_PATH"
fi
print_success "Repository updated/cloned successfully"

# Step 3: Install Composer dependencies
print_header "Step 3: Installing Composer Dependencies"
composer install --no-dev --optimize-autoloader
print_success "Composer dependencies installed"

# Step 4: Environment setup
print_header "Step 4: Setting up Environment"
if [ ! -f "$DEPLOY_PATH/.env" ]; then
    print_warning ".env file not found, creating from .env.example..."
    cp "$DEPLOY_PATH/.env.example" "$DEPLOY_PATH/.env"
    print_warning "Please configure .env file with your production settings"
else
    print_success ".env file exists"
fi

# Step 5: Generate application key (if not already set)
if grep -q "APP_KEY=$" "$DEPLOY_PATH/.env"; then
    print_warning "APP_KEY is empty, generating..."
    php artisan key:generate --env=production
else
    print_success "APP_KEY is set"
fi

# Step 6: Database setup
print_header "Step 5: Database Migrations"
# Backup database (for SQLite, if using)
if [ -f "$DEPLOY_PATH/database/database.sqlite" ]; then
    cp "$DEPLOY_PATH/database/database.sqlite" "$DEPLOY_PATH/database/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)"
    print_success "Database backup created"
fi

# Run migrations
php artisan migrate --force
print_success "Database migrations completed"

# Step 7: Seed database (optional - uncomment if needed)
# print_header "Step 6: Seeding Database"
# php artisan db:seed --class=DatabaseSeeder
# print_success "Database seeded"

# Step 8: Clear caches
print_header "Step 6: Clearing Caches"
php artisan config:clear
php artisan cache:clear
php artisan view:clear
php artisan route:clear
print_success "Caches cleared"

# Step 9: Optimize for production
print_header "Step 7: Optimizing for Production"
php artisan config:cache
php artisan route:cache
php artisan view:cache
print_success "Application optimized"

# Step 10: Set file permissions
print_header "Step 8: Setting File Permissions"
# Set correct permissions for storage and bootstrap directories
chmod -R 755 "$DEPLOY_PATH/storage"
chmod -R 755 "$DEPLOY_PATH/bootstrap/cache"
find "$DEPLOY_PATH/storage" -type f -exec chmod 644 {} \;
find "$DEPLOY_PATH/bootstrap/cache" -type f -exec chmod 644 {} \;
print_success "File permissions set correctly"

# Step 11: Set ownership (if running as root - be careful!)
# Uncomment if needed (replace www-data with your web server user)
# chown -R www-data:www-data "$DEPLOY_PATH"
# print_success "Ownership set correctly"

# Step 12: Queue and Scheduler setup (optional)
print_header "Step 9: Queue and Scheduler Setup (Optional)"
echo ""
echo "If you're using Laravel Job Queues, add this to your cron:"
echo "* * * * * cd $DEPLOY_PATH && php artisan schedule:run >> /dev/null 2>&1"
print_warning "Configure this in cPanel > Cron Jobs if needed"

# Step 13: Final verification
print_header "Step 10: Final Verification"
# Test database connection
if php artisan tinker --execute="exit;" 2>/dev/null; then
    print_success "Application is ready!"
else
    print_error "There might be an issue with the application"
fi

# Completion
print_header "Deployment Complete!"
echo ""
echo -e "${GREEN}Your Laravel application has been successfully deployed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your application is accessible at your domain"
echo "2. Check application logs: tail -f $DEPLOY_PATH/storage/logs/laravel.log"
echo "3. If issues occur, restore database backup: cp $DEPLOY_PATH/database/database.sqlite.backup.* $DEPLOY_PATH/database/database.sqlite"
echo ""
