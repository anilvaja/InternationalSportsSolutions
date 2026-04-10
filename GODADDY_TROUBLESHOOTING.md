# GoDaddy Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. Git Clone/Pull Fails

**Error:** `fatal: could not read Username for 'https://github.com': No such file or directory`

**Solution:**
```bash
# Use Personal Access Token instead of password
git clone https://YOUR_TOKEN@github.com/yourusername/repo.git

# Or set up SSH keys on GoDaddy server:
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter for all prompts
cat ~/.ssh/id_ed25519.pub
# Copy the output and add to GitHub >> Settings >> SSH Keys
```

---

### 2. Composer Install Takes Too Long or Fails

**Error:** `Killed` or `No space left on device`

**Solution:**
```bash
# SSH into server
ssh username@domain.com

# Check disk space
df -h

# Check memory limit
php -r "echo ini_get('memory_limit');"

# Increase PHP memory limit temporarily
composer install --memory-limit=-1 --no-dev --optimize-autoloader

# If still fails, contact GoDaddy to:
# - Increase account disk space
# - Increase PHP memory limit
```

---

### 3. Database Connection Error

**Error:** `SQLSTATE[HY000]: General error: 2002 ...`

**Solution:**
```bash
# Verify credentials in .env
cat .env | grep DB_

# Test MySQL connection
mysql -h localhost -u yourusername -p
# Enter password when prompted
# If successful, you'll see: mysql>
# Exit with: exit

# If fails, check in cPanel:
# 1. MySQL Databases - verify user exists
# 2. MySQL Users - verify user is assigned to database
# 3. If missing, recreate in cPanel

# Common issue: DB_HOST should be 'localhost' not 'IP'
# Update .env:
sed -i 's/DB_HOST=.*/DB_HOST=localhost/' .env
php artisan config:clear
```

---

### 4. Migration Errors

**Error:** `Column not found` or `Table doesn't exist`

**Solution:**
```bash
# View migration status
php artisan migrate:status

# If tables seem to exist, refresh:
php artisan migrate:refresh --force

# If specific table error, manually check:
mysql -u user -p dbname
> SHOW TABLES;
> DESCRIBE table_name;
> exit

# If really stuck, rollback and start fresh:
php artisan migrate:rollback --force
php artisan migrate --force
```

---

### 5. Permission Denied Errors

**Error:** `Permission denied` for storage/ or bootstrap/cache directories

**Solution:**
```bash
# Fix storage directory
chmod -R 755 storage
chmod -R 755 bootstrap/cache

# Fix file permissions inside
find storage -type f -exec chmod 644 {} \;
find bootstrap/cache -type f -exec chmod 644 {} \;

# If still failing, list owner:
ls -la storage | head -20
# Should be your FTP/SSH user

# If owned by www-data and you can't write:
# Contact GoDaddy to check file ownership
```

---

### 6. Blank White Screen / 500 Error

**Error:** Empty page with no error message

**Solution:**
```bash
# Enable debugging temporarily
sed -i 's/APP_DEBUG=false/APP_DEBUG=true/' .env
php artisan config:clear

# Check error logs
grep -i error storage/logs/laravel.log | tail -20

# Check PHP error log (in cPanel or via SSH):
tail -50 ~/public_html/error_log
# Or in cPanel: Error Log under Advanced

# Most common causes:
# 1. Database connection failure
# 2. Missing env variables
# 3. File permissions
# 4. Out of memory
# 5. PHP extension missing

# Check log for specific error and search solutions
```

---

### 7. Class Not Found / Autoloader Errors

**Error:** `Class 'App\...' not found` or similar

**Solution:**
```bash
# Regenerate autoloader
composer dump-autoload

# Or with optimization
composer dump-autoload -o

# Clear caches
php artisan cache:clear
php artisan config:clear

# If still failing, verify file exists:
ls -la app/Models/YourModel.php

# Check for PHP syntax errors:
php -l app/Models/YourModel.php
```

---

### 8. Route Not Found / 404 Error

**Error:** `404 | Not Found` on all pages except home

**Solution:**
```bash
# Verify routes are cached
php artisan route:cache
php artisan route:clear

# Check if .htaccess exists in public/
ls -la public/.htaccess

# If missing, create it:
cat > public/.htaccess << 'EOF'
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    RewriteCond %{HTTP:Authorization} .
    RewriteRule ^(.*)$ - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
EOF

# Verify mod_rewrite is enabled
php -m | grep rewrite

# If not enabled, contact GoDaddy to enable mod_rewrite
```

---

### 9. Session/Cookie Issues

**Error:** Not staying logged in, session data lost

**Solution:**
```bash
# Verify SESSION settings in .env
grep SESSION .env

# For GoDaddy shared hosting, use file-based sessions:
SESSION_DRIVER=file
# Not: database (unless sessions table exists)

# Clear session files
rm -f storage/framework/sessions/*

# Clear cache
php artisan cache:clear

# Verify storage/framework/sessions/ is writable
chmod -R 755 storage/framework/sessions
```

---

### 10. Mail Not Sending

**Error:** Emails not received or errors sending mail

