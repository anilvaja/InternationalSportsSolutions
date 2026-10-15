# Windows PowerShell Automated Deployment Script
param (
    [switch]$SkipSeed = $false,
    [switch]$StartWithPm2 = $false
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " International Sports Solutions - Windows Deployment Script " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Node.js and npm
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js 18+."
    exit 1
}
Write-Host "[1/5] Detected Node.js: $nodeVersion" -ForegroundColor Green

# 2. Install Dependencies
Write-Host "[2/5] Installing npm dependencies..." -ForegroundColor Yellow
npm install
npm install-scripts approve better-sqlite3 2>$null
npm rebuild better-sqlite3

# 3. Create Required Persistent Directories
Write-Host "[3/5] Setting up persistent directories..." -ForegroundColor Yellow
$dirs = @("data", "data/academies", "storage", "storage/uploads", "storage/backups", "storage/logs")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# 4. Run Seed & Migrations (Central & Tenant Databases)
if (-not $SkipSeed) {
    Write-Host "[4/5] Executing database migrations and seeders..." -ForegroundColor Yellow
    node src/db/seed.js
} else {
    Write-Host "[4/5] Skipping database seeding..." -ForegroundColor Gray
}

# 5. Start / Restart Process
Write-Host "[5/5] Launching server..." -ForegroundColor Yellow
if ($StartWithPm2) {
    npx pm2 reload ecosystem.config.js --env production 2>$null
    if ($LASTEXITCODE -ne 0) {
        npx pm2 start ecosystem.config.js --env production
    }
    Write-Host "Application deployed via PM2. Status: npx pm2 status" -ForegroundColor Green
} else {
    Write-Host "Starting application server..." -ForegroundColor Green
    node server.js
}
