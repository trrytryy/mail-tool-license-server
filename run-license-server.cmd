@echo off
cd /d %~dp0
echo Starting license server...
node license-server.js
pause
