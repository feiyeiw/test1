@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Please install Node.js LTS, then run this launcher again.
  pause
  exit /b 1
)

echo Starting Static Blog / Case Studio...
echo The browser should open automatically.
echo Keep this window open while using the tool.
echo.
node "%~dp0tools\static-post-studio.js"

echo.
echo Static Blog / Case Studio stopped.
pause
