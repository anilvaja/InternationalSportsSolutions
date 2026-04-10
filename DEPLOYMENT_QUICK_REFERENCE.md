# GoDaddy Deployment - Quick Reference

## Pre-Deployment Setup (One-Time)

### 1. GoDaddy Account Preparation
```bash
‼ Contact GoDaddy support or check account settings:
   □ Confirm PHP 8.2+ is installed
   □ Enable SSH access
   □ Verify Composer is installed
   □ Verify Git is installed
   □ Confirm you have cPanel access
```

### 2. Create Database and User (in cPanel)
```
Hosting > MySQL Databases:
   □ Create database: yourdomain_dbname
   □ Create user: yourdomain_user with strong password
   □ Grant ALL privileges to user for database
   
Note the full credentials:
   DB_HOST: localhost
   DB_DATABASE: yourdomain_dbname
   DB_USERNAME: yourdomain_user
   DB_PASSWORD: ••••••••••••••
```

### 3. Prepare Your Git Repository
```bash
# Ensure all code is committed
git status
git add .
git commit -m "Prepare for GoDaddy deployment"
git push origin main
```

### 4. Generate Production APP_KEY
```bash
# Run locally first
php artisan key:generate --show
# Copy the base64:xxxx... value
# Save it - you'll need it in .env on the server
```

## Initial Deployment Steps

### Step 1: SSH into GoDaddy Server
```bash
# Get SSH credentials from GoDaddy account settings
ssh username@domain.com
# Or: ssh username@IP_ADDRESS

# Navigate to web root
cd public_html
```

### Step 2: Run One-Time Setup
```bash
# Upload or download deployment files first
# Then run automatic deployment script

bash deploy.sh

# Or follow manual steps below...
```

### Step 3: Manual Setup (Alternative)
```bash
# Clone repository
git clone https://github.com/yourusername/InternationalSportsSolutions.git .

# OR if private repo - use token:
git clone https://TOKEN@github.com/yourusername/InternationalSportsSolutions.git .

# Copy environment file
cp .env.production .env

# Edit .env with production settings
nano .env
# Update:
#   APP_URL=https://yourdomain.com
#   APP_KEY=base64:xxxx... (from step 4 above)
#   DB_CONNECTION=mysql
#   DB_HOST=localhost
#   DB_DATABASE=yourdomain_dbname
#   DB_USERNAME=yourdomain_user
#   DB_PASSWORD=••••••••••••••
# Save: CTRL+X, then Y, then ENTER

# Install dependencies
composer install --no-dev --optimize-autoloader

# Run migrations
php artisan migrate --force

# Seed initial data
php artisan db:seed

# Clear and optimize caches
php artisan config:clear
php artisan config:cache
php artisan cache:clear
php artisan route:cache
php artisan view:cache

# Set file permissions
chmod -R 755 storage bootstrap/cache
```

### Step 4: Verify Deployment
```bash
# Visit your domain
https://yourdomain.com

# Access admin panel
https://yourdomain.com/admin

# View error logs if needed
tail -f storage/logs/laravel.log
```

## Deployment Files Provided

1. **deploy.sh** - Full automated deployment script
   - Use for initial deployment on fresh GoDaddy server
   - Handles all setup from git clone to optimization
   - Edit variables before running

2. **update.sh** - Quick update script
   - Use after initial deployment to push code updates
   - Only pulls latest code and runs migrations
   - Much faster than full deployment

3. **.env.production** - Production environment template
   - Copy to .env on GoDaddy server
   - Update with your production values

4. **GODADDY_DEPLOYMENT_GUIDE.md** - Detailed guide
   - Complete instructions for setup
   - Troubleshooting tips
   - Security best practices

## Common Commands on GoDaddy

```bash
# View application logs
tail -f storage/logs/laravel.log

# Clear everything
php artisan cache:clear
php artisan config:clear  
php artisan view:clear

# Run migrations
php artisan migrate --force

# Database reset (CAREFUL!)
php artisan migrate:refresh --force

# Check app status
php artisan tinker
# In tinker: exit

# Update code
bash update.sh

# Manually pull updates
git pull origin main
```

## Critical Reminders

⚠️ **Don't Forget:**
- [ ] Update GitHubrepository URL in deploy.sh
- [ ] Update GoDaddy paths in deploy.sh  
- [ ] Set correct .env values for production
- [ ] Use HTTPS (APP_URL=https://...)
- [ ] Disable APP_DEBUG in production
- [ ] Set LOG_LEVEL=error in production
- [ ] Back up database before migrations
- [ ] Test admin login after deployment
- [ ] Check error logs for any warnings

## Rollback Steps (If Something Goes Wrong)

```bash
# SSH into server
ssh username@domain.com
cd public_html

# Revert code to previous commit
git log --oneline  # See recent commits
git reset --hard COMMIT_HASH  # Go back to specific commit

# Restore database backup
cp database/database.sqlite.backup.20240410_143022 database/database.sqlite

# Clear caches
php artisan cache:clear

# Restart should happen automatically - test your site
```

## Future Updates

Each time you want to deploy new code:

```bash
# Option 1: Use the update script
bash update.sh

# Option 2: Do it manually
git pull origin main
php artisan migrate --force
php artisan cache:clear
php artisan config:cache
php artisan route:cache
```

## Monitoring & Maintenance

### Weekly Tasks
- Check error logs: `tail -50 storage/logs/laravel.log`
- Monitor database size in cPanel

### Monthly Tasks
- Back up database (GoDaddy > Backups)
- Review disk space usage
- Check for PHP updates needed

### Before Major Updates
- Create full database backup
- Test updates on local environment
- Have rollback plan ready

## Get Help

**For GoDaddy Issues:**
- GoDaddy Support Chat
- GoDaddy Phone Support: Check your account

**For Laravel Issues:**
- Laravel Documentation: https://laravel.com/docs/12
- Stack Overflow tag: [laravel]
- Log files: storage/logs/laravel.log

**For This Project:**
- Check GODADDY_DEPLOYMENT_GUIDE.md for detailed steps
- Review application logs for specific errors
