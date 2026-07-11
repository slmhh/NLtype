@echo off
chcp 65001 >nul 2>nul
title TypeRush

set "ROOT=%~dp0"

echo ==============================
echo   TypeRush - Quick Start
echo ==============================

:: Kill any leftover processes
taskkill /f /im server.exe 2>nul
taskkill /f /im node.exe 2>nul

:: Build Go backend if binary missing
if not exist "%ROOT%apps\server\server.exe" (
    echo [1/2] Building Go backend...
    cd /d "%ROOT%apps\server"
    set GOROOT=%ROOT%.tools\go
    set GOCACHE=%ROOT%.tools\go-cache
    "%ROOT%.tools\go\bin\go.exe" build -o server.exe ./cmd/server/
    if errorlevel 1 (
        echo Build failed.
        pause
        exit /b 1
    )
    echo   Build OK.
)

:: Start backend (direct exe, no cmd /c tricks)
echo [1/2] Starting Go backend...
start /min "TypeRush-Backend" "%ROOT%apps\server\server.exe"

:: Start frontend
echo [2/2] Starting frontend...
cd /d "%ROOT%apps\client"
timeout /t 3 /nobreak >nul

echo.
echo ==============================
echo   Frontend: http://localhost:5173/
echo   Backend:  http://localhost:3001/
echo   Close this window to stop
echo ==============================
echo.

npx vite --host
taskkill /f /im server.exe 2>nul