@echo off
REM =====================================================================
REM  start_motd_server.bat
REM  Levanta el servidor HTTP estatico que sirve el MOTD del torneo TTT
REM  (logo + estilo) en el puerto 27080, escuchando en todas las
REM  interfaces (LAN 192.168.x y Tailscale 100.x a la vez).
REM
REM  No instala nada, no pide admin, no toca el registro: usa el
REM  TcpListener nativo de .NET via PowerShell. Ruta relativa a %~dp0.
REM =====================================================================
cd /d "%~dp0"

set "MOTD_PORT=27080"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %MOTD_PORT% -Root "%~dp0web"

echo.
echo  El servidor MOTD se cerro.
pause
