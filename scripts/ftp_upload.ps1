# Local PowerShell FTP Upload Helper Script
# Server: ftp.internationalsportssolutions.com
# User: sports_admin@internationalsportssolutions.com

param (
    [string]$FtpPassword = "Password@123 15890"
)

if ([string]::IsNullOrWhiteSpace($FtpPassword)) {
    $FtpPassword = Read-Host -Prompt "Enter FTP Password for sports_admin@internationalsportssolutions.com" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($FtpPassword)
    $FtpPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$FtpServer = "ftp://ftp.internationalsportssolutions.com"
$FtpUser = "sports_admin@internationalsportssolutions.com"

Write-Host "🚀 Preparing FTP file sync to $FtpServer..." -ForegroundColor Cyan

# Example WinSCP / NcFTP / curl upload logic can be invoked here
Write-Host "Please set the FTP_PASSWORD secret in your GitHub repository settings to enable automatic push on git push!" -ForegroundColor Green
