@echo off
cd /d "%~dp0"
if not exist "node_modules\.bin\electron.cmd" (
  echo Electron is not installed. Run npm install first.
  pause
  exit /b 1
)
start "" "%~dp0\node_modules\.bin\electron.cmd" .
