@echo off
setlocal enabledelayedexpansion
title pi-order-processing Setup

echo ============================================
echo   DK Hardware - Order Processing Setup
echo ============================================
echo.

:: ── Check winget (Windows Package Manager) ─────
set WINGET=0
where winget >nul 2>&1 && set WINGET=1

:: ── Step 1: Install Node.js if missing ─────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Node.js not found - installing...
    if %WINGET%==1 (
        echo [*] Installing via winget...
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        if %errorlevel% neq 0 (
            echo [ERROR] Failed to install Node.js via winget.
            echo Please install manually: https://nodejs.org
            pause
            exit /b 1
        )
        echo [OK] Node.js installed - please restart this script
        echo     (you may need to open a new terminal first)
        pause
        exit /b 0
    ) else (
        echo [ERROR] Node.js is not installed.
        echo Please install it from https://nodejs.org (v18 or later^)
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js found: %NODE_VER%

:: ── Step 2: npm (comes with Node.js) ────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found - something is wrong with Node.js install.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK] npm found: v%NPM_VER%

:: ── Step 3: Install Git if missing ──────────────
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Git not found - installing...
    if %WINGET%==1 (
        echo [*] Installing via winget...
        winget install Git.Git --silent --accept-package-agreements --accept-source-agreements
        if %errorlevel% neq 0 (
            echo [ERROR] Failed to install Git via winget.
            echo Please install manually: https://git-scm.com
            pause
            exit /b 1
        )
        echo [OK] Git installed - please restart this script
        echo     (you may need to open a new terminal first)
        pause
        exit /b 0
    ) else (
        echo [ERROR] Git is not installed.
        echo Please install it from https://git-scm.com
        pause
        exit /b 1
    )
)
echo [OK] Git found

:: ── Step 4: Install pi (if not present) ─────────
echo.
echo [*] Checking pi coding agent...

call npm list -g @mariozechner/pi-coding-agent >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Installing pi (@mariozechner/pi-coding-agent)...
    call npm install -g @mariozechner/pi-coding-agent
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pi.
        pause
        exit /b 1
    )
)
echo [OK] pi is ready

:: ── Step 5: Install pi-order-processing ─────────
echo.
echo [*] Installing pi-order-processing from GitHub...

call npm install -g github:shishirbh/pi-order-processing
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install pi-order-processing.
    pause
    exit /b 1
)
echo [OK] pi-order-processing installed

:: ── Step 6: Launch ──────────────────────────────
echo.
echo ============================================
echo   Setup complete - launching...
echo ============================================
echo.

call pi-order-processing

echo.
echo pi-order-processing has stopped.
pause
