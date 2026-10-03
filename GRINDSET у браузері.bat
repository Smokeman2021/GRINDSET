@echo off
chcp 65001 >nul
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0app-mvp"
echo Запускаю застосунок у браузері з очищенням кешу...
echo Через хвилину сторінка відкриється сама (адреса http://localhost:8081).
echo Тему "Ніч/День" змінюй: Профіль - Налаштування - Тема.
echo.
npx expo start --web -c
pause
