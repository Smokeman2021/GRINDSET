@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0app-mvp"

echo Закриваю старий сервер (якщо був)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

if not exist node_modules\expo-screen-orientation call npm install --no-audit --no-fund

echo Запускаю застосунок у браузері (адреса http://localhost:8081, перший запуск - хвилина).
echo Тему Ніч/День змінюй: Профіль - шестерня - Оформлення.
echo.
npx expo start --web -c
pause
