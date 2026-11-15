@echo off
REM ===================================================================
REM  Precision Crop Rotation Advisor - one-click start (Windows)
REM  Installs what is missing, builds the website, starts the server
REM  and opens http://localhost:5001 (website + API on the same port).
REM  Keep this window open while you use the app. Close it to stop.
REM ===================================================================
setlocal
cd /d "%~dp0"
REM npm needs a valid ComSpec (some PCs have a broken one)
set "ComSpec=%SystemRoot%\system32\cmd.exe"

where node >/dev/null 2>/dev/null || (echo Node.js is not installed: https://nodejs.org & pause & exit /b 1)

if not exist "backend\node_modules" (
  echo [1/3] Installing backend packages...
  call npm --prefix backend install || (pause & exit /b 1)
)
if not exist "frontend\node_modules" (
  echo [2/3] Installing frontend packages...
  call npm --prefix frontend install || (pause & exit /b 1)
)
echo [3/3] Building the website...
call npm --prefix frontend run build || (pause & exit /b 1)

echo.
echo  Website + API: http://localhost:5001
echo  Demo login:    demo@fieldshift.app / fieldshift2026
echo  (close this window to stop the server)
echo.
start "" http://localhost:5001
node backend\src\server.js
pause
