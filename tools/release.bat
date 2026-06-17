@echo off
REM ============================================================================
REM  release.bat vX.Y.Z
REM  Compila el plugin, arma un bundle de deploy (.zip) y publica un GitHub
REM  Release con ese bundle como asset, via el CLI `gh`.
REM
REM    Uso:   release.bat v1.0.0
REM
REM  Requisitos: amxxpc.exe del AMX Mod X del stack RE adyacente (igual que
REM              build_rehlds.bat) y `gh` logueado (gh auth status).
REM
REM  Este .bat vive en tools\: ..\.. llega al stack hermano RE, ..\apps\plugin al
REM  codigo del plugin, y ..\dist (raiz del repo) al bundle de salida.
REM ============================================================================
setlocal
cd /d "%~dp0"

set "VER=%~1"
if "%VER%"=="" (
  echo Uso: release.bat vX.Y.Z
  echo   ej: release.bat v2.0.0
  exit /b 1
)

REM Stack ReHLDS/ReAPI: el plugin usa #include <reapi>, asi que el compilador
REM debe ser el del stack RE (cuyo include\ tiene los reapi*.inc), NO el stock.
set "AMXX=..\..\cs1.6_RE-HDLS\cstrike\addons\amxmodx\scripting"
set "PLUGIN=..\apps\plugin"
if not exist "%AMXX%\amxxpc.exe" (
  echo [ERROR] No encuentro amxxpc.exe en: %AMXX%
  echo Edita la variable AMXX en este .bat.
  exit /b 1
)

REM --- 1) Compilar ---------------------------------------------------------
echo [1/3] Compilando amx_match_deluxe.sma ...
"%AMXX%\amxxpc.exe" "%PLUGIN%\scripting\amx_match_deluxe.sma" -o"%PLUGIN%\plugins\amx_match_deluxe.amxx" -i"%AMXX%\include"
if not exist "%PLUGIN%\plugins\amx_match_deluxe.amxx" (
  echo [ERROR] La compilacion fallo, no se genero el .amxx.
  exit /b 1
)

REM --- 2) Armar bundle de deploy (espeja la estructura de cstrike/) ---------
echo [2/3] Armando bundle ..\dist\amx-match-ttt-%VER%.zip ...
set "STAGE=..\dist\amx-match-ttt-%VER%"
if exist "..\dist" rmdir /s /q "..\dist"
mkdir "%STAGE%\addons\amxmodx\plugins"        2>nul
mkdir "%STAGE%\addons\amxmodx\data\lang"      2>nul
mkdir "%STAGE%\addons\amxmodx\configs"        2>nul

copy /Y "%PLUGIN%\plugins\amx_match_deluxe.amxx"   "%STAGE%\addons\amxmodx\plugins\"        >nul
copy /Y "%PLUGIN%\data\lang\amx_match_deluxe.txt"  "%STAGE%\addons\amxmodx\data\lang\"      >nul
xcopy /E /I /Y "%PLUGIN%\configs\amxmd"            "%STAGE%\addons\amxmodx\configs\amxmd"   >nul
copy /Y "%PLUGIN%\configs\sql.cfg"                 "%STAGE%\addons\amxmodx\configs\"        >nul
copy /Y "%PLUGIN%\configs\users.ini.example"       "%STAGE%\addons\amxmodx\configs\"        >nul
copy /Y "%PLUGIN%\INSTALL.txt"                     "%STAGE%\"                               >nul

set "ZIP=..\dist\amx-match-ttt-%VER%.zip"
powershell -NoProfile -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%ZIP%' -Force"
if not exist "%ZIP%" (
  echo [ERROR] No se pudo crear el zip.
  exit /b 1
)

REM --- 3) Publicar el GitHub Release ---------------------------------------
echo [3/3] Creando GitHub Release %VER% ...
gh release create %VER% "%ZIP%" --title "amx-match-ttt %VER%" --generate-notes
if errorlevel 1 (
  echo [ERROR] gh release create fallo. Revisa: tag ya existente, commits sin pushear, o gh auth.
  exit /b 1
)

echo.
echo OK. Release %VER% publicado con el bundle adjunto.
echo (Acordate de actualizar CHANGELOG.md y pushear antes de la proxima release.)
endlocal
