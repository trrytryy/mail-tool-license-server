@echo off
cd /d %~dp0
echo Starting license server in a new window...
start "License Server" cmd /k "node license-server.js"
timeout /t 1 >nul
echo Starting Telegram bot in a new window...
start "Telegram Bot" cmd /k "node telegram-bot.js"
echo All started. Two windows should be open.
pause
