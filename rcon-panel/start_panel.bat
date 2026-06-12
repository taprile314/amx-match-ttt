@echo off
REM ===================================================================
REM  Panel de control web (rcon) para el server de CS 1.6.
REM  Portable: usa rutas relativas a este .bat (%~dp0). Doble clic.
REM  Requiere Node.js en el PATH (node --version). Cero dependencias npm.
REM ===================================================================
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [ERROR] No se encontro Node.js en el PATH.
  echo  Instala Node ^(https://nodejs.org^) o agrega node.exe al PATH.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   Panel de control TTT
echo   Abrir en el navegador:  http://localhost:8080
echo  ============================================================
echo.
echo  Abriendo el navegador automaticamente...

REM Abrimos el navegador en paralelo: esperamos ~2s a que el server
REM levante y recien ahi abrimos la pagina (node server.js bloquea esta
REM ventana, asi que el browser hay que dispararlo en un proceso aparte).
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8080"

echo Levantando panel de control TTT...
node server.js

echo.
echo  El panel se cerro. Revisa los mensajes de arriba si fue por error.
pause
