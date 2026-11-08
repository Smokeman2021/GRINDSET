@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0app-mvp"

echo [1/3] Закриваю старий сервер (якщо був), щоб телефон не брав стару версію...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [2/3] Перевіряю пакети (перший раз після оновлення може тривати хвилину)...
if not exist node_modules\expo-screen-orientation call npm install --no-audit --no-fund

echo [3/3] Запускаю сервер з чистим кешем.
echo.
echo   У застосунку: Профіль - зверху зліва "збірка N". Якщо номер новий - усе оновилось.
echo   Відскануй QR-код камерою телефону або відкрий Expo Go і введи адресу exp://... вручну.
echo.
npx expo start -c
pause
