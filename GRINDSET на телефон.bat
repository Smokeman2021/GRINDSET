@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0app-mvp"
echo Запускаю сервер з очищенням кешу (щоб не було старого інтерфейсу)...
echo Коли зявиться QR-код, відскануй його камерою телефону
echo (або відкрий Expo Go і введи адресу exp://... вручну).
echo.
npx expo start -c
pause
