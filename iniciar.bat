@echo off
title Alineaciones para OBS
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Node.js en esta computadora.
  echo  Instalalo desde https://nodejs.org ^(version LTS^) y abre este archivo de nuevo.
  echo.
  pause
  exit /b 1
)
node server.js
echo.
echo  El servidor se detuvo. Cierra esta ventana o vuelve a abrir iniciar.bat.
pause
