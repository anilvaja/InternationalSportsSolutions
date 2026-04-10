# GoDaddy Laravel Deployment Guide

This guide explains how to deploy the International Sports Solutions Laravel application to GoDaddy hosting.

## Prerequisites

1. **GoDaddy Account** with:
   - Shared hosting or VPS with cPanel
   - SSH access enabled
   - PHP 8.2+ installed
   - Composer installed (usually available)
   - Git installed (usually available)

2. **Local Setup**:
   - Git repository set up and pushed to GitHub/GitLab
   - All code committed and ready for deployment

## Pre-Deployment Checklist

- [ ] Ensure your domain is pointing to GoDaddy servers
- [ ] Enable SSH access in GoDaddy account settings
- [ ] Create MySQL database and user in cPanel
- [ ] Note your database credentials
- [ ] Generate a production APP_KEY locally: `php artisan key:generate --show`
- [ ] Have your Git repository URL ready (public or with SSH key auth)

## Step-by-Step Deployment

### 1. Connect to Your GoDaddy Server via SSH

```bash
# Get your SSH credentials from GoDaddy account
ssh username@your-domain.com

# Or use IP address
ssh username@123.456.789.000
```

**Finding SSH credentials in GoDaddy:**
- Log in to GoDaddy
- Go to Hosting > Manage
- Click "Manage All" next to Web Hosting
- Scroll to "Advanced" and click "SSH"
- Copy your SSH connection string

### 2. Prepare Your Deployment Directory

```bash
# Navigate to public_html (or your web root)
cd public_html

# Remove any existing files (if doing fresh deployment)
# WARNING: This deletes everything - backup first!
# rm -rf *

# Create deployment directory (optional - for subfolder deployment)
# mkdir laravel-app
# cd laravel-app
```

### 3. Clone Your Repository

```bash
# If your repo is public:
git clone https://github.com/yourusername/InternationalSportsSolutions.git .

# If your repo is private, you'll need to:
# Option A: Use GitHub Personal Access Token
git clone https://YOUR_TOKEN@github.com/yourusername/InternationalSportsSolutions.git

# Option B: Use SSH key (requires setting up SSH keys)
# git clone git@github.com:yourusername/InternationalSportsSolutions.git
```

### 4. Run the Deployment Script

The `deploy.sh` script automates most of the setup:

```bash
# Make the script executable
chmod +x deploy.sh

# Edit the script to set your paths and Git URL
nano deploy.sh
# Find and replace:
# - DEPLOY_PATH="/home/yourusername/public_html"
# - GIT_REPO="https://github.com/yourusername/repo.git"

# Run the deployment script
bash deploy.sh
```

### 5. Manual Configuration (If Needed)

If you run the script manually or encounter issues:

```bash
# Navigate to your app directory
cd /home/yourusername/public_html

# Copy environment file
cp .env.example .env
# OR
cp .env.production .env

# Edit .env with your production settings
nano .env
# Configure:
# - APP_URL=https://yourdomain.com
# - DB_CONNECTION, DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD
# - MAIL_MAILER, MAIL_HOST, etc.

# Generate application key (if not already done)
php artisan key:generate

# Install dependencies
composer install --no-dev --optimize-autoloader

# Run migrations
php artisan migrate --force

# Seed database (optional)
php artisan db:seed

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chmod -R 755 storage bootstrap/cache
```

## Database Configuration on GoDaddy

### Using cPanel:

1. **Create Database and User:**
   - Log in to cPanel
   - Navigate to "MySQL Databases"
   - Create a new database (note the full name format: `prefix_dbname`)
   - Create a new MySQL user
   - Add the user to the database with "All Privileges"

2. **Update .env with credentials:**
   ```
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_DATABASE=prefix_dbname
   DB_USERNAME=prefix_user
   DB_PASSWORD=your_secure_password
   ```

### Password Reset (if needed):
```bash
# SSH into server
mysql -u your-user -p
# Enter password
# Then in MySQL:
UPDATE mysql.user SET password=PASSWORD('new_password') WHERE user='your-user';
FLUSH PRIVILEGES;
EXIT;
```

## Running Migrations

```bash
# Check current migration status
php artisan migrate:status

# Run migrations
php artisan migrate --force

# If you need to rollback (use with caution in production!)
php artisan migrate:rollback --force
```

