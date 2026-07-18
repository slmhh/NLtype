@echo off
chcp 65001 >nul 2>nul
title NLtyping
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set JWT_SECRET=my-super-secret-key-that-is-long-enough-32!
set GOPROXY=https://goproxy.cn,direct

echo ==============================
echo   NLtyping - Quick Start
echo ==============================
echo.

:: Kill any leftover processes
taskkill /f /im server.exe 2>nul
taskkill /f /fi "WINDOWTITLE eq NLtyping-Backend" 2>nul

:: Start Go backend (from source)
echo [1/2] Starting Go backend...
cd /d "%ROOT%apps\server"
start "NLtyping-Backend" /min cmd /c "go run .\cmd\server 2>&1"
if errorlevel 1 (
    echo   Failed to start backend.
    pause
    exit /b 1
)

:: Wait for backend to be ready
timeout /t 5 /nobreak >nul

:: Start frontend
echo [2/2] Starting frontend...
cd /d "%ROOT%apps\client"
echo.
echo ==============================
echo   Frontend: http://localhost:5173/
echo   Backend:  http://localhost:3001/
echo   Close this window to stop
echo ==============================
echo.

call npx vite --host

:: Cleanup on exit
taskkill /f /fi "WINDOWTITLE eq NLtyping-Backend" 2>nul
taskkill /f /im server.exe 2>nul
