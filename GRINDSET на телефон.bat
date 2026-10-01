@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0app-mvp"
echo Запускаю сервер... Коли зявиться QR-код, відскануй його камерою телефону
echo (або відкрий Expo Go і введи адресу exp://... вручну).
echo.
npx expo start
pause