## Setting Up Cron Jobs

GoDaddy uses cPanel for cron job management:

1. **For Laravel Scheduler** (if you use it):
   - Log in to cPanel
   - Navigate to "Cron Jobs"
   - Add command: `* * * * * cd /home/yourusername/public_html && php artisan schedule:run >> /dev/null 2>&1`

2. **For Queue Job Processing** (if using):
   - Add command: `* * * * * cd /home/yourusername/public_html && php artisan queue:work --stop-when-empty >> /dev/null 2>&1`

## Verifying Your Deployment

```bash
# Check if app is running
php artisan tinker
# In tinker, run: exit

# Check application logs
tail -f storage/logs/laravel.log

# Check if public directory is accessible
curl https://yourdomain.com

# Test specific routes
curl https://yourdomain.com/admin
```

## Accessing Your Application

1. **Admin Panel**: `https://yourdomain.com/admin`
2. **Student Panel** (if configured): `https://yourdomain.com/student`
3. **API** (if exposed): `https://yourdomain.com/api`

**Default Admin Credentials** (if seeded):
- Email: admin@internationalsportssolutions.com (check seeders)
- Password: Check your DatabaseSeeder

## SSL Certificate

GoDaddy usually includes free SSL with hosting:

1. Generate SSL in cPanel
2. Update `.env` to use `APP_URL=https://yourdomain.com`
3. Ensure Laravel is configured to trust proxies

```php
# In config/trustedproxy.php or bootstrap/app.php
TRUSTED_PROXIES='*'  // or specific IPs
```

## Troubleshooting

### Common Issues:

1. **"Database file does not exist"**
   - Check database credentials in `.env`
   - Verify database and user were created in cPanel
   - Run `php artisan migrate --force`

2. **"Permission denied" errors**
   - Run: `chmod -R 755 storage bootstrap/cache`
   - Run: `find storage -type f -exec chmod 644 {} \;`

3. **"Class not found" errors**
   - Run: `composer dump-autoload`
   - Run: `php artisan cache:clear`

4. **Blank white screen**
   - Check PHP error logs in cPanel
   - Set `APP_DEBUG=true` temporarily to see detailed errors
   - Check storage/logs/laravel.log

5. **Can't connect to database**
   - Verify DB credentials in `.env`
   - SSH into server and test MySQL: `mysql -u dbuser -p -h localhost dbname`
   - Check if MySQL user has proper permissions

### Viewing Logs:

```bash
# Real-time log viewing
tail -f storage/logs/laravel.log

# Last 100 lines
tail -100 storage/logs/laravel.log

# Search for errors
grep ERROR storage/logs/laravel.log
```

### Rollback Procedure:

If deployment fails, you can revert:

```bash
# Restore previous version
git reset --hard HEAD~1
git pull

# Restore database backup
cp storage/backups/database.sqlite.backup storage/database.sqlite

# Clear caches
php artisan cache:clear
```

## Security Best Practices

1. **Set correct .env permissions**:
   ```bash
   chmod 600 .env
   ```

2. **Disable directory listing**:
   - Ensure `.htaccess` is in public directory
   - Verify `Options -Indexes` is set

3. **Set up HTTPS redirect**:
   ```
   # In public/.htaccess
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

4. **Hide Laravel from public**:
   - Never expose `/storage` or `/bootstrap` directories
   - Ensure only `/public` is web-accessible

5. **Regular backups**:
   - Back up database regularly
   - Back up any user-uploaded files
   - Use GoDaddy's backup tool

## Updating Your Application

To deploy updates after initial deployment:

```bash
# Pull latest changes
git pull origin main

# Update dependencies only if needed
composer install --no-dev --optimize-autoloader

# Run new migrations
php artisan migrate --force

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Re-optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Support

For GoDaddy-specific issues:
- GoDaddy Support: https://www.godaddy.com/help
- Chat with GoDaddy support for account/hosting issues

For Laravel issues:
- Laravel Docs: https://laravel.com/docs/12
- Laravel Forum: https://laracasts.com

## Next Steps

1. Test your application thoroughly
2. Set up automated backups
3. Monitor error logs regularly
4. Plan for scaling if needed
5. Set up monitoring/alerts for uptime
