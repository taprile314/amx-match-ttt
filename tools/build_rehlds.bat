@echo off
REM ============================================================================
REM  build_rehlds.bat - compila amx_match_deluxe.sma contra el stack ReHLDS
REM  (ReGameDLL + ReAPI) y lo despliega al server de ese stack.
REM ============================================================================
REM  Este .bat vive en tools\ dentro del repo, que a su vez esta DENTRO del stack
REM  USB, al lado de "cs1.6_RE-HDLS". De ahi el ..\.. (sube de tools\ a la raiz del
REM  repo y de ahi al stack hermano RE); el codigo del plugin esta en ..\apps\plugin.
REM  Este es el build VIGENTE: el .sma usa #include <reapi>, asi que requiere el
REM  amxxpc.exe + reapi*.inc del stack RE (..\..\cs1.6_RE-HDLS\...\scripting\include).
REM ----------------------------------------------------------------------------
cd /d "%~dp0"

set "AMXX=..\..\cs1.6_RE-HDLS\cstrike\addons\amxmodx\scripting"
set "PLUGIN=..\apps\plugin"

if not exist "%AMXX%\amxxpc.exe" (
  echo [ERROR] No encuentro amxxpc.exe en:
  echo         %AMXX%
  echo Edita la variable AMXX en este .bat con la ruta a tu carpeta scripting de AMX Mod X ^(stack RE^).
  pause
  exit /b 1
)

echo Compilando %PLUGIN%\scripting\amx_match_deluxe.sma (ReHLDS/ReAPI) ...
"%AMXX%\amxxpc.exe" "%PLUGIN%\scripting\amx_match_deluxe.sma" -o"%PLUGIN%\plugins\amx_match_deluxe.amxx" -i"%AMXX%\include"

if not exist "%PLUGIN%\plugins\amx_match_deluxe.amxx" (
  echo [ERROR] La compilacion fallo, no se genero el .amxx.
  pause
  exit /b 1
)

echo.
echo Desplegando al server ReHLDS ...
copy /Y "%PLUGIN%\plugins\amx_match_deluxe.amxx" "%AMXX%\..\plugins\amx_match_deluxe.amxx"

echo.
echo OK. Reinicia el mapa (changelevel) o el server (stack RE) para cargar el plugin nuevo.
pause
