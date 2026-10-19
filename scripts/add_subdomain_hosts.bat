@echo off
:: Batch script to add academy subdomains to Windows hosts file with Administrator privileges
:: Usage: Run as Administrator or double-click to add pratik-karate-academy.internationalsportssolutions.test

setlocal EnableDelayedExpansion
set HOSTS_PATH=%WINDIR%\System32\drivers\etc\hosts
set DOMAIN=pratik-karate-academy.internationalsportssolutions.test

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator to edit the Windows hosts file.
    echo Right-click this script and select 'Run as administrator'.
    pause
    exit /b 1
)

findstr /i /c:"%DOMAIN%" "%HOSTS_PATH%" >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Domain %DOMAIN% is already in %HOSTS_PATH%.
) else (
    echo. >> "%HOSTS_PATH%"
    echo 127.0.0.1 %DOMAIN% >> "%HOSTS_PATH%"
    echo [SUCCESS] Added 127.0.0.1 %DOMAIN% to %HOSTS_PATH%
)

ipconfig /flushdns >nul 2>&1
echo [SUCCESS] DNS cache flushed. You can now open:
echo http://%DOMAIN%/
pause
