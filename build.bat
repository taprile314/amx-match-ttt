@echo off
REM ============================================================================
REM  build.bat - compila amx_match_deluxe.sma y lo despliega al server del stack
REM ============================================================================
REM  Asume que este repo esta DENTRO del stack, al lado de "Counter-Strike 1.6-amx".
REM  Si tu AMX Mod X esta en otra ruta, edita la variable AMXX de abajo.
REM ----------------------------------------------------------------------------
cd /d "%~dp0"

set "AMXX=..\Counter-Strike 1.6-amx\cstrike\addons\amxmodx\scripting"

if not exist "%AMXX%\amxxpc.exe" (
  echo [ERROR] No encuentro amxxpc.exe en:
  echo         %AMXX%
  echo Edita la variable AMXX en este .bat con la ruta a tu carpeta scripting de AMX Mod X.
  pause
  exit /b 1
)

echo Compilando scripting\amx_match_deluxe.sma ...
"%AMXX%\amxxpc.exe" scripting\amx_match_deluxe.sma -oplugins\amx_match_deluxe.amxx -i"%AMXX%\include"

if not exist "plugins\amx_match_deluxe.amxx" (
  echo [ERROR] La compilacion fallo, no se genero el .amxx.
  pause
  exit /b 1
)

echo.
echo Desplegando al server ...
copy /Y "plugins\amx_match_deluxe.amxx" "%AMXX%\..\plugins\amx_match_deluxe.amxx"

echo.
echo OK. Reinicia el mapa (changelevel) o el server para cargar el plugin nuevo.
pause