**Solution:**
```bash
# Verify mail settings in .env
grep MAIL .env

# For GoDaddy, use:
MAIL_MAILER=sendmail
# OR
MAIL_MAILER=smtp
MAIL_HOST=localhost
MAIL_PORT=25
MAIL_ENCRYPTION=null

# Test mail sending:
php artisan tinker
> Mail::raw('Test', function($m) { $m->to('your-email@test.com'); });
> exit

# Check sendmail logs
tail -50 /var/mail/yourusername
# Or PHP error logs in cPanel
```

---

### 11. Setup.php Errors (Laravel)

**Error:** `The stream does not support flushing`

**Solution:**
```bash
# Usually a file permissions issue
chmod -R 755 storage
chmod -R 755 bootstrap/cache

# Or a PHP configuration issue - contact GoDaddy if persists
```

---

### 12. Out of Memory Error

**Error:** `Allowed memory size of 134217728 bytes exhausted`

**Solution:**
```bash
# Increase memory for specific command:
php -d memory_limit=512M artisan migrate
php -d memory_limit=512M composer install

# Or try without -d flag:
COMPOSER_MEMORY_LIMIT=-1 composer install

# Request GoDaddy to increase PHP memory_limit in:
# cPanel > MultiPHP INI Editor
# Change: memory_limit = 512M
```

---

### 13. SSL Certificate Issues

**Error:** Chrome shows "Not Secure" or SSL warnings

**Solution:**
```bash
# Ensure you have SSL set up in cPanel
# cPanel > Domains > Manage SSL
# Should have AutoSSL enabled (free)

# Update .env to use HTTPS
sed -i 's#APP_URL=http://#APP_URL=https://#' .env
php artisan config:clear

# Force HTTPS redirects in public/.htaccess:
# Add these lines before RewriteEngine On:
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Test SSL:
curl -I https://yourdomain.com
# Should show: HTTP/2 200
```

---

### 14. File Upload Issues

**Error:** File uploads failing or not appearing

**Solution:**
```bash
# Check storage directory permissions
chmod -R 755 storage/app/public
chmod -R 755 storage/uploads

# Verify storage:app is symlinked (if using public uploads)
php artisan storage:link

# Check file size limits in php.ini
# In cPanel > MultiPHP INI Editor:
# upload_max_filesize = 50M
# post_max_size = 50M

# Increase Laravel timeout for large uploads
# In .env: Add REQUEST_TIMEOUT=300

# Check disk space
df -h
```

---

### 15. Cron Jobs Not Running

**Error:** Scheduled tasks not executing

**Solution:**
```bash
# Add to cPanel > Cron Jobs:
* * * * * cd /home/yourusername/public_html && php artisan schedule:run >> /dev/null 2>&1

# Verify cron created:
crontab -l

# Test cron running:
php artisan schedule:run

# Check if commands are queued:
php artisan tinker
> Illuminate\Support\Facades\Schedule::events();
> exit

# If still not working:
# Contact GoDaddy - they must enable cron for your account
```

---

## Debugging Steps

### Before Contacting Support

1. **Check Application Logs**:
   ```bash
   tail -100 storage/logs/laravel.log
   grep -i error storage/logs/laravel.log | tail -20
   ```

2. **Check PHP Errors**:
   ```bash
   # In cPanel: Errors Log (or)
   cat ~/public_html/error_log
   ```

3. **Check Database Connection**:
   ```bash
   mysql -h localhost -u username -p -e "SELECT 1;"
   ```

4. **Check File Permissions**:
   ```bash
   ls -la storage/ | head -1
   ls -la bootstrap/cache/ | head -1
   ```

5. **Run Diagnostics**:
   ```bash
   php -v  # Check PHP version
   php -m | grep -i pdo  # Check PDO
   php -m | grep -i rewrite  # Check mod_rewrite
   composer diagnose  # Check Composer
   ```

### Information to Have Ready When Contacting Support

```
- Full error message
- Output of: php -v
- Output of: php -m
- Output of: tail -50 storage/logs/laravel.log
- Output of: cat ~/public_html/.env (without passwords!)
- When did last successful deployment occur?
- What changed since then?
```

---

## Performance Optimization

If your application is slow:

```bash
# 1. Cache routes and configuration
php artisan route:cache
php artisan config:cache

# 2. Preload common classes
php artisan optimize

# 3. Check what's slow
tail -50 storage/logs/laravel.log | grep slow

# 4. Enable query logging temporarily
# In .env: DB_QUERY_LOG=true
# Then check storage/logs for slow queries

# 5. Check database indexes
php artisan tinker
# Check if indexes exist on frequently queried columns
```

---

## Emergency Rollback

If deployment breaks the site:

```bash
# SSH into server
ssh username@domain.com
cd public_html

# List recent git commits
git log --oneline -10

# Go back to working version
git reset --hard COMMIT_HASH

# Restore database if needed
cp database/database.sqlite.backup.TIMESTAMP database/database.sqlite

# Clear caches
php artisan cache:clear

# Test site
curl https://yousdomain.com
```

---

## Need More Help?

- **GoDaddy Support**: https://www.godaddy.com/help
- **Laravel Docs**: https://laravel.com/docs/12
- **Laravel Discord**: https://discord.gg/laravel
- **Stack Overflow**: Tag your question with `laravel` and `godaddy`
