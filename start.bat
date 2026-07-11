@echo off
title TypeRush — 启动中...

echo ==============================
echo   TypeRush — 一键启动
echo ==============================
echo.

:: 设置 Go 环境
set GOROOT=D:\Code\NLtyping\.tools\go
set GOCACHE=D:\Code\NLtyping\.tools\go-cache
set PORT=3001

:: 第一步：编译并启动 Go 后端
echo [1/2] 编译 Go 后端...
cd /d D:\Code\NLtyping\apps\server
D:\Code\NLtyping\.tools\go\bin\go.exe build -o server.exe ./cmd/server/
echo   编译完成，启动后端...

:: 在新窗口中启动后端（最小化）
start /min "" cmd /c "title TypeRush-Backend && echo Go Server starting... && D:\Code\NLtyping\apps\server\server.exe"

:: 第二步：启动前端
echo [2/2] 启动前端开发服务器...
cd /d D:\Code\NLtyping\apps\client

:: 给后端一点时间准备
timeout /t 2 /nobreak > nul

:: 前端在前台运行（关掉它也就关掉了整个开发环境）
echo.
echo ==============================
echo   前端: http://localhost:5173/
echo   后端: http://localhost:3001/
echo   按 Ctrl+C 停止前端
echo ==============================
echo.

npx.cmd vite --host

:: 前端关闭后，清理后端进程
echo 正在关闭后端...
taskkill /f /im server.exe 2>nul
