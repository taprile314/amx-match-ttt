@echo off
REM ============================================================================
REM  build_rehlds.bat - compila amx_match_deluxe.sma contra el stack ReHLDS
REM  (ReGameDLL + ReAPI) y lo despliega al server de ese stack.
REM ============================================================================
REM  Asume que este repo esta DENTRO del stack, al lado de "cs1.6_RE-HDLS".
REM  Variante del build.bat normal: ese apunta al stack STOCK
REM  (..\Counter-Strike 1.6-amx); este apunta al stack RE (..\cs1.6_RE-HDLS),
REM  cuyo scripting\include ya tiene los reapi*.inc copiados.
REM ----------------------------------------------------------------------------
cd /d "%~dp0"

set "AMXX=..\cs1.6_RE-HDLS\cstrike\addons\amxmodx\scripting"

if not exist "%AMXX%\amxxpc.exe" (
  echo [ERROR] No encuentro amxxpc.exe en:
  echo         %AMXX%
  echo Edita la variable AMXX en este .bat con la ruta a tu carpeta scripting de AMX Mod X (stack RE).
  pause
  exit /b 1
)

echo Compilando scripting\amx_match_deluxe.sma (ReHLDS/ReAPI) ...
"%AMXX%\amxxpc.exe" scripting\amx_match_deluxe.sma -oplugins\amx_match_deluxe.amxx -i"%AMXX%\include"

if not exist "plugins\amx_match_deluxe.amxx" (
  echo [ERROR] La compilacion fallo, no se genero el .amxx.
  pause
  exit /b 1
)

echo.
echo Desplegando al server ReHLDS ...
copy /Y "plugins\amx_match_deluxe.amxx" "%AMXX%\..\plugins\amx_match_deluxe.amxx"

echo.
echo OK. Reinicia el mapa (changelevel) o el server (stack RE) para cargar el plugin nuevo.
pause
