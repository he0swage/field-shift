@echo off
REM ===================================================================
REM  Developer mode: API on :5001 + Vite dev server with live reload on :5173
REM  (two windows; /api calls are forwarded to the backend by the Vite proxy)
REM ===================================================================
setlocal
cd /d "%~dp0"
set "ComSpec=%SystemRoot%\system32\cmd.exe"
if not exist "backend\node_modules" call npm --prefix backend install
if not exist "frontend\node_modules" call npm --prefix frontend install
start "Field Shift API (5001)" cmd /k "node backend\src\server.js"
start "Field Shift web (5173)" cmd /k "cd frontend && npm run dev"
timeout /t 3 >nul
start "" http://localhost:5173
